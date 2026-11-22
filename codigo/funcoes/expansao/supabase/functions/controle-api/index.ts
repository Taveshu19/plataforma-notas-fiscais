// controle-api (banco da EXPANSÃO), 19/11/2026: Controle de Lançamentos com o login da TAG.
// Aceita o login da Expansão OU o da TAG (banco da Engenharia). Confere o e-mail na lista (controle_autorizado, no banco)
// e lê/grava em nome dessa pessoa pela função controle_api() (o histórico registra quem fez). Nada aqui usa a Monday.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(SUPABASE_URL, chaveServico(), { auth: { persistSession: false } });
const ENG_URL = "https://seu-projeto-engenharia.supabase.co";
const ENG_CHAVE = Deno.env.get("ENG_PUBLIC_KEY") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// E-mail de quem está logado: primeiro o login da Expansão; senão, o da TAG (Engenharia).
async function emailDe(token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await sb.auth.getUser(token);
  if (data?.user?.email) return data.user.email.toLowerCase();
  if (!ENG_CHAVE) return null;
  const r = await fetch(`${ENG_URL}/auth/v1/user`, { headers: { apikey: ENG_CHAVE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.email ? String(u.email).toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const email = await emailDe(token);
    if (!email) return resposta({ erro: "Entre novamente." }, 401);
    const { acao, dados } = await req.json();
    const { data, error } = await sb.rpc("controle_api", { p_email: email, p_acao: String(acao || ""), p_dados: dados || {} });
    if (error) return resposta({ erro: error.message }, /acesso/i.test(error.message) ? 403 : 400);
    return resposta({ email, dados: data });
  } catch (e) {
    return resposta({ erro: String((e as Error).message || e) }, 500);
  }
});
