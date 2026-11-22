// avisar-compras — envia o aviso de Compras por e-mail, SEMPRE com os documentos da requisição (10/11/2026).
// Chamado pelo gatilho compras_avisos_disparo a cada aviso novo (abertura, aprovação, ajuste, recusa).
// Sai da caixa da escrituração (única liberada para o app do Graph), com o nome de quem agiu no
// texto e "responder para" essa pessoa. O destino vem de compras_config.destino_avisos.
// Anexos: até ~3 MB no próprio envio; acima disso, rascunho + envio em partes do Graph. Se o Graph
// recusar o rascunho, o e-mail sai com o que couber e lista no texto o que ficou de fora.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRAPH_TENANT_ID = Deno.env.get("GRAPH_TENANT_ID")!;
const GRAPH_CLIENT_ID = Deno.env.get("GRAPH_CLIENT_ID")!;
const GRAPH_CLIENT_SECRET = Deno.env.get("GRAPH_CLIENT_SECRET")!;
const CAIXA = Deno.env.get("GRAPH_SENDER_MAILBOX")!;
const PAINEL_URL = "https://seu-painel-antigo.netlify.app/";
const LIMITE_DIRETO = 3_000_000;
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico(), { auth: { persistSession: false } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function base64(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const ROTULO: Record<string, string> = { rm: "RM", propostas: "Proposta", certificados: "Certificado" };

async function tokenGraph(): Promise<string> {
  const r = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GRAPH_CLIENT_ID, client_secret: GRAPH_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Token do Graph: " + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}
const BASE = () => `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(CAIXA)}`;
const anexoGraph = (a: { nome: string; bytes: Uint8Array }) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.nome, contentBytes: base64(a.bytes) });

async function envioDireto(token: string, message: any, anexos: { nome: string; bytes: Uint8Array }[]) {
  const r = await fetch(`${BASE()}/sendMail`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ saveToSentItems: true, message: { ...message, attachments: anexos.map(anexoGraph) } }) });
  if (!r.ok) throw new Error("Envio pelo Graph: " + (await r.text()).slice(0, 300));
}
async function envioEmPartes(token: string, message: any, anexos: { nome: string; bytes: Uint8Array }[]) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rasc = await fetch(`${BASE()}/messages`, { method: "POST", headers: h, body: JSON.stringify(message) });
  if (!rasc.ok) throw new Error("Rascunho: " + (await rasc.text()).slice(0, 200));
  const id = (await rasc.json()).id;
  for (const a of anexos) {
    if (a.bytes.length < LIMITE_DIRETO) {
      const r = await fetch(`${BASE()}/messages/${id}/attachments`, { method: "POST", headers: h, body: JSON.stringify(anexoGraph(a)) });
      if (!r.ok) throw new Error(`Anexo ${a.nome}: ` + (await r.text()).slice(0, 200));
      continue;
    }
    const s = await fetch(`${BASE()}/messages/${id}/attachments/createUploadSession`, { method: "POST", headers: h,
      body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: a.nome, size: a.bytes.length } }) });
    if (!s.ok) throw new Error(`Envio em partes de ${a.nome}: ` + (await s.text()).slice(0, 200));
    const url = (await s.json()).uploadUrl, passo = 320 * 1024 * 10;
    for (let i = 0; i < a.bytes.length; i += passo) {
      const parte = a.bytes.subarray(i, Math.min(i + passo, a.bytes.length));
      const r = await fetch(url, { method: "PUT", headers: { "Content-Length": String(parte.length), "Content-Range": `bytes ${i}-${i + parte.length - 1}/${a.bytes.length}` }, body: parte });
      if (!r.ok) throw new Error(`Parte de ${a.nome}: ` + (await r.text()).slice(0, 200));
    }
  }
  const envio = await fetch(`${BASE()}/messages/${id}/send`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!envio.ok) throw new Error("Envio do rascunho: " + (await envio.text()).slice(0, 200));
}

