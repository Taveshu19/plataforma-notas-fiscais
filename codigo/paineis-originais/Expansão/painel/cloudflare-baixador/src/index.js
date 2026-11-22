// painel-baixador — Cloudflare Worker (conta Cloudflare do Gustavo, plano grátis).
//
// Existe por um motivo só: o site de Barueri derruba conexão vinda da Amazon (onde roda o
// Supabase, até na região São Paulo), mas responde para a Cloudflare. A Edge Function
// `baixar-nota-link` (Supabase) chama este Worker com o token secreto, ele busca o link
// e devolve o conteúdo cru. Quem decide se é PDF e se o tamanho serve é a Edge Function.
//
// Portal que mostra a nota como PÁGINA (ISSNet) em vez de PDF: o Worker abre num navegador da
// Cloudflare (Browser Rendering, plano grátis) e "imprime" em PDF — só para PORTAIS_PAGINA_NOTA.
//
// Não é proxy aberto: sem o header x-painel-token igual ao secret TOKEN, responde 403.
// Deploy: cd cloudflare-baixador && npx wrangler@4 deploy   (secret: npx wrangler@4 secret put TOKEN)

import puppeteer from "@cloudflare/puppeteer";

const LIMITE_BYTES = 10 * 1024 * 1024;

// Portais cuja página É a nota, sem PDF pra baixar. Só esses são "impressos" em PDF — qualquer
// outra página (login do Outlook, propaganda...) viraria um PDF de lixo no painel.
const PORTAIS_PAGINA_NOTA = [/(^|\.)issnetonline\.com\.br$/i];

async function imprimirEmPdf(env, url) {
  // A página é baixada com fetch (rápido) e só o HTML vai pro navegador: navegar até o ISSNet
  // de dentro do navegador da Cloudflare levava 40 s+ e estourava o tempo.
  const t0 = Date.now();
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: AbortSignal.timeout(50_000) });
  if (!r.ok) throw new Error(`o site respondeu ${r.status}`);
  // O ISSNet diz "utf-8" no cabeçalho mas manda Latin-1 (acentos viravam "�"). Tenta UTF-8 de
  // verdade; se não for válido, lê como windows-1252.
  const bruto = await r.arrayBuffer();
  let html;
  try { html = new TextDecoder("utf-8", { fatal: true }).decode(bruto); }
  catch { html = new TextDecoder("windows-1252").decode(bruto); }
  html = html.replace(/<meta[^>]+charset[^>]*>/gi, "");
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + '<meta charset="utf-8">') : html;
  const base = `<base href="${url.replace(/"/g, "&quot;")}">`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + base) : base + html;
  console.log(`[imprimir] html ${html.length} bytes em ${Date.now() - t0} ms`);
  const navegador = await puppeteer.launch(env.BROWSER);
  console.log(`[imprimir] navegador aberto em ${Date.now() - t0} ms`);
  try {
    const pagina = await navegador.newPage();
    await pagina.setJavaScriptEnabled(false); // a nota é HTML pronto; os scripts do portal só atrasam
    await pagina.setContent(html, { waitUntil: "load", timeout: 15_000 }).catch(() => {});
    // Esconde os botões "Imprimir/Enviar por e-mail" do rodapé do ISSNet, se existirem.
    await pagina.addStyleTag({ content: "#cellRodape,#tbComandos{display:none!important}" }).catch(() => {});
    // A nota do ISSNet é mais larga que uma folha A4: encolhe pra caber (sem isso a direita saía cortada).
    // Isola a nota: a maior tabela da página é o documento; tudo que está fora dela (menus,
    // janela "Enviar por e-mail", que o JavaScript do portal esconderia) some. Depois mede a
    // largura real dela, numa janela larga (a de 800 px escondia a sobra).
    await pagina.setViewport({ width: 1600, height: 1200 });
    const largura = await pagina.evaluate(() => {
      let nota = null, maior = 0;
      for (const t of document.querySelectorAll("table")) {
        const r = t.getBoundingClientRect();
        if (r.width * r.height > maior) { maior = r.width * r.height; nota = t; }
      }
      if (!nota) return 0;
      for (let el = nota; el && el !== document.body; el = el.parentElement) {
        for (const irmao of el.parentElement ? el.parentElement.children : []) {
          if (irmao !== el && irmao.tagName !== "STYLE" && irmao.tagName !== "LINK") irmao.style.display = "none";
        }
      }
      return Math.ceil(nota.getBoundingClientRect().right);
    }).catch(() => 0);
    const util = 734; // A4 (794 px) menos as margens de 8 mm
    const escala = largura > util ? Math.max(0.3, util / largura) : 1;
    const pdf = await pagina.pdf({ format: "A4", printBackground: true, scale: escala, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } });
    console.log(`[imprimir] pdf ${pdf.length} bytes em ${Date.now() - t0} ms`);
    return pdf;
  } finally {
    await navegador.close();
  }
}

export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("use POST", { status: 405 });
    if (!env.TOKEN || req.headers.get("x-painel-token") !== env.TOKEN) return new Response("proibido", { status: 403 });

    let url;
    try {
      const corpo = await req.json();
      url = new URL(String(corpo.url || ""));
    } catch {
      return new Response("link inválido", { status: 400 });
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return new Response("protocolo não permitido", { status: 400 });

    if (PORTAIS_PAGINA_NOTA.some((re) => re.test(url.hostname))) {
      try {
        const pdf = await imprimirEmPdf(env, url.toString());
        return new Response(pdf, { status: 200, headers: { "content-type": "application/pdf", "x-status-origem": "200", "x-impresso": "1" } });
      } catch (e) {
        return new Response(`falha ao imprimir a página: ${e && e.message || e}`, { status: 502, headers: { "x-erro": "rede" } });
      }
    }

    let r;
    try {
      r = await fetch(url.toString(), {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/pdf,*/*" },
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      return new Response(`falha ao baixar: ${e && e.message || e}`, { status: 502, headers: { "x-erro": "rede" } });
    }
    if (Number(r.headers.get("content-length") || 0) > LIMITE_BYTES) {
      return new Response("arquivo grande demais", { status: 413 });
    }
    const h = new Headers();
    h.set("x-status-origem", String(r.status));
    h.set("content-type", r.headers.get("content-type") || "application/octet-stream");
    if (r.headers.get("content-disposition")) h.set("content-disposition", r.headers.get("content-disposition"));
    return new Response(r.body, { status: 200, headers: h });
  },
};
