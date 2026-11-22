// ============================================================================
// Edge Function: baixar-link-direto
// ----------------------------------------------------------------------------
// Sempre que um lançamento chega com link_tipo = 'direto' (a nota tem um
// link no e-mail que abre o PDF direto, sem precisar preencher formulário
// nenhum) e ainda não tem arquivo, essa function baixa o PDF ela mesma —
// rodando no servidor, não no navegador, então não tem o problema de CORS
// que teria se o painel tentasse fazer esse fetch() direto.
//
// Depois de baixar e salvar no Storage (mesmo bucket "documentos" de
// sempre), o lançamento passa a ter arquivo_nf_path preenchido — a partir
// daí ele segue o MESMO caminho de qualquer nota normal (pasta de saída
// quando for Enviado, upload pra Monday, etc.), sem precisar de nada extra.
//
// Se o download falhar (link expirado, não é PDF, portal fora do ar), marca
// requer_revisao = true com uma observação explicando o motivo, em vez de
// travar silenciosamente.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Chave de serviço: prefere a nova (sb_secret_, publicada em SUPABASE_SECRET_KEYS como
// dicionário JSON por nome) e cai na legada quando ela não existir. A legada vazou em
// 17/09/2026 e será desativada; até lá as duas convivem, sem janela de queda.
// Escape hatch sem redeploy: SUPABASE_CHAVE_MODO=legada força a antiga.
function chaveDeServico(): string {
  const legada = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if ((Deno.env.get("SUPABASE_CHAVE_MODO") || "nova").toLowerCase() === "legada") return legada;
  try {
    const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"];
    if (typeof nova === "string" && nova.startsWith("sb_secret_")) return nova;
  } catch { /* formato inesperado: segue na legada */ }
  return legada;
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(SUPABASE_URL, chaveDeServico());

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    if (payload.table !== "lancamentos" || !["INSERT", "UPDATE"].includes(payload.type)) {
      return new Response(JSON.stringify({ ignorado: true }), { status: 200 });
    }

    const rec = payload.record;
    if (rec.link_tipo !== "direto" || !rec.link_portal || rec.arquivo_nf_path) {
      return new Response(JSON.stringify({ ignorado: true }), { status: 200 });
    }

    // reserva atômica — se duas execuções chegarem quase juntas (mesma
    // lógica anti-corrida do sync-monday), só uma delas baixa de verdade.
    const { data: reservado } = await sb
      .from("lancamentos")
      .update({ arquivo_nf_path: "BAIXANDO" })
      .eq("id", rec.id)
      .is("arquivo_nf_path", null)
      .select("id");

    if (!reservado || reservado.length === 0) {
      return new Response(JSON.stringify({ ok: true, jaEmAndamento: true }), { status: 200 });
    }

    try {
      const resp = await fetch(rec.link_portal, {
        redirect: "follow",
        headers: {
          // muitos links de e-mail em massa passam por um redirecionador de
          // rastreamento de clique que devolve uma imagem-fantasma (pixel de
          // rastreio) pra quem não parecer um navegador de verdade — isso
          // evita ser tratado como "bot"/scanner de segurança e conseguir o
          // redirecionamento real até o PDF.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ao acessar o link`);

      const bytes = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type") || "";

      // confirma que é PDF de verdade pelos primeiros bytes (assinatura
      // "%PDF") — evita salvar uma página de erro/login HTML como se fosse
      // o arquivo, o que estragaria o lançamento sem avisar ninguém.
      const ehPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      if (!ehPdf) {
        throw new Error(`A resposta não parece ser um PDF (content-type: "${contentType}", ${bytes.length} bytes)`);
      }

      const nomeArquivo = `LINK_${String(rec.nf || rec.id).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
      const path = `auto/${rec.id}_${nomeArquivo}`;

      const { error: upErr } = await sb.storage.from("documentos").upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;

      await sb.from("lancamentos").update({
        arquivo_nf_path: path,
        arquivo_nf_nome: nomeArquivo,
      }).eq("id", rec.id);

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e) {
      // não conseguiu — libera a reserva (não fica "BAIXANDO" travado pra
      // sempre) e marca pra revisão manual, explicando o motivo.
      const motivo = String(e instanceof Error ? e.message : e);
      await sb.from("lancamentos").update({
        arquivo_nf_path: null,
        requer_revisao: true,
        observacoes: `${rec.observacoes ? rec.observacoes + " · " : ""}Falha ao baixar automaticamente o link direto (${motivo}). Abra o link manualmente pela coluna Documentos.`,
      }).eq("id", rec.id);
      console.error("Erro ao baixar link direto:", motivo);
      return new Response(JSON.stringify({ ok: false, error: motivo }), { status: 200 });
    }
  } catch (e) {
    console.error("Erro no baixar-link-direto:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});