// escriturar-painel (ENGENHARIA), 16/11/2026 — o botão "Enviar para escriturar" do painel da Engenharia.
// 17/11/2026: o destino segue o Pagador, como na função antiga da Engenharia (ESCRITURACAO.md, Beatriz 23/10/2026):
//   Holding → SharePoint (Pinhal: e-mail ao fiscal) · Empresa Exemplo, Parceira, Condomínio Lago → e-mail "Planilha Azul"
//   Remessa, Tag, Coligada, outros ou sem Pagador → não envia. Em cópia: Beatriz e quem clicou.
// 19/11/2026: Pagador e Cód. Fornecedor lidos como na tela: correção do painel > análise > lançamento > cópia da Monday (antes a nota 1801
// mostrava Pagador Holding e o envio dizia "sem Pagador"; a 2944 tinha o Cód. Fornecedor na Monday e o envio não lia).
// A MONDAY NÃO É MAIS USADA (decisão do Gustavo): esta função não chama a Monday nem a função notificar-escrituracao.
// Monta a nota a partir do banco do painel (lançamento ou cópia do item), aplica as correções feitas no painel (aprovacoes_notas.campos)
// e envia: e-mail ao fiscal (Pinhal e Remessa) ou e-mail de escrituração para o fluxo do SharePoint (demais).
// Regras de negócio mantidas de integracao_TOTVS (botão Enviar): mapeamentos de unidade, natureza e forma, código do emitente pelo cadastro Datasul,
// anexos sem repetição, modo real ou prévia (ESCRITURACAO_EMAIL_MODO), reenvio só com a nota recusada e corrigida.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(SUPABASE_URL, chaveServico(), { auth: { persistSession: false } });
const GRAPH = { tenant: Deno.env.get("GRAPH_TENANT_ID") || "", id: Deno.env.get("GRAPH_CLIENT_ID") || "", segredo: Deno.env.get("GRAPH_CLIENT_SECRET") || "", caixa: Deno.env.get("GRAPH_SENDER_MAILBOX") || "" };
const REVIEW_EMAIL = Deno.env.get("REVIEW_EMAIL") || "";
const UNIDADE_PINHAL = "019 - PINHAL";
const SERIE_PADRAO = "1";
const EQUIPE_COPIA: Record<string, string> = { "beatriz.martins@empresa.exemplo": "Beatriz Martins" };   // Engenharia: a Beatriz vai em cópia de todo e-mail
// Planilha Azul (Engenharia): empresa por Pagador e destinatários fixos (ESCRITURACAO.md).
const PLANILHA_AZUL: Record<string, string> = { "empresa exemplo": "EMPRESA EXEMPLO", "parceira": "PARCEIRA", "condomínio lago": "LAGO" };
const PLANILHA_AZUL_PARA = ["engenharia@empresa.exemplo"];   // 18/11/2026 (Gustavo): só a engenharia, sem cópias
type Rota = { tipo: "sharepoint" } | { tipo: "pinhal" } | { tipo: "fiscal" } | { tipo: "azul"; empresa: string } | { tipo: "nao"; motivo: string };
const chavePagador = (p: string) => String(p || "").replace(/\s+/g, " ").trim().toLowerCase();
const ESTABELECIMENTO_NA_LISTA: Record<string, string> = {
  "001 - SOROCABA": "1 Sorocaba", "002 - AMERICANA": "2 Americana", "003 - ILHÉUS": "3 Ilhéus", "004 - CAMPINA GRANDE": "4 Campina Grande", "005 - LONDRINA": "5 Londrina",
  "006 - PELOTAS": "6 Pelotas", "007 - ANÁPOLIS": "7 Anápolis", "008 - CONTAGEM": "8 Contagem", "009 - NITEROI": "9 Niteroi", "010 - CASCAVEL": "10 Cascavel",
  "011 - MARÍLIA": "11 Marilia", "012 - JOINVILLE": "12 Joinville", "013 - MONTES CLAROS": "13 Montes Claros", "014 - PALMAS": "14 Palmas", "015 - IPATINGA": "15 Ipatinga",
  "017 - BLUMENAU": "17 Blumenau", "018 - MARINGÁ": "18 Maringa", "019 - PINHAL": "19 Pinhal", "020 - ARARAQUARA": "20 Araraquara", "099 - CORPORATIVO": "99 Corporativo",
};
const CLASSIFICACAO_POR_NATUREZA: Record<string, { modalidade: string; finalidade: string }> = {
  "Material": { modalidade: "NF-e", finalidade: "Uso e Consumo08" }, "Serviço": { modalidade: "NFS-e", finalidade: "Serviços10" },
  "Fatura": { modalidade: "RD", finalidade: "Serviços10" }, "CTE": { modalidade: "CT-e", finalidade: "Serviços10" },
};
const FORMA_PAGAMENTO_NA_LISTA: Record<string, string> = { "Boleto": "Boleto", "Dados Bancários": "PIX/Dados Bancários", "Vincular 100% AF": "AF", "Cartão Corporativo": "Cartão de Crédito" };
const CAMPOS_EDITAVEIS = ["fornecedor", "nf", "valor", "emissao", "vencimento", "unidade", "natureza", "pagamento", "cnpj_fornecedor", "banco", "agencia", "conta_corrente", "chave_pix", "pedido", "codigo_emitente"];

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const formatarValor = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? "0,00"); };
const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const agoraBR = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function base64(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }

// Valor de uma coluna da cópia do item (texto), usado só para o que o painel ainda não tem como campo próprio.
function colunaDoItem(bruto: unknown, id: string): string {
  if (!Array.isArray(bruto)) return "";
  const c = (bruto as any[]).find((x) => x && x.id === id);
  return String(c?.text ?? "").trim();
}

let tokenGraph: { v: string; ate: number } | null = null;
async function obterTokenGraph(): Promise<string> {
  if (tokenGraph && tokenGraph.ate > Date.now()) return tokenGraph.v;
  const r = await fetch(`https://login.microsoftonline.com/${GRAPH.tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GRAPH.id, client_secret: GRAPH.segredo, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }) });
  const j = await r.json(); if (!r.ok) throw new Error("Erro ao obter token do Graph: " + JSON.stringify(j).slice(0, 200));
  tokenGraph = { v: j.access_token, ate: Date.now() + (j.expires_in - 60) * 1000 }; return tokenGraph.v;
}
async function enviarEmail(to: string | string[], cc: string[], assunto: string, html: string, anexos: { filename: string; content: string }[], replyTo?: string) {
  const token = await obterTokenGraph();
  const message = { subject: assunto, body: { contentType: "HTML", content: html }, toRecipients: (Array.isArray(to) ? to : [to]).map((e) => ({ emailAddress: { address: e } })),
    ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}), ccRecipients: cc.map((e) => ({ emailAddress: { address: e } })),
    attachments: anexos.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentBytes: a.content })) };
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(GRAPH.caixa)}/sendMail`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message, saveToSentItems: true }) });
  if (!r.ok) throw new Error("Erro ao enviar via Microsoft Graph: " + (await r.text()).slice(0, 300));
}

