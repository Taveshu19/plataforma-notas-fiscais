// baixar-nota-link — Edge Function do Supabase (cópia-fonte; a que roda está no projeto
// seu-projeto-expansao, publicada com verify_jwt = true).
//
// Nota que chega por "link aberto" (LINK_DIRETO_*.json do Power Automate — ver AUTOMATE.md):
// o link já entrega o PDF da nota, sem código nem captcha (ex: Barueri, wfimagemNota.aspx).
// O navegador não pode baixar esse PDF direto do site da prefeitura (o site não libera CORS),
// então o painel pede pra esta função baixar e devolver o PDF em base64. A partir daí ele entra
// como se tivesse chegado anexado (processFile: Gemini, Storage, Monday).
//
// Links de VERIFICAÇÃO (GISS etc.) não passam por aqui: o portal exige código + reCAPTCHA.
//
// Só devolve se o conteúdo for PDF de verdade (começa com %PDF). Página HTML, imagem ou
// erro → { ok:false } e o painel deixa a linha como estava, com o botão "Abrir nota".
//
// Desde 08/10/2026 o download passa pelo Worker `painel-baixador` na Cloudflare
// (cloudflare-baixador/) quando os secrets CF_BAIXADOR_URL e CF_BAIXADOR_TOKEN existem: o site de
// Barueri derruba conexão vinda da Amazon, que é onde o Supabase roda (testado até em sa-east-1).
// Sem os secrets, tenta direto (serve para portais que não bloqueiam).
// Resposta com `rede: true` = falha passageira (vale tentar de novo); sem ela = definitivo.
//
// Proteção: só http/https, nada de IP interno/localhost, no máximo 5 redirecionamentos (cada
// destino é checado de novo), 10 MB e 25 s.
//
// Deploy: npx supabase@latest functions deploy baixar-nota-link --project-ref seu-projeto-expansao --use-api

const LIMITE_BYTES = 10 * 1024 * 1024;
const TEMPO_LIMITE_MS = 110_000; // "imprimir" página na Cloudflare (ISSNet) leva mais que baixar PDF
const MAX_REDIRECIONAMENTOS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function enderecoProibido(u: URL): string | null {
  if (u.protocol !== "https:" && u.protocol !== "http:") return "protocolo não permitido";
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return "endereço interno";
  // IPv4 literal em faixa privada/reservada
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) {
      return "endereço interno";
    }
  }
  if (h.includes(":")) return "IPv6 literal não permitido";
  return null;
}

function nomeDoArquivo(cd: string | null): string | null {
  if (!cd) return null;
  const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]).trim() : null;
}

function paraBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);

  let url: URL;
  try {
    const corpo = await req.json();
    url = new URL(String(corpo?.url || ""));
  } catch {
    return resposta({ ok: false, erro: "link inválido" }, 400);
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    let r: Response | null = null;
    const worker = Deno.env.get("CF_BAIXADOR_URL");
    const token = Deno.env.get("CF_BAIXADOR_TOKEN");
    if (worker && token) {
      // Caminho normal: pela Cloudflare (Barueri bloqueia a Amazon, onde esta função roda).
      const proibido = enderecoProibido(url);
      if (proibido) return resposta({ ok: false, erro: proibido });
      const viaCf = await fetch(worker, {
        method: "POST",
        signal: controle.signal,
        headers: { "Content-Type": "application/json", "x-painel-token": token },
        body: JSON.stringify({ url: url.toString() }),
      });
      if (!viaCf.ok) {
        const msg = (await viaCf.text()).slice(0, 200);
        return resposta({ ok: false, erro: `baixador: ${msg}`, rede: viaCf.headers.get("x-erro") === "rede" });
      }
      const origem = Number(viaCf.headers.get("x-status-origem") || 200);
      if (origem >= 400) { await viaCf.body?.cancel(); return resposta({ ok: false, erro: `o site respondeu ${origem}`, rede: origem >= 500 }); }
      r = viaCf;
    } else {
      let atual = url;
      for (let i = 0; i <= MAX_REDIRECIONAMENTOS; i++) {
        const proibido = enderecoProibido(atual);
        if (proibido) return resposta({ ok: false, erro: proibido });
        r = await fetch(atual, {
          redirect: "manual",
          signal: controle.signal,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PainelExpansao", "Accept": "application/pdf,*/*" },
        });
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
          await r.body?.cancel();
          atual = new URL(r.headers.get("location")!, atual);
          r = null;
          continue;
        }
        break;
      }
      if (!r) return resposta({ ok: false, erro: "redirecionamentos demais" });
      if (!r.ok) { await r.body?.cancel(); return resposta({ ok: false, erro: `o site respondeu ${r.status}`, rede: r.status >= 500 }); }
    }

    const declarado = Number(r.headers.get("content-length") || 0);
    if (declarado > LIMITE_BYTES) { await r.body?.cancel(); return resposta({ ok: false, erro: "arquivo grande demais" }); }

    // Lê em partes pra não estourar a memória se o site mentir o tamanho.
    const partes: Uint8Array[] = [];
    let total = 0;
    const leitor = r.body!.getReader();
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.length;
      if (total > LIMITE_BYTES) { await leitor.cancel(); return resposta({ ok: false, erro: "arquivo grande demais" }); }
      partes.push(value);
    }
    const bytes = new Uint8Array(total);
    let pos = 0;
    for (const p of partes) { bytes.set(p, pos); pos += p.length; }

    const ehPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    if (!ehPdf) {
      return resposta({ ok: false, erro: "o link não devolveu um PDF", content_type: r.headers.get("content-type") || null });
    }
    return resposta({
      ok: true,
      pdf_base64: paraBase64(bytes),
      nome: nomeDoArquivo(r.headers.get("content-disposition")),
      bytes: bytes.length,
    });
  } catch (e) {
    const erro = (e as Error)?.name === "AbortError" ? "o site demorou demais" : `falha ao baixar: ${(e as Error)?.message || e}`;
    return resposta({ ok: false, erro, rede: true });
  } finally {
    clearTimeout(relogio);
  }
});