Deno.serve(async req => {
  let avisoId: number | null = null;
  try {
    const { data: ok } = await sb.rpc("compras_chave_confere", { chave: req.headers.get("x-chave-avisos") || "" });
    if (!ok) return new Response(JSON.stringify({ erro: "não autorizado" }), { status: 401 });
    avisoId = Number((await req.json()).aviso_id);
    const { data: aviso, error } = await sb.from("compras_avisos").select("*, compras_requisicoes(*)").eq("id", avisoId).single();
    if (error || !aviso) throw new Error("Aviso não encontrado.");
    if (aviso.enviado_em) return new Response(JSON.stringify({ ok: true, repetido: true }));
    const { data: cfg } = await sb.from("compras_config").select("valor").eq("chave", "destino_avisos").single();
    const para = cfg?.valor;
    if (!para) throw new Error("Destino dos avisos não configurado.");
    const r = aviso.compras_requisicoes;

    // Documentos da requisição, sempre junto.
    const { data: lista } = await sb.from("compras_anexos").select("tipo, nome, caminho").eq("requisicao_id", r.id).order("em");
    const anexos: { nome: string; bytes: Uint8Array; tipo: string; caminho: string }[] = [], falhas: string[] = [];
    for (const a of lista || []) {
      const d = await sb.storage.from("compras").download(a.caminho);
      if (d.error || !d.data) { falhas.push(a.nome); continue; }
      anexos.push({ nome: a.nome, tipo: a.tipo, caminho: a.caminho, bytes: new Uint8Array(await d.data.arrayBuffer()) });
    }

    const montar = (deFora: { nome: string; url?: string }[]) => `<p>${esc(aviso.corpo)}</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
        <tr><td style="padding:3px 12px 3px 0;color:#555">Requisição</td><td>${esc(r.numero)} · ${esc(r.nome)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#555">Descrição</td><td>${esc(r.descricao || "—")}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#555">Unidade / tipo</td><td>${esc(r.unidade || "—")} · ${esc(r.tipo)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#555">Prioridade / SLA</td><td>${esc(r.prioridade)} · ${esc(r.sla_dias)} dias corridos</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#555">Solicitante</td><td>${esc(r.solicitante_nome || r.solicitante_email)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#555;vertical-align:top">Documentos</td><td>${anexos.length ? anexos.map(a => `${esc(ROTULO[a.tipo] || a.tipo)}: ${esc(a.nome)}`).join("<br>") : "Nenhum documento anexado à requisição."}</td></tr>
      </table>
      ${deFora.length ? `<p><b>Documentos grandes demais para anexar</b> (link válido por 30 dias):<br>${deFora.map(d => d.url ? `<a href="${esc(d.url)}">${esc(d.nome)}</a>` : `${esc(d.nome)} (abra na aba Compras do painel)`).join("<br>")}</p>` : ""}
      <p>Abra a aba <b>Compras</b> do painel: <a href="${PAINEL_URL}">${PAINEL_URL}</a></p>
      <p style="color:#777;font-size:12px">Aviso automático do painel de Expansão. Responder este e-mail fala direto com ${esc(r.solicitante_nome || aviso.responder_para)}.</p>`;
    const mensagem = (deFora: { nome: string; url?: string }[]) => ({
      subject: aviso.assunto, body: { contentType: "HTML", content: montar([...falhas.map(nome => ({ nome })), ...deFora]) },
      toRecipients: [{ emailAddress: { address: para } }],
      ...(aviso.responder_para ? { replyTo: [{ emailAddress: { address: aviso.responder_para } }] } : {}),
    });

    const token = await tokenGraph();
    const total = anexos.reduce((s, a) => s + a.bytes.length, 0);
    let observacao: string | null = falhas.length ? `Não foi possível ler: ${falhas.join(", ")}` : null;
    if (total <= LIMITE_DIRETO) {
      await envioDireto(token, mensagem([]), anexos);
    } else {
      try {
        await envioEmPartes(token, mensagem([]), anexos);
      } catch (e) {
        // Plano B: manda o que couber e avisa no texto o que ficou de fora.
        // O app só tem permissão de enviar (sem rascunho): o que não cabe vai como link de download.
        const cabem: typeof anexos = [], deFora: { nome: string; url?: string }[] = []; let soma = 0;
        for (const a of anexos) {
          if (soma + a.bytes.length <= LIMITE_DIRETO) { cabem.push(a); soma += a.bytes.length; continue; }
          const link = await sb.storage.from("compras").createSignedUrl(a.caminho, 60 * 60 * 24 * 30);
          deFora.push({ nome: a.nome, url: link.data?.signedUrl });
        }
        await envioDireto(token, mensagem(deFora), cabem);
        observacao = `Anexado por link: ${deFora.map(d => d.nome).join(", ")} (${(e as Error).message.slice(0, 80)})`;
      }
    }
    await sb.from("compras_avisos").update({ para, enviado_em: new Date().toISOString(), erro: observacao }).eq("id", avisoId);
    return new Response(JSON.stringify({ ok: true, para, anexos: anexos.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    if (avisoId) await sb.from("compras_avisos").update({ erro: String((e as Error).message || e) }).eq("id", avisoId);
    return new Response(JSON.stringify({ ok: false, erro: String((e as Error).message || e) }), { status: 500 });
  }
});