type Anexo = { filename: string; bucket: string; caminho: string; chave?: string };
type Item = { id: string; origem: "lancamento" | "monday"; nome: string; unidade: string; natureza: string; forma: string; documento: string; pedido: string; emissao: string; vencimento: string; cnpj: string; valor: unknown; dadosBancarios: string; emitente: string; pagador: string; anexos: Anexo[] };

// Monta a nota: o lançamento (se existe) ou a cópia do item, com as correções do painel por cima.
async function montarItem(notaId: string, ap: any): Promise<Item | { erro: string; status: number }> {
  const ov: Record<string, any> = (ap?.campos && typeof ap.campos === "object") ? ap.campos : {};
  const { data: l } = await sb.from("lancamentos").select("*").eq("id", notaId).maybeSingle();
  let item: Item;
  if (l && l.status === "Enviado") {
    // 19/11/2026: a cópia da Monday ligada ao lançamento completa o que o lançamento não tem (Pagador e Cód. Fornecedor), na mesma ordem da tela.
    const { data: ml } = await sb.from("monday_espelho").select("pagador, cod_fornecedor, codigo_emitente").eq("lancamento_id", notaId).neq("etapa", "excluida").limit(1).maybeSingle();
    const dados = [l.banco && `Banco ${l.banco}`, l.agencia && `Ag ${l.agencia}`, l.conta_corrente && `CC ${l.conta_corrente}`, l.chave_pix && `PIX ${l.chave_pix}`].filter(Boolean).join(" ");
    const anexos: Anexo[] = [];
    if (l.arquivo_nf_path) anexos.push({ filename: l.arquivo_nf_nome || "nota.pdf", bucket: "documentos", caminho: l.arquivo_nf_path });
    if (l.arquivo_boleto_path) anexos.push({ filename: l.arquivo_boleto_nome || "boleto.pdf", bucket: "documentos", caminho: l.arquivo_boleto_path });
    // 19/11/2026: 2º boleto (ou mais) vinculado no lançamento (arquivos_processados). Antes ia só o primeiro.
    const { data: bolExtras } = await sb.from("arquivos_processados").select("nome_arquivo, path_storage").eq("lancamento_id", notaId).eq("tipo", "BOLETO");
    for (const b of bolExtras || []) if (b.path_storage && !anexos.some((x) => x.caminho === b.path_storage)) anexos.push({ filename: b.nome_arquivo || "boleto.pdf", bucket: "documentos", caminho: b.path_storage });
    item = { id: notaId, origem: "lancamento", nome: `${l.fornecedor} - ${l.natureza === "CTE" ? "CTE" : "NOTA"} ${l.nf}`, unidade: String(l.unidade || ""), natureza: l.natureza || "",
      forma: l.pagamento || "", documento: String(l.nf || ""), pedido: ap?.pedido || "", emissao: l.emissao || "", vencimento: l.vencimento || "", cnpj: l.cnpj_fornecedor || "",
      valor: l.valor, dadosBancarios: dados, emitente: String(l.codigo_fornecedor || ml?.cod_fornecedor || ml?.codigo_emitente || "").trim(),
      pagador: String(ap?.pagador || l.pagador || ml?.pagador || ""), anexos };
  } else {
    // Nota que nasceu na Monday e está na cópia do painel (só para leitura dos dados que o painel já tem).
    const itemId = notaId.startsWith("M") ? notaId.slice(1) : notaId;
    const { data: e } = await sb.from("monday_espelho").select("*").eq("item_id", itemId).neq("etapa", "excluida").maybeSingle();
    if (!e) return { erro: "Não encontrei esta nota.", status: 404 };
    const anexos: Anexo[] = [];
    for (const a of (e.arquivos || []) as any[]) {
      const { data: m } = await sb.from("monday_arquivos").select("caminho, nome").eq("asset_id", String(a.id)).maybeSingle();
      const caminho = m?.caminho || null;
      if (caminho) anexos.push({ filename: m?.nome || a.nome || "arquivo.pdf", bucket: "monday-arquivos", caminho, chave: "monday:" + String(a.id) });
    }
    item = { id: notaId, origem: "monday", nome: e.nome || "", unidade: e.unidade || "", natureza: e.natureza || "",
      forma: colunaDoItem(e.bruto, "color_mkxscppz") || "", documento: String(e.documento || ""), pedido: e.pedido || "", emissao: e.emissao || "", vencimento: e.vencimento || "",
      cnpj: e.cnpj || "", valor: e.valor, dadosBancarios: colunaDoItem(e.bruto, "text_mkxsy2pp"), emitente: String(e.cod_fornecedor || e.codigo_emitente || colunaDoItem(e.bruto, "text_mm7psf5p") || colunaDoItem(e.bruto, "text_mm8c933h") || "").trim(), pagador: String(ap?.pagador || e.pagador || ""), anexos };
  }
  // 18/11/2026: arquivos incluídos pelo painel ("Incluir arquivo", boleto que chegou depois) também vão no envio.
  const { data: extras } = await sb.from("aprovacoes_anexos").select("nome, caminho").eq("nota_id", notaId);
  for (const x of extras || []) if (x.caminho) item.anexos.push({ filename: x.nome || "arquivo.pdf", bucket: "documentos", caminho: x.caminho });
  // 19/11/2026: arquivo removido da nota no painel ("Remover da nota") não vai no envio (o arquivo continua guardado; "Devolver" traz de volta).
  const ocultos = new Set(((ap?.arquivos_ocultos ?? []) as unknown[]).map(String));
  if (ocultos.size) item.anexos = item.anexos.filter((a) => !ocultos.has(a.caminho) && !(a.chave && ocultos.has(a.chave)));
  // Correções do painel (administrativo) valem sobre tudo.
  for (const k of CAMPOS_EDITAVEIS) {
    if (ov[k] === undefined || ov[k] === null || ov[k] === "") continue;
    const v = String(ov[k]);
    if (k === "fornecedor") item.nome = item.nome.replace(/^[^-]*/, v + " ").trim();
    else if (k === "nf") item.documento = v;
    else if (k === "valor") item.valor = v;
    else if (k === "emissao") item.emissao = v;
    else if (k === "vencimento") item.vencimento = v;
    else if (k === "unidade") item.unidade = v;
    else if (k === "natureza") item.natureza = v;
    else if (k === "pagamento") item.forma = v;
    else if (k === "cnpj_fornecedor") item.cnpj = v;
    else if (k === "banco" || k === "agencia" || k === "conta_corrente" || k === "chave_pix") { /* mantidos no texto de dados bancários abaixo */ }
    else if (k === "pedido") item.pedido = v;
    else if (k === "codigo_emitente") item.emitente = v;
  }
  if (ov.banco || ov.agencia || ov.conta_corrente || ov.chave_pix) {
    const b = [ov.banco && `Banco ${ov.banco}`, ov.agencia && `Ag ${ov.agencia}`, ov.conta_corrente && `CC ${ov.conta_corrente}`, ov.chave_pix && `PIX ${ov.chave_pix}`].filter(Boolean).join(" ");
    if (b) item.dadosBancarios = b;
  }
  // Unidade no formato da lista (ex.: "020 - ARARAQUARA"), quando veio só o código.
  if (!/^\d{3} - /.test(item.unidade)) {
    const cod = item.unidade.trim().slice(0, 3);
    const achada = Object.keys(ESTABELECIMENTO_NA_LISTA).find((u) => u.startsWith(cod + " - "));
    if (achada) item.unidade = achada;
  }
  return item;
}

