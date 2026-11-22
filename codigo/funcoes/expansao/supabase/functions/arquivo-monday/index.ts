// arquivo-monday — entrega ao painel um arquivo copiado para o painel (bucket monday-arquivos). Não consulta a Monday (18/11/2026).
// 11/11/2026. Os links de arquivo da Monday expiram em poucas horas, então o painel não os guarda: guarda só o id do arquivo
// (no espelho) e pede o arquivo aqui na hora. Esta função faz uma consulta (query) na Monday e repassa os bytes.
//
// Segurança: quem pede precisa estar logado no painel. A permissão é conferida PELO BANCO com o login de quem pediu (RLS):
// (filtro "cs" com JSON: o contains() do supabase-js não serve para coluna jsonb)
// o id do arquivo só é entregue se ele estiver na lista de arquivos de uma nota ou contrato que essa pessoa pode ver.
// Não existe como pedir um arquivo qualquer da Monday por aqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LIMITE = 80 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const erro = (status: number, mensagem: string) => new Response(JSON.stringify({ erro: mensagem }), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const TIPOS: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method !== "POST") return erro(405, "use POST");
    const { asset_id } = await req.json().catch(() => ({}));
    const id = String(asset_id ?? "");
    if (!/^\d{1,20}$/.test(id)) return erro(400, "asset_id inválido");
    const autorizacao = req.headers.get("Authorization") || "";
    if (!autorizacao.startsWith("Bearer ")) return erro(401, "entre no painel para ver arquivos");

    // Permissão pelo banco, com o login de quem pediu.
    const eu = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } });
    const [nota, contrato, aditivo] = await Promise.all([
      eu.from("monday_espelho").select("item_id").filter("arquivos", "cs", JSON.stringify([{ id }])).limit(1),
      eu.from("contratos").select("item_id").filter("arquivos_itens", "cs", JSON.stringify([{ id }])).limit(1),
      eu.from("contratos").select("item_id").filter("subitens", "cs", JSON.stringify([{ lista: [{ id }] }])).limit(1),
    ]);
    const achou = [nota, contrato, aditivo].some(r => !r.error && (r.data || []).length > 0);
    if (!achou) return erro(403, "arquivo não encontrado ou sem permissão");
    // Cópia no painel (16/11/2026): se o arquivo já foi copiado, serve dela, sem depender da Monday.
    try {
      const chaveSvc = (() => { try { const n = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (n) return n; } catch (_) { /* legada */ } return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; })();
      const svc = createClient(SUPABASE_URL, chaveSvc, { auth: { persistSession: false } });
      const { data: copia } = await svc.from("monday_arquivos").select("caminho, nome").eq("asset_id", id).maybeSingle();
      if (copia) {
        const dl = await svc.storage.from("monday-arquivos").download(copia.caminho);
        if (!dl.error && dl.data) {
          const ext = String(copia.nome || "").split(".").pop()!.toLowerCase();
          return new Response(dl.data, { headers: { ...CORS, "Content-Type": TIPOS[ext] || dl.data.type || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(copia.nome || "arquivo")}`, "Cache-Control": "private, max-age=300" } });
        }
      }
    } catch (_) { /* segue para a Monday */ }

    // 18/11/2026: sem consulta à Monday. Todo arquivo do painel já está copiado; se não estiver, avisa em vez de ir buscar fora.
    return erro(404, "arquivo ainda não está no painel");
  } catch (e) {
    return erro(500, String((e as Error).message || e));
  }
});
