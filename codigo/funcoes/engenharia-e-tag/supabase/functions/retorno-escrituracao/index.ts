// retorno-escrituracao (16/11/2026) — recebe o resultado da aprovação do pedido (robô "RPA Intranet") e registra na nota.
// Chamada pelo fluxo de e-mail do Power Automate do Gustavo: POST com o assunto e o texto do e-mail.
// Protegida por chave (cabeçalho x-chave-retorno = secret RETORNO_CHAVE). Não usa a Monday.
// Texto esperado: "Seu pedido 131629, foi Aprovado por <quem> e seguirá para Escrituração!! ... Motivo: ..."
//                 "Seu pedido 131426, foi Rejeitado por <quem> e não seguirá para Escrituração! ... Motivo: ..."
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CHAVE_RETORNO = Deno.env.get("RETORNO_CHAVE") || "";
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(SUPABASE_URL, chaveServico(), { auth: { persistSession: false } });
const CABECALHOS = { "Content-Type": "application/json; charset=utf-8" };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

const semHtml = (t: string) => t.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const REGRA = /Seu pedido\s+(\d{4,})\s*,?\s*foi\s+(Aprovado|Rejeitado)\s+por\s+(.+?)\s+e\s+(?:seguirá|não\s+seguirá)\s+para\s+Escrituração/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);
  if (!CHAVE_RETORNO || (req.headers.get("x-chave-retorno") || "") !== CHAVE_RETORNO) return json({ erro: "não autorizado" }, 401);
  try {
    const corpo = await req.json();
    const texto = semHtml(`${corpo.assunto || ""} ${corpo.texto || ""}`);
    const m = REGRA.exec(texto);
    if (!m) return json({ ok: false, motivo: "Não reconheci o resultado nesta mensagem." }, 422);
    const pedido = m[1];
    const resultado = m[2].toLowerCase() === "aprovado" ? "aprovada" : "recusada";
    const quem = m[3].trim();
    const motivoM = /Motivo:\s*([\s\S]*)$/i.exec(texto);
    const motivo = motivoM ? motivoM[1].trim().slice(0, 500) : "";
    if (resultado === "recusada" && !motivo) { /* segue: a recusa vale mesmo sem motivo escrito */ }

    // 1. A nota com este pedido: pelo pedido registrado no painel ou pelo pedido da cópia (quando a nota veio do lançamento antigo).
    let nota: string | null = null;
    const { data: porPedido } = await sb.from("aprovacoes_notas").select("nota_id, etapa").eq("pedido", pedido).limit(5);
    nota = (porPedido || []).find((x: any) => x.etapa === "encaminhada")?.nota_id ?? (porPedido || [])[0]?.nota_id ?? null;
    if (!nota) {
      const { data: porCampo } = await sb.from("aprovacoes_notas").select("nota_id, etapa").eq("campos->>pedido", pedido).limit(5);
      nota = (porCampo || [])[0]?.nota_id ?? null;
    }
    if (!nota) {
      const { data: esp } = await sb.from("monday_espelho").select("item_id, lancamento_id, etapa").eq("pedido", pedido).neq("etapa", "excluida").limit(5);
      const e = (esp || [])[0];
      if (e) nota = e.lancamento_id || ("M" + e.item_id);
    }
    if (!nota) return json({ ok: false, pedido, motivo: "Nenhuma nota com este pedido neste painel." }, 404);

    // 2. Registra na análise da nota. Só registra se a nota já foi enviada (Encaminhadas).
    const { data: linha } = await sb.from("aprovacoes_notas").select("*").eq("nota_id", nota).maybeSingle();
    if (!linha) return json({ ok: false, nota, pedido, motivo: "A nota ainda não tem análise no painel." }, 409);
    if (linha.etapa !== "encaminhada") return json({ ok: false, nota, pedido, motivo: `A nota está em "${linha.etapa}", não em Encaminhadas. O retorno fica para quando ela for enviada.` }, 409);
    const jaRegistrado = (linha.historico || []).some((h: string) => h.includes(`pedido ${pedido}`) && h.includes(resultado === "aprovada" ? "APROVADA" : "RECUSADA"));
    if (jaRegistrado) return json({ ok: true, nota, pedido, resultado, motivo: "Já estava registrado." });

    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const texto_historico = `Retorno da escrituração (automático · pedido ${pedido}): ${resultado === "aprovada" ? "APROVADA" : "RECUSADA"} por ${quem}${motivo ? " · motivo: " + motivo : ""} · ${agora}`;
    const { error } = await sb.from("aprovacoes_notas").update({
      decisao: resultado,
      historico: [...(linha.historico || []), texto_historico],
      versao: (linha.versao ?? 0) + 1,
      atualizado_em: new Date().toISOString(),
    }).eq("nota_id", nota);
    if (error) return json({ ok: false, erro: error.message }, 500);
    return json({ ok: true, nota, pedido, resultado, registrado: texto_historico });
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message || e) }, 500);
  }
});