async function codigoDoEmitente(cnpj: string, manualBruto = ""): Promise<{ codigo: string } | { erro: string }> {
  const digitos = cnpj.replace(/\D/g, ""); if (!digitos) return { erro: "a nota está sem CNPJ" };
  const manual = manualBruto.trim();
  if (manual && !/^\d+$/.test(manual)) return { erro: `o Código do emitente "${manual}" deve ter só números` };
  if (manual.length > 9) return { erro: `o Código do emitente "${manual}" parece um CNPJ, não o código do fornecedor no Datasul (tem até 9 dígitos, como 1090029)` };
  const { data, error } = await sb.from("datasul_fornecedores").select("codigo, nome").eq("cnpj", digitos);
  if (error) return { erro: `não consegui consultar o cadastro de fornecedores (${error.message})` };
  if (data?.length === 1) { const codigo = String(data[0].codigo); if (manual && manual !== codigo) return { erro: `o Código do emitente digitado (${manual}) é diferente do cadastro do Datasul para o CNPJ ${cnpj} (${codigo}); corrija o campo` }; return { codigo }; }
  if (data && data.length > 1) { const codigos = data.map((d) => String(d.codigo)); if (manual && codigos.includes(manual)) return { codigo: manual };
    return { erro: `o CNPJ ${cnpj} tem mais de um código no Datasul (${data.map((d) => `${d.codigo} ${d.nome}`).join("; ")}); informe o código que vale` }; }
  if (!manual) return { erro: `o CNPJ ${cnpj} não está no cadastro de fornecedores do Datasul; preencha o Cód. Fornecedor (código do Datasul) no campo logo acima do botão` };
  const { data: dono } = await sb.from("datasul_fornecedores").select("cnpj, nome").eq("codigo", manual);
  if (dono?.length && dono.some((d) => String(d.cnpj) !== digitos)) return { erro: `o Código do emitente digitado (${manual}) pertence a outro fornecedor no Datasul (${dono.map((d) => d.nome).join("; ")})` };
  return { codigo: manual };
}

async function baixarAnexos(item: Item): Promise<{ filename: string; content: string }[]> {
  const vistos = new Set<string>(), out: { filename: string; content: string }[] = [];
  for (const a of item.anexos) {
    const { data, error } = await sb.storage.from(a.bucket).download(a.caminho);
    if (error || !data) { console.warn("Anexo não baixado", a.filename, error?.message); continue; }
    const b64 = base64(new Uint8Array(await data.arrayBuffer()));
    if (vistos.has(b64)) continue; vistos.add(b64); out.push({ filename: a.filename, content: b64 });
  }
  return out;
}

function montarHtmlFiscal(item: Item, assinatura: string): string {
  const temBoleto = item.anexos.some((a) => a.filename.toUpperCase().includes("BOLETO"));
  const bancarios = temBoleto ? "BOLETO" : item.dadosBancarios || (item.natureza === "Remessa" ? "Não necessário pagamento" : "");
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;"><p>Boa tarde, prezados!<br/>Tudo bem?</p><p>Segue notas:</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;"><thead style="background-color: #2f5233; color: white;"><tr>
  <th>Unidade</th><th>Nota</th><th>Dados Bancários</th><th>Pedido</th><th>Emissão</th><th>Situação</th><th>Data de Vencimento</th><th>Fornecedor</th><th>Tipo</th><th>Valor</th></tr></thead><tbody><tr>
  <td>${esc(item.unidade)}</td><td>${esc(item.documento)}</td><td>${esc(bancarios)}</td><td>${esc(item.pedido)}</td><td>${esc(item.emissao)}</td><td>Aprovado</td><td>${esc(item.vencimento)}</td><td>${esc(item.nome)}</td><td>${esc(item.natureza)}</td><td>R$ ${esc(formatarValor(item.valor))}</td></tr></tbody></table>
  <p style="margin-top: 24px;">Atenciosamente,<br/><strong>${esc(assinatura)}</strong></p></div>`;
}

function rotaDa(item: Item): Rota {
  const pag = chavePagador(item.pagador);
  // 19/11/2026 (Gustavo): Remessa vai por e-mail ao fiscal da unidade da nota (como na Expansão), qualquer que seja o Pagador.
  if (item.natureza === "Remessa") return { tipo: "fiscal" };
  if (pag === "holding") return item.unidade === UNIDADE_PINHAL ? { tipo: "pinhal" } : { tipo: "sharepoint" };
  if (PLANILHA_AZUL[pag]) return { tipo: "azul", empresa: PLANILHA_AZUL[pag] };
  if (pag === "tag") return { tipo: "nao", motivo: "nota com Pagador Tag vai para o painel da TAG, não para a escrituração" };
  return { tipo: "nao", motivo: item.pagador ? `o Pagador "${item.pagador}" não vai para escrituração` : "a nota está sem Pagador (escolha o Pagador no campo logo acima do botão)" };
}
const dataBr = (iso: string) => String(iso ?? "").slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
// "Planilha Azul": as colunas da planilha que a Beatriz mandava (função antiga da Engenharia).
function montarHtmlPlanilhaAzul(empresa: string, item: Item, assinatura: string): string {
  const temBoleto = item.anexos.some((a) => a.filename.toUpperCase().includes("BOLETO"));
  const pagamento = temBoleto ? "Boleto" : [item.forma, item.dadosBancarios].filter(Boolean).join(" - ");
  const fornecedor = item.nome.replace(/\s+-\s+(NOTA|CTE)\b[^-]*$/i, "").trim();
  const cab = ["EMPRESA", "FORNECEDOR", "PEDIDO", "N°NF", "DT EMISSÃO", "VENCIMENTO", "PAGAMENTO", "AUTORIZAÇÃO"];
  const lin = [empresa, fornecedor, item.pedido, item.documento, dataBr(item.emissao), dataBr(item.vencimento), pagamento, "SIM"];
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;"><p>Boa tarde, prezados!<br/>Tudo bem?</p><p>Segue notas:</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;"><thead style="background-color: #2f5233; color: white;"><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody><tr>${lin.map((c) => `<td>${esc(c)}</td>`).join("")}</tr></tbody></table>
  <p style="margin-top: 24px;">Atenciosamente,<br/><strong>${esc(assinatura)}</strong></p></div>`;
}

