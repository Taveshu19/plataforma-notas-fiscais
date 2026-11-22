// recuperar-senha (ENGENHARIA, 16/11/2026) — "Esqueci minha senha" do painel de Engenharia.
// Recebe { email }, gera um link de recuperação (Supabase Auth, tipo recovery) e o envia pela caixa da escrituração (Graph),
// a mesma usada pelos avisos de Compras. Não usa o e-mail padrão do Supabase.
// Segurança: resposta sempre igual (não revela se o e-mail tem conta); no máximo 1 pedido a cada 2 minutos e 5 por dia por e-mail;
// o link aponta só para o endereço fixo do painel abaixo (o pedido não escolhe para onde o link leva).
// O painel abre com ?recuperar=<token> e troca a senha com verifyOtp + updateUser.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAINEL_URL = "https://seu-site.netlify.app/engenharia/";
// 17/11/2026 (Gustavo): quem é da equipe TAG (Otávio e BO) usa só o painel Notas TAG; o link leva para lá, que também abre com ?recuperar=.
const PAINEL_TAG_URL = "https://seu-site.netlify.app/tag/";
const GRAPH_TENANT_ID = Deno.env.get("GRAPH_TENANT_ID")!;
const GRAPH_CLIENT_ID = Deno.env.get("GRAPH_CLIENT_ID")!;
const GRAPH_CLIENT_SECRET = Deno.env.get("GRAPH_CLIENT_SECRET")!;
const CAIXA = Deno.env.get("GRAPH_SENDER_MAILBOX")!;
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico(), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const resposta = () => new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });

async function tokenGraph(): Promise<string> {
  const r = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GRAPH_CLIENT_ID, client_secret: GRAPH_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Token do Graph: " + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("método não permitido", { status: 405, headers: CORS });
  let pedidoId: number | null = null;
  try {
    const corpo = await req.json().catch(() => ({}));
    const email = String(corpo?.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return resposta();

    // Limite por e-mail: 1 a cada 2 minutos, 5 por dia.
    const { data: recentes } = await sb.from("senha_recuperacoes").select("em").eq("email", email).gte("em", new Date(Date.now() - 864e5).toISOString());
    if ((recentes || []).length >= 5 || (recentes || []).some(r => Date.now() - Date.parse(r.em) < 120_000)) return resposta();
    const { data: novo } = await sb.from("senha_recuperacoes").insert({ email }).select("id").single();
    pedidoId = novo?.id ?? null;

    // E-mail sem conta: generateLink falha e a resposta continua a mesma.
    const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return resposta();
    const nome = String(data.user?.user_metadata?.nome || "").trim() || email.split("@")[0];
    const { data: perfil } = await sb.from("painel_perfis").select("equipe").eq("email", email).maybeSingle();
    const eTag = perfil?.equipe === "tag";
    const nomePainel = eTag ? "Painel Notas TAG" : "Painel de Engenharia", cor = eTag ? "#123f6e" : "#b94a0b";
    const link = `${eTag ? PAINEL_TAG_URL : PAINEL_URL}?recuperar=${encodeURIComponent(tokenHash)}`;

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#17202f;line-height:1.6">
      <p>Olá, ${esc(nome)}.</p>
      <p>Recebemos um pedido para criar uma nova senha de acesso ao <b>${nomePainel}</b> para o e-mail ${esc(email)}.</p>
      <p><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;background:${cor};color:#fff;text-decoration:none;border-radius:4px">Criar nova senha</a></p>
      <p style="font-size:12px;color:#555">Se o botão não abrir, copie este endereço no navegador:<br>${esc(link)}</p>
      <p style="font-size:12px;color:#555">O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: sua senha atual continua valendo.</p>
      <p style="font-size:12px;color:#777">Mensagem automática do painel. Não responda.</p></div>`;
    const token = await tokenGraph();
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(CAIXA)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ saveToSentItems: false, message: { subject: `${nomePainel}: criar nova senha`, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: email } }] } }),
    });
    if (!r.ok) throw new Error("Envio pelo Graph: " + (await r.text()).slice(0, 300));
    if (pedidoId) await sb.from("senha_recuperacoes").update({ enviado: true }).eq("id", pedidoId);
    return resposta();
  } catch (e) {
    console.error("recuperar-senha:", (e as Error).message);
    return resposta();   // mesmo em falha, não revela nada a quem pediu; o erro fica no log da função
  }
});