type Pessoa = { nome: string; email: string };
// 18/11/2026: mesma regra da tela. Está em escrituração quem tem a etapa "escrituracao" no painel OU, sem registro no painel,
// a etapa "escrituracao" da Monday (é o caso da NF 74 que a prévia não mostrou).
async function notasEmEscrituracao(): Promise<Map<string, any>> {
  // 19/11/2026: antes lia TODAS as linhas de aprovacoes_notas numa consulta só; o banco devolve no máximo 1.000 e a tabela passou de
  // 1.000 com a cópia da Monday (18/11). O lote via só parte das notas e podia tratar nota já enviada como "sem registro".
  // Agora busca só as que estão em escrituração e confere, em blocos, quais notas da cópia antiga já têm registro no painel.
  const ids = new Map<string, any>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("aprovacoes_notas").select("*").eq("etapa", "escrituracao").order("nota_id").range(de, de + 999);
    if (error) throw new Error("não consegui ler as notas em escrituração: " + error.message);
    for (const a of data ?? []) ids.set(a.nota_id, a);
    if (!data || data.length < 1000) break;
  }
  const candidatos: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("monday_espelho").select("item_id,lancamento_id").eq("etapa", "escrituracao").order("item_id").range(de, de + 999);
    if (error) throw new Error("não consegui ler a cópia antiga: " + error.message);
    for (const m of data ?? []) { const id = m.lancamento_id || "M" + m.item_id; if (!ids.has(id)) candidatos.push(id); }
    if (!data || data.length < 1000) break;
  }
  for (let i = 0; i < candidatos.length; i += 150) {
    const bloco = candidatos.slice(i, i + 150);
    const { data, error } = await sb.from("aprovacoes_notas").select("nota_id").in("nota_id", bloco);
    if (error) throw new Error("não consegui conferir os registros: " + error.message);
    const tem = new Set((data ?? []).map((x) => x.nota_id));
    for (const id of bloco) if (!tem.has(id)) ids.set(id, null);
  }
  return ids;
}
async function garantirLinha(notaId: string): Promise<void> {
  await sb.from("aprovacoes_notas").upsert({ nota_id: notaId, etapa: "escrituracao", historico: ["Na escrituração (vinda da Monday, sem registro no painel)"] }, { onConflict: "nota_id", ignoreDuplicates: true });
}
// 19/11/2026 (lote travando): "pre" traz a análise e a nota já montadas pelo lote, para não montar de novo nem reler a escrituração inteira.
async function enviar(notaId: string, pessoa: Pessoa, emitenteManual: string, simular: boolean, reenvio: boolean, pre?: { ap: any; item: Item }): Promise<{ corpo: Record<string, unknown>; status: number }> {
  const real = (Deno.env.get("ESCRITURACAO_EMAIL_MODO") || "").toLowerCase() === "real" && !simular;
  let ap: any = pre ? pre.ap : (await sb.from("aprovacoes_notas").select("*").eq("nota_id", notaId).maybeSingle()).data;
  if (!ap && (pre || (await notasEmEscrituracao()).has(notaId))) { if (!simular) await garantirLinha(notaId); ap = { nota_id: notaId, etapa: "escrituracao", historico: [], campos: {} }; }
  if (!ap || ap.etapa !== "escrituracao") return { corpo: { erro: "A nota precisa estar pronta para escriturar (etapa Escrituração)." }, status: 409 };
  const item0 = pre ? pre.item : await montarItem(notaId, ap);
  if ("erro" in item0) return { corpo: { erro: item0.erro }, status: item0.status };
  const item = item0;
  if (emitenteManual) item.emitente = emitenteManual;

  // Data de envio (17/11/2026): como a coluna "Data de envio" da Monday. Fica na própria nota do painel (aprovacoes_notas.data_envio),
  // vale para nota do lançamento e para nota que veio da Monday, e é preenchida com a data do dia no clique (só no envio real).
  const { data: lc } = await sb.from("lancamentos").select("data_envio").eq("id", notaId).maybeSingle();
  const dataJaEnviada = ap.data_envio || lc?.data_envio || null;
  // 19/11/2026 (Gustavo): nota que já foi enviada não fica parada na Escrituração. Vai para Encaminhadas, sem mandar de novo.
  // (Para reenviar de propósito, a nota volta pelo "Voltar para escrituração e corrigir" ou pelo "Voltar para Aprovações": fica marcada para reenvio.)
  if (real && dataJaEnviada && !reenvio) {
    const quando = String(dataJaEnviada).slice(0, 10).split("-").reverse().join("/");
    const linhaJa = `Já tinha sido enviada para escriturar em ${quando}: movida para Encaminhadas (não foi enviada de novo) · ${agoraBR()} · ${pessoa.nome}`;
    const { data: apAtual } = await sb.from("aprovacoes_notas").select("historico, versao").eq("nota_id", notaId).maybeSingle();
    await sb.from("aprovacoes_notas").update({ etapa: "encaminhada", historico: [...(apAtual?.historico ?? []), linhaJa], versao: (apAtual?.versao ?? 0) + 1, atualizado_em: new Date().toISOString() }).eq("nota_id", notaId);
    return { corpo: { ok: true, etapa: "encaminhada", mensagem: `A nota já tinha sido enviada em ${quando}. Ela foi para Encaminhadas (não mandei de novo).` }, status: 200 };
  }
  const dataEnvio = hojeISO();
  const rota = rotaDa(item);
  if (rota.tipo === "nao") return { corpo: { erro: `Não enviei a nota ${item.documento}: ${rota.motivo}.` }, status: 409 };
  const porEmail = rota.tipo === "pinhal" || rota.tipo === "azul" || rota.tipo === "fiscal";
  const nomeEnviou = EQUIPE_COPIA[pessoa.email] ?? pessoa.nome;
  let destino = "", destinos: string[] = [], cc: string[] = [], assunto = "", html = "", dadosSharepoint: Record<string, unknown> | null = null;

  if (porEmail && rota.tipo === "azul") {
    if (!real && !REVIEW_EMAIL) return { corpo: { erro: "Prévia sem REVIEW_EMAIL configurado." }, status: 409 };
    destinos = real ? PLANILHA_AZUL_PARA : [REVIEW_EMAIL];
    cc = [];
    const mesAno = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).toUpperCase();
    assunto = `${real ? "" : "[TESTE] "}NOTAS FISCAIS ${rota.empresa} | ${mesAno}`;
    html = montarHtmlPlanilhaAzul(rota.empresa, item, `${nomeEnviou} — Empresa Exemplo`);
  } else if (porEmail) {
    const { data: f } = await sb.from("fiscais_unidade").select("email_fiscal, emails_cc").eq("unidade", item.unidade).maybeSingle();
    if (!item.unidade) return { corpo: { erro: `A nota ${item.documento} está sem Unidade: preencha a Unidade em "Corrigir dados da nota" e envie de novo. Nada foi enviado.` }, status: 409 };
    if (real && !f?.email_fiscal) return { corpo: { erro: `A unidade ${item.unidade || "(vazia)"} não tem e-mail de fiscal cadastrado. Nada foi enviado.` }, status: 409 };
    if (!real && !REVIEW_EMAIL) return { corpo: { erro: "Prévia sem REVIEW_EMAIL configurado." }, status: 409 };
    destino = real ? f!.email_fiscal : REVIEW_EMAIL;
    cc = real ? [...new Set([...(f?.emails_cc ?? []), ...Object.keys(EQUIPE_COPIA), pessoa.email])] : [];
    const mesAno = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).toUpperCase();
    assunto = `${real ? "" : "[TESTE] "}NOTAS FISCAIS ${item.unidade.split(" - ")[1] ?? item.unidade} | ${mesAno}`;
    html = montarHtmlFiscal(item, `${nomeEnviou} — Empresa Exemplo`);
  } else {
    const proprios = (Deno.env.get("ESCRITURAR_FLUXO_PROPRIO") || "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
    const proprio = proprios.includes(pessoa.email);
    const caixa = (Deno.env.get("ESCRITURAR_CAIXA_PA") || "").trim();
    if (real && !proprio && !caixa) return { corpo: { erro: "A caixa do fluxo do SharePoint não está configurada. Nada foi enviado." }, status: 409 };
    if (!real && !REVIEW_EMAIL) return { corpo: { erro: "Prévia sem REVIEW_EMAIL configurado." }, status: 409 };
    // 19/11/2026: lista TUDO o que falta numa mensagem só (antes era um motivo por clique).
    const faltas: string[] = [];
    if (!item.anexos.length) faltas.push("a nota não tem anexo (o fluxo do SharePoint só aceita nota com anexo)");
    const em = await codigoDoEmitente(item.cnpj, item.emitente);
    if ("erro" in em) faltas.push(em.erro);
    const estab = ESTABELECIMENTO_NA_LISTA[item.unidade]; if (!estab) faltas.push(`a Unidade "${item.unidade || "(vazia)"}" (corrija em Corrigir dados da nota)`);
    const classe = CLASSIFICACAO_POR_NATUREZA[item.natureza]; if (!classe) faltas.push(`a Natureza "${item.natureza || "(vazia)"}" não vale para o SharePoint (use Material, Serviço, Fatura ou CTE)`);
    const forma = FORMA_PAGAMENTO_NA_LISTA[item.forma]; if (!forma) faltas.push(`o Pagamento "${item.forma || "(vazio)"}" (corrija em Corrigir dados da nota)`);
    if (faltas.length || "erro" in em || !estab || !classe || !forma) return { corpo: { erro: `Não enviei a nota ${item.documento} ao SharePoint. Falta corrigir: ${faltas.join("; ")}. Nada foi enviado.` }, status: 409 };
    dadosSharepoint = { pedido: item.pedido, nf: item.documento, serie: SERIE_PADRAO, emitente: em.codigo, estabelecimento: estab, emissao: item.emissao, vencimento: item.vencimento,
      modalidade: classe.modalidade, finalidade: classe.finalidade, forma_pagamento: forma, dados_pagamento: item.dadosBancarios.replace(/\s+/g, " ").trim(),
      razao_social: item.nome.replace(/\s+-\s+(NOTA|CTE)\b[^-]*$/i, "").trim(), parcelas: "", data_envio: dataEnvio, enviado_por: nomeEnviou, enviado_por_email: pessoa.email };
    html = JSON.stringify(dadosSharepoint, null, 1).split("\n").map((l) => `<p>${esc(l)}</p>`).join("");
    destino = real ? (proprio ? pessoa.email : caixa) : REVIEW_EMAIL;
    assunto = real ? `[ESCRITURAR] ${item.nome} — enviado por ${nomeEnviou}` : `[PRÉVIA] envio ao SharePoint - ${item.nome} — enviado por ${nomeEnviou}`;
  }

  const caminho = rota.tipo === "azul" ? "e-mail da Planilha Azul" : porEmail ? "e-mail ao fiscal" : "SharePoint";
  if (simular) return { corpo: { ok: true, simulado: true, caminho, modo: real ? "real" : "prévia", destino: destinos.length ? destinos : destino, cc, assunto, anexos: item.anexos.map((a) => a.filename), dados: dadosSharepoint }, status: 200 };

  // Marca antes de enviar (dois cliques não geram dois envios); se falhar, desmarca.
  if (real) {
    await sb.from("aprovacoes_notas").update({ data_envio: dataEnvio }).eq("nota_id", notaId);
    if (item.origem === "lancamento") await sb.from("lancamentos").update({ data_envio: dataEnvio }).eq("id", notaId);
  }
  try {
    const anexos = await baixarAnexos(item);
    if (!anexos.length && !porEmail) throw new Error("nenhum anexo pôde ser baixado, e o fluxo só aceita e-mail com anexo");
    await enviarEmail(destinos.length ? destinos : destino, cc, assunto, html, anexos, porEmail ? pessoa.email : undefined);
  } catch (e) {
    if (real) {
      await sb.from("aprovacoes_notas").update({ data_envio: ap.data_envio ?? null }).eq("nota_id", notaId);
      if (item.origem === "lancamento") await sb.from("lancamentos").update({ data_envio: lc?.data_envio ?? null }).eq("id", notaId);
    }
    return { corpo: { erro: `FALHOU o envio da nota ${item.documento}: ${(e as Error).message}` }, status: 502 };
  }
  if (!real) return { corpo: { ok: true, mensagem: `PRÉVIA: os dados da nota ${item.documento} foram mandados só para ${destinos.length ? destinos.join(", ") : destino}. Nada foi marcado como enviado.` }, status: 200 };

  // Enviada: sai de Escrituração e vai para Encaminhadas. O retorno (aprovada ou recusada) é registrado no histórico depois.
  const etapa = porEmail ? "fiscal" : "encaminhada";
  const linha = `Enviada para escrituração (${caminho}) · ${agoraBR()} · ${nomeEnviou}${reenvio ? " (reenvio após correção)" : ""}`;
  await sb.from("aprovacoes_notas").update({ etapa, decisao: null, aguarda_reenvio: false, historico: [...(ap.historico ?? []), linha], data_envio: dataEnvio, versao: (ap.versao ?? 0) + 1, por_email: pessoa.email, por_nome: nomeEnviou, atualizado_em: new Date().toISOString() }).eq("nota_id", notaId);
  return { corpo: { ok: true, etapa, mensagem: `Nota ${item.documento} enviada para escrituração (${caminho}). Ela foi para Encaminhadas.` }, status: 200 };
}

// ---------- Envio em lote por base (18/11/2026, pedido da Beatriz) ----------
// Uma tabela por base (Pinhal, Parceira, Empresa Exemplo, Condomínio Lago) com todas as notas da escrituração dessa base num e-mail só.
// lote = "pinhal" | "parceira" | "vale" | "lago" | "todas". simular = true só monta a prévia: não envia e não marca nada.
const BASES_LOTE = ["pinhal", "parceira", "vale", "lago"] as const;
type Base = typeof BASES_LOTE[number];
const NOME_BASE: Record<Base, string> = { pinhal: "PINHAL", parceira: "PARCEIRA", vale: "EMPRESA EXEMPLO", lago: "LAGO" };
function baseDaRota(rota: Rota): Base | null {
  if (rota.tipo === "pinhal") return "pinhal";
  if (rota.tipo === "azul") {
    if (rota.empresa === "PARCEIRA") return "parceira";
    if (rota.empresa === "EMPRESA EXEMPLO") return "vale";
    if (rota.empresa === "LAGO") return "lago";
  }
  return null;
}
function tabelaLote(cabecalho: string[], linhas: string[][], assinatura: string, ids: string[] = []): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;"><p>Boa tarde, prezados!<br/>Tudo bem?</p><p>Segue notas:</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;"><thead style="background-color: #2f5233; color: white;"><tr>${cabecalho.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${linhas.map((l, i) => `<tr${ids[i] ? ` data-nota="${esc(ids[i])}"` : ""}>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <p style="margin-top: 24px;">Atenciosamente,<br/><strong>${esc(assinatura)}</strong></p></div>`;
}
function linhasLote(base: Base, items: Item[]): { cabecalho: string[]; linhas: string[][] } {
  if (base === "pinhal") {
    return {
      cabecalho: ["Unidade", "Nota", "Dados Bancários", "Pedido", "Emissão", "Situação", "Data de Vencimento", "Fornecedor", "Tipo", "Valor"],
      linhas: items.map((item) => {
        const temBoleto = item.anexos.some((a) => a.filename.toUpperCase().includes("BOLETO"));
        const bancarios = temBoleto ? "BOLETO" : item.dadosBancarios || (item.natureza === "Remessa" ? "Não necessário pagamento" : "");
        return [item.unidade, item.documento, bancarios, item.pedido, item.emissao, "Aprovado", item.vencimento, item.nome, item.natureza, `R$ ${formatarValor(item.valor)}`];
      }),
    };
  }
  return {
    cabecalho: ["EMPRESA", "FORNECEDOR", "PEDIDO", "N°NF", "DT EMISSÃO", "VENCIMENTO", "PAGAMENTO", "AUTORIZAÇÃO"],
    linhas: items.map((item) => {
      const temBoleto = item.anexos.some((a) => a.filename.toUpperCase().includes("BOLETO"));
      const pagamento = temBoleto ? "Boleto" : [item.forma, item.dadosBancarios].filter(Boolean).join(" - ");
      const fornecedor = item.nome.replace(/\s+-\s+(NOTA|CTE)\b[^-]*$/i, "").trim();
      return [NOME_BASE[base], fornecedor, item.pedido, item.documento, dataBr(item.emissao), dataBr(item.vencimento), pagamento, "SIM"];
    }),
  };
}
async function anexosDoLote(items: Item[]): Promise<{ filename: string; content: string }[]> {
  const vistos = new Set<string>(), out: { filename: string; content: string }[] = [];
  for (const it of items) for (const a of await baixarAnexos(it)) { if (vistos.has(a.content)) continue; vistos.add(a.content); out.push(a); }
  return out;
}
const ROTULO_BASE: Record<Base, string> = { pinhal: "Pinhal", parceira: "Parceira", vale: "Empresa Exemplo", lago: "Condomínio Lago" };
// 19/11/2026 (Beatriz: "o botão de enviar tudo de uma vez não funcionava"): o "Enviar agora" nunca liberava porque a prévia respondia
// "modo prévia" só por ser prévia (agora responde o modo configurado). E o lote passa a cobrir tudo o que está na Escrituração:
//   bases por e-mail (Pinhal, Parceira, Empresa Exemplo, Lago) · Remessa: um e-mail por unidade ao fiscal ·
//   SharePoint (Holding): uma nota por vez, pelo mesmo envio do botão da nota. Nota com dado faltando aparece com o motivo e não sai.
const fornecedorDe = (it: Item) => it.nome.replace(/\s+-\s+(NOTA|CTE)\b[^-]*$/i, "").trim();
// 19/11/2026: cada nota do lote vai para a tela com código, NF, fornecedor e valor (para o botão "−" tirar uma nota do envio).
const resumoNota = (it: Item) => ({ id: it.id, nf: it.documento, fornecedor: fornecedorDe(it), valor: Number(it.valor || 0), unidade: it.unidade });
// Várias notas ao mesmo tempo (antes uma por vez: com muitas notas a prévia e o envio demoravam e pareciam travados).
async function emParalelo<T, R>(lista: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(lista.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => { while (i < lista.length) { const k = i++; out[k] = await f(lista[k]); } }));
  return out;
}
async function enviarGrupoEmail(doGrupo: Item[], apPorNota: Map<string, any>, para: string[], cc: string[], assunto: string, html: string, etapa: string, rotuloLinha: string, pessoa: Pessoa): Promise<string | null> {
  const anexos = await anexosDoLote(doGrupo);
  const dataEnvio = hojeISO();
  for (const it of doGrupo) if (!apPorNota.get(it.id)) await garantirLinha(it.id);
  for (const it of doGrupo) await sb.from("aprovacoes_notas").update({ data_envio: dataEnvio }).eq("nota_id", it.id);
  try {
    await enviarEmail(para, cc, assunto, html, anexos, undefined);
  } catch (e) {
    for (const it of doGrupo) await sb.from("aprovacoes_notas").update({ data_envio: apPorNota.get(it.id)?.data_envio ?? null }).eq("nota_id", it.id);
    return "falhou o envio: " + (e as Error).message;
  }
  const linha = `${rotuloLinha} · ${agoraBR()} · ${pessoa.nome}`;
  for (const it of doGrupo) {
    const { data: ap } = await sb.from("aprovacoes_notas").select("historico, versao").eq("nota_id", it.id).maybeSingle();
    await sb.from("aprovacoes_notas").update({
      etapa, decisao: null, aguarda_reenvio: false, historico: [...(ap?.historico ?? []), linha], data_envio: dataEnvio, versao: (ap?.versao ?? 0) + 1,
      por_email: pessoa.email, por_nome: pessoa.nome, atualizado_em: new Date().toISOString(),
    }).eq("nota_id", it.id);
    if (it.origem === "lancamento") await sb.from("lancamentos").update({ data_envio: dataEnvio }).eq("id", it.id);
  }
  return null;
}
// excluir: notas que a pessoa tirou do envio com o "−" (ficam na Escrituração para resolver depois).
async function enviarLotes(lote: string, pessoa: Pessoa, simular: boolean, excluir: string[] = []): Promise<{ corpo: Record<string, unknown>; status: number }> {
  // Prévia (simular): NADA é enviado. "modo" diz se o envio real está ligado, para a tela liberar o "Enviar agora".
  const modoReal = (Deno.env.get("ESCRITURACAO_EMAIL_MODO") || "").toLowerCase() === "real";
  const real = modoReal && !simular;
  const modo = modoReal ? "real" : "prévia";
  const todas = lote === "todas";
  const escolhidas: Base[] = todas ? [...BASES_LOTE] : (BASES_LOTE as readonly string[]).includes(lote) ? [lote as Base] : [];
  if (!escolhidas.length) return { corpo: { erro: `Base desconhecida: ${lote}` }, status: 400 };
  const naEscrituracao = await notasEmEscrituracao();
  const apPorNota = new Map<string, any>(), itens: Item[] = [], problemas: string[] = [];
  const tirar = new Set(excluir.map(String));
  const entradas = [...naEscrituracao].filter(([id]) => !tirar.has(id));
  const montados = await emParalelo(entradas, 6, async ([id, ap]) => ({ id, ap, it: await montarItem(id, ap) }));
  for (const { id, ap, it } of montados) {
    apPorNota.set(id, ap);
    if ("erro" in it) { problemas.push(`${id}: ${it.erro}`); continue; }
    itens.push(it);
  }
  const resultados: Record<string, unknown>[] = [];
  const mesAno = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).toUpperCase();
  const soma = (l: Item[]) => l.reduce((s, it) => s + Number(it.valor || 0), 0);

  // 1) Bases por e-mail (Pinhal ao fiscal; Parceira, Empresa Exemplo e Lago na Planilha Azul).
  for (const base of escolhidas) {
    const doBase = itens.filter((it) => baseDaRota(rotaDa(it)) === base);
    const rotulo = ROTULO_BASE[base];
    if (!doBase.length) { resultados.push({ base, rotulo, ok: false, motivo: "nenhuma nota desta base na escrituração" }); continue; }
    let para: string[] = [], cc: string[] = [];
    if (base === "pinhal") {
      const { data: f } = await sb.from("fiscais_unidade").select("email_fiscal, emails_cc").eq("unidade", UNIDADE_PINHAL).maybeSingle();
      if (!f?.email_fiscal) { resultados.push({ base, rotulo, ok: false, motivo: "a unidade Pinhal não tem e-mail de fiscal cadastrado" }); continue; }
      para = [f.email_fiscal];
      cc = [...new Set([...(f?.emails_cc ?? []), ...Object.keys(EQUIPE_COPIA), pessoa.email])];
    } else {
      para = [...PLANILHA_AZUL_PARA];
    }
    const assunto = `NOTAS FISCAIS ${NOME_BASE[base]} | ${mesAno}`;
    const { cabecalho, linhas } = linhasLote(base, doBase);
    const html = tabelaLote(cabecalho, linhas, `${pessoa.nome} — Empresa Exemplo`, doBase.map((it) => it.id));
    const resumo = { base, rotulo, quantidade: doBase.length, valor: soma(doBase), notas: doBase.map((it) => it.documento), itens: doBase.map(resumoNota), para, cc, assunto, modo, html };
    if (!real) { resultados.push({ ...resumo, ok: true, simulado: true }); continue; }
    const falha = await enviarGrupoEmail(doBase, apPorNota, para, cc, assunto, html, base === "pinhal" ? "fiscal" : "encaminhada", `Enviada em lote por e-mail (${NOME_BASE[base]})`, pessoa);
    resultados.push(falha ? { ...resumo, ok: false, motivo: falha } : { ...resumo, ok: true, enviado: true });
  }
  if (!todas) return { corpo: { ok: true, modo, simulado: simular, resultados, problemas, fora: [] }, status: 200 };

  // 2) Remessa: um e-mail por unidade, ao fiscal da unidade.
  const porUnidade = new Map<string, Item[]>();
  for (const it of itens.filter((x) => rotaDa(x).tipo === "fiscal")) { const u = it.unidade || ""; if (!porUnidade.has(u)) porUnidade.set(u, []); porUnidade.get(u)!.push(it); }
  for (const [unidade, doGrupo] of porUnidade) {
    const rotulo = `Remessa · ${unidade || "sem Unidade"}`, base = "remessa:" + (unidade || "sem-unidade");
    if (!unidade) { resultados.push({ base, rotulo, ok: false, quantidade: doGrupo.length, itens: doGrupo.map(resumoNota), motivo: `preencha a Unidade em "Corrigir dados da nota" (NF ${doGrupo.map((it) => it.documento).join(", ")})` }); continue; }
    const { data: f } = await sb.from("fiscais_unidade").select("email_fiscal, emails_cc").eq("unidade", unidade).maybeSingle();
    if (!f?.email_fiscal) { resultados.push({ base, rotulo, ok: false, quantidade: doGrupo.length, itens: doGrupo.map(resumoNota), motivo: `a unidade ${unidade} não tem e-mail de fiscal cadastrado` }); continue; }
    const para = [f.email_fiscal], cc = [...new Set([...(f.emails_cc ?? []), ...Object.keys(EQUIPE_COPIA), pessoa.email])];
    const assunto = `NOTAS FISCAIS ${unidade.split(" - ")[1] ?? unidade} | ${mesAno}`;
    const { cabecalho, linhas } = linhasLote("pinhal", doGrupo);
    const html = tabelaLote(cabecalho, linhas, `${pessoa.nome} — Empresa Exemplo`, doGrupo.map((it) => it.id));
    const resumo = { base, rotulo, quantidade: doGrupo.length, valor: soma(doGrupo), notas: doGrupo.map((it) => it.documento), itens: doGrupo.map(resumoNota), para, cc, assunto, modo, html };
    if (!real) { resultados.push({ ...resumo, ok: true, simulado: true }); continue; }
    const falha = await enviarGrupoEmail(doGrupo, apPorNota, para, cc, assunto, html, "fiscal", `Remessa enviada em lote por e-mail ao fiscal (${unidade})`, pessoa);
    resultados.push(falha ? { ...resumo, ok: false, motivo: falha } : { ...resumo, ok: true, enviado: true });
  }

  // 3) SharePoint (Holding): confere cada nota com as mesmas regras do botão da nota; as prontas saem uma por vez.
  const sp = itens.filter((x) => rotaDa(x).tipo === "sharepoint");
  if (sp.length) {
    const checagem: { it: Item; ok: boolean; motivo: string }[] = await emParalelo(sp, 6, async (it) => {
      const r = await enviar(it.id, pessoa, "", true, false, { ap: apPorNota.get(it.id), item: it });
      const c = r.corpo as { ok?: boolean; erro?: string };
      return { it, ok: !!c.ok, motivo: String(c.erro || "").replace(/^Não enviei a nota [^.:]*(ao SharePoint)?[.:]\s*/i, "").replace(/\s*Nada foi enviado\.?$/i, "") };
    });
    const prontas = checagem.filter((c) => c.ok).map((c) => c.it);
    const html = tabelaLote(["NF", "Fornecedor", "Unidade", "Valor", "Situação"],
      checagem.map((c) => [c.it.documento, fornecedorDe(c.it), c.it.unidade, `R$ ${formatarValor(c.it.valor)}`, c.ok ? "Pronta" : "Falta: " + c.motivo]), `${pessoa.nome} — Empresa Exemplo`, checagem.map((c) => c.it.id));
    const resumo = { base: "sharepoint", rotulo: `SharePoint (Holding) · ${prontas.length} de ${sp.length} prontas, uma por e-mail`, quantidade: prontas.length, valor: soma(prontas),
      notas: prontas.map((it) => it.documento), itens: prontas.map(resumoNota), pendentesItens: checagem.filter((c) => !c.ok).map((c) => ({ ...resumoNota(c.it), motivo: c.motivo })),
      para: ["fluxo do SharePoint (Lista Validações)"], cc: [], assunto: "[ESCRITURAR] uma mensagem por nota", modo, html };
    const pendentes = checagem.filter((c) => !c.ok).map((c) => `NF ${c.it.documento}: ${c.motivo}`);
    if (!prontas.length) resultados.push({ ...resumo, ok: false, motivo: "nenhuma nota pronta. " + pendentes.join(" · ") });
    else if (!real) resultados.push({ ...resumo, ok: true, simulado: true, pendentes });
    else {
      let enviadas = 0; const falhas: string[] = [];
      const envios = await emParalelo(prontas, 3, async (it) => {
        const ap = apPorNota.get(it.id);
        const r = await enviar(it.id, pessoa, "", false, !!ap?.aguarda_reenvio, { ap, item: it });
        return { it, c: r.corpo as { ok?: boolean; erro?: string } };
      });
      for (const { it, c } of envios) { if (c.ok) enviadas++; else falhas.push(`NF ${it.documento}: ${c.erro}`); }
      resultados.push({ ...resumo, quantidade: enviadas, ok: enviadas > 0, enviado: enviadas > 0, motivo: falhas.join(" · ") || undefined });
    }
  }

  // 4) O que não sai por aqui (Pagador Tag vai para a TAG; sem Pagador ou Pagador sem escrituração), com o motivo.
  const fora = itens.filter((it) => rotaDa(it).tipo === "nao").map((it) => ({ nota: it.documento, unidade: it.unidade, pagador: it.pagador, valor: it.valor, motivo: (rotaDa(it) as { motivo: string }).motivo }));
  return { corpo: { ok: true, modo, simulado: simular, resultados, problemas, fora }, status: 200 };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem } = await sb.auth.getUser(jwt);
    const email = quem?.user?.email?.toLowerCase();
    if (!email) return resposta({ erro: "Faça login novamente." }, 401);
    const { data: perfil } = await sb.from("painel_perfis").select("equipe").eq("email", email).maybeSingle();
    if (!["admin", "administrativo"].includes(perfil?.equipe)) return resposta({ erro: "Envio para escriturar é da equipe administrativa." }, 403);
    const nome = quem.user.user_metadata?.nome || email.split("@")[0];
    const corpoReq = await req.json();
    if (corpoReq.lote) { const rl = await enviarLotes(String(corpoReq.lote), { nome, email }, corpoReq.simular === true, Array.isArray(corpoReq.excluir) ? corpoReq.excluir : []); return resposta(rl.corpo, rl.status); }
    const { nota_id, emitente, simular, preparar } = corpoReq;
    const notaId = String(nota_id || "");
    // 18/11/2026: preparar=true só deixa os arquivos da nota copiados no painel (usado antes de mandar a nota para a TAG). Não envia nada.
    if (preparar === true) { const apP = (await sb.from("aprovacoes_notas").select("*").eq("nota_id", notaId).maybeSingle()).data; const it = await montarItem(notaId, apP); return resposta("erro" in it ? { erro: it.erro } : { ok: true, anexos: it.anexos.length }, "erro" in it ? it.status : 200); }
    const { data: ap } = await sb.from("aprovacoes_notas").select("aguarda_reenvio").eq("nota_id", notaId).maybeSingle();
    const r = await enviar(notaId, { nome, email }, String(emitente || "").trim(), simular === true, !!ap?.aguarda_reenvio);
    return resposta(r.corpo, r.status);
  } catch (e) {
    return resposta({ erro: String((e as Error).message || e) }, 500);
  }
});
