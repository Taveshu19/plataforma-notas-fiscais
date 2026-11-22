// tag-api — API da TAG real (16/11/2026). Substitui o server.mjs local: mesmas rotas, agora sobre o banco da Engenharia.
// Quem pode LER: qualquer login com equipe no painel (admin, administrativo, engenharia, tag) ou editor. Quem pode EDITAR: só
// otavio.reis@holding.exemplo e backoffice@investidora.exemplo, e só depois de trocar a senha inicial.
// O site publica /api/* e /files/* apontando para esta função. Não chama a API da Monday.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { TagStore, httpError, lean } from "./tag-store.mjs";
import { BOARD, GROUPS, DEPARTMENTS, CATEGORIES, PAYMENTS, PAYERS, DUE_COLUMNS, OTAVIO_LABELS, PAYMENT_STATUS_LABELS } from "./catalog.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
function chaveServico(): string {
  try { const nova = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"]; if (nova) return nova; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const sb = createClient(SUPABASE_URL, chaveServico(), { auth: { persistSession: false } });

const EDITORES = new Set(["otavio.reis@holding.exemplo", "backoffice@investidora.exemplo", "gustavo@empresa.exemplo"]);   // + Gustavo (16/11): tem permissão para tudo nos painéis
const EQUIPES_LEITURA = ["admin", "administrativo", "expansao", "tag"];
const ORIGEM_SITE = "https://seu-site.netlify.app";
const MAX_CORPO = 20 * 1024 * 1024;

const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", xml: "application/xml", txt: "text/plain; charset=utf-8" };
const CABECALHOS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

async function enviarEmailGraph(para: string[], assunto: string, texto: string) {
  const t = Deno.env.get("GRAPH_TENANT_ID"), id = Deno.env.get("GRAPH_CLIENT_ID"), seg = Deno.env.get("GRAPH_CLIENT_SECRET"), caixa = Deno.env.get("GRAPH_SENDER_MAILBOX");
  if (!t || !id || !seg || !caixa) throw new Error("Graph não configurado nesta base");
  const r = await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: seg, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }) });
  const j = await r.json(); if (!r.ok) throw new Error("token Graph: " + JSON.stringify(j).slice(0, 200));
  const env = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(caixa)}/sendMail`, { method: "POST", headers: { Authorization: `Bearer ${j.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ saveToSentItems: true, message: { subject: assunto, body: { contentType: "Text", content: texto }, toRecipients: para.map((e) => ({ emailAddress: { address: e } })) } }) });
  if (!env.ok) throw new Error("envio Graph: " + (await env.text()).slice(0, 200));
}

// ---------- repositório (tag_notas, tag_eventos, tag_automacoes, tag_outbox, tag_meta e o bucket) ----------
async function paginar(consulta: () => any): Promise<any[]> {
  const linhas: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}
const repo = {
  async getNota(id: string) { const { data, error } = await sb.from("tag_notas").select("doc").eq("id", id).maybeSingle(); if (error) throw new Error(error.message); return data?.doc ?? null; },
  async deleteNota(id: string) { const { error } = await sb.from("tag_notas").delete().eq("id", id); if (error) throw new Error(error.message); },
  async listLeves() { return (await paginar(() => sb.from("tag_notas").select("leve").order("id"))).map((r) => r.leve); },
  async saveNota(doc: any, leve: any) {
    const { error } = await sb.from("tag_notas").upsert({ id: doc.id, doc, leve, grupo_id: doc.groupId ?? null, origem_id: doc.origemId ?? null, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
  },
  async addEvento(rec: any) { const { error } = await sb.from("tag_eventos").insert({ id: rec.id, em: rec.at, ator: rec.actor ?? null, tipo: rec.type, item_id: rec.itemId ?? null, doc: rec }); if (error) throw new Error(error.message); },
  async listEventos({ itemId, limit }: { itemId?: string | null; limit: number }) {
    let q = sb.from("tag_eventos").select("doc").order("em", { ascending: false }).limit(limit);
    if (itemId) q = q.eq("item_id", itemId);
    const { data, error } = await q; if (error) throw new Error(error.message); return data.map((r: any) => r.doc);
  },
  async getAutomacoes() { const { data, error } = await sb.from("tag_automacoes").select("id, ativa"); if (error) throw new Error(error.message); return Object.fromEntries(data.map((r: any) => [r.id, r.ativa])); },
  async setAutomacao(id: string, ativa: boolean) { const { error } = await sb.from("tag_automacoes").upsert({ id, ativa }); if (error) throw new Error(error.message); },
  // 18/11/2026: o e-mail da fila sai de verdade (reprovação → Beatriz), pela caixa do painel (Microsoft Graph). Falha no envio fica registrada, não trava a reprovação.
  async addOutbox(rec: any) {
    if (Array.isArray(rec.to) && rec.to.length) {
      try { await enviarEmailGraph(rec.to, rec.subject, rec.body); rec.status = "enviado"; rec.enviadoEm = new Date().toISOString(); }
      catch (e) { rec.status = "erro"; rec.erro = String((e as Error).message || e).slice(0, 300); console.error("tag-api e-mail:", rec.erro); }
    }
    const { error } = await sb.from("tag_outbox").insert({ id: rec.id, em: rec.at, doc: rec }); if (error) throw new Error(error.message);
  },
  async listOutbox() { const { data, error } = await sb.from("tag_outbox").select("doc").order("em", { ascending: false }).limit(500); if (error) throw new Error(error.message); return data.map((r: any) => r.doc); },
  async getMeta(chave: string) { const { data } = await sb.from("tag_meta").select("valor").eq("chave", chave).maybeSingle(); return data?.valor ?? null; },
  async storeFile(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType, upsert: true }); if (error) throw new Error("Arquivo: " + error.message);
  },
};

// ---------- identidade ----------
type Ator = { email: string; canRead: boolean; canEdit: boolean; mustChange?: boolean; canDecide?: boolean; canUnlock?: boolean; soNotasTag?: boolean };
// 18/11/2026 (Gustavo): só o Otávio (e o Gustavo, administrador) decide a Aprovação Otávio. O BO vê só a aba Notas TAG.
const DECIDEM = new Set(["otavio.reis@holding.exemplo", "gustavo@empresa.exemplo"]);
const SO_NOTAS_TAG = new Set(["backoffice@investidora.exemplo"]);
// 19/11/2026 (Gustavo): depois de "Aprovado", a Aprovação Otávio fica travada para o pessoal da TAG (inclusive o Otávio); só o Gustavo (administrador) destrava.
const DESTRAVAM = new Set(["gustavo@empresa.exemplo"]);
const MSG_TRAVADA = "Nota já aprovada: a Aprovação Otávio está travada. Só o Status pode ser alterado. Se foi aprovada por engano, peça ao administrador.";
async function identidade(req: Request, url: URL): Promise<Ator> {
  const cab = req.headers.get("Authorization") || (url.searchParams.get("t") ? "Bearer " + url.searchParams.get("t") : "");
  if (!cab) return { email: "", canRead: false, canEdit: false };
  if (!/^Bearer \S+$/i.test(cab)) throw httpError(401, "Sessão inválida. Entre novamente.");
  const { data, error } = await sb.auth.getUser(cab.replace(/^Bearer\s+/i, ""));
  if (error || !data?.user) throw httpError(401, "Sessão expirada. Entre novamente.");
  const u = data.user, email = String(u.email || "").trim().toLowerCase();
  if (!u.email_confirmed_at || (u as any).is_anonymous) return { email, canRead: false, canEdit: false };
  const trocar = u.user_metadata?.precisa_trocar_senha === true;   // senha inicial ainda não trocada: sem acesso
  if (trocar) return { email, canRead: false, canEdit: false, mustChange: true };
  const { data: perfil } = await sb.from("painel_perfis").select("equipe").eq("email", email).maybeSingle();
  const canRead = EQUIPES_LEITURA.includes(perfil?.equipe) || EDITORES.has(email);
  return { email, canRead, canEdit: canRead && EDITORES.has(email), canDecide: canRead && DECIDEM.has(email), canUnlock: canRead && DESTRAVAM.has(email), soNotasTag: SO_NOTAS_TAG.has(email) };
}
function exigirLeitura(a: Ator) {
  if (!a.email) throw httpError(401, "Entre para ver as notas.");
  if (a.mustChange) throw httpError(403, "Defina sua senha pessoal no primeiro acesso do painel.");
  if (!a.canRead) throw httpError(403, "Sua conta não tem acesso às notas da TAG.");
}
function exigirEdicao(a: Ator, req: Request) {
  exigirLeitura(a);
  if (!a.canEdit) throw httpError(403, "Entre com uma conta de edição (Otávio, BO ou Gustavo) para editar.");
  const origem = req.headers.get("Origin");
  if (origem && origem !== ORIGEM_SITE) throw httpError(403, "Origem não permitida.");
}

// ---------- utilitários ----------
async function lerJson(req: Request) {
  const texto = await req.text();
  if (texto.length > MAX_CORPO * 1.4) throw httpError(413, "Arquivo grande demais (limite 20 MB).");
  if (!texto) return {};
  try { return JSON.parse(texto); } catch { throw httpError(400, "JSON inválido."); }
}
function decodificar(file: any) {
  if (!file || typeof file.dataBase64 !== "string") throw httpError(400, "Arquivo não recebido.");
  const bin = atob(file.dataBase64), buffer = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
  const name = String(file.name || "arquivo"), ext = (name.split(".").pop() || "").toLowerCase();
  if (!["pdf", "png", "jpg", "jpeg", "xml"].includes(ext)) throw httpError(400, "Use PDF, PNG, JPG ou XML.");
  if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) throw httpError(400, "Arquivo vazio ou maior que 10 MB.");
  return { name, buffer };
}

async function meta(store: TagStore) {
  const leves = await store.allLean();
  const contagem: Record<string, number> = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  for (const it of leves) if (contagem[it.groupId] !== undefined) contagem[it.groupId] += 1;
  const imp = await repo.getMeta("importacao");
  return {
    board: BOARD, snapshotAt: imp?.snapshotAt ?? null, snapshotSource: imp?.source ?? "Painel (banco real)", total: leves.length,
    groups: GROUPS.map((g) => ({ ...g, count: contagem[g.id] || 0 })),
    catalog: { departments: DEPARTMENTS, categories: CATEGORIES, payments: PAYMENTS, payers: PAYERS, otavio: OTAVIO_LABELS, paymentStatus: PAYMENT_STATUS_LABELS, dueCount: DUE_COLUMNS.length },
    automations: await store.automations(),
  };
}

// Cópia dos arquivos que a TAG ainda só tem como link da Monday (16/11/2026). Protegida pela chave do espelho (não pelo login).
// Baixa cada arquivo pelo link atual da Monday (somente leitura), grava no bucket tag-arquivos e atualiza a nota (doc e prévia).
const nomeSeguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^w.-]+/g, "_").slice(0, 100);
// 19/11/2026 (Gustavo): rotina "copiar-arquivos" (buscava arquivos na Monday) removida. A Monday fica só como histórico.

async function api(req: Request, url: URL, partes: string[]): Promise<Response> {
  const metodo = req.method;
  let ator: Ator;
  try { ator = await identidade(req, url); } catch (e) { if (partes[1] === "session") ator = { email: "", canRead: false, canEdit: false }; else throw e; }
  const store = new TagStore(repo, ator.email || "Sem login");

  if (metodo === "GET" && partes[1] === "session") return json({ actor: { email: ator.email, canEdit: ator.canEdit, canRead: ator.canRead, mustChange: !!ator.mustChange, canDecide: !!ator.canDecide, canUnlock: !!ator.canUnlock, soNotasTag: !!ator.soNotasTag }, auth: { url: SUPABASE_URL, key: ANON } });
  if (metodo === "POST" && partes[1] === "primeiro-acesso") {
    const corpo = await lerJson(req), email = String(corpo.email || "").trim().toLowerCase();
    // O pedido vai para a mesma função do "Esqueci minha senha" do painel (resposta sempre igual, não revela se existe conta).
    await fetch(`${SUPABASE_URL}/functions/v1/recuperar-senha`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON }, body: JSON.stringify({ email }) }).catch(() => null);
    return json({ enviado: "link" });
  }
  // 19/11/2026: lista os arquivos das notas pedidas (o botão "Baixar arquivos do grupo" monta o ZIP no navegador). Só leitura.
  if (metodo === "POST" && partes[1] === "arquivos-lista") {
    exigirLeitura(ator);
    const corpo = await lerJson(req), ids = (Array.isArray(corpo.ids) ? corpo.ids : []).map(String).slice(0, 1000);
    const linhas: any[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await sb.from("tag_notas").select("id, doc").in("id", ids.slice(i, i + 100));
      if (error) throw new Error(error.message);
      linhas.push(...data);
    }
    const arq = (lista: any[], tipo: string) => (lista || []).map((f: any) => ({ id: f.id, nome: f.name || "arquivo", tipo, local: !!f.local, tamanho: f.size || null }));
    return json({ notas: linhas.map((n) => ({ id: n.id, nf: n.doc?.nf || "", nome: n.doc?.name || "", fornecedor: n.doc?.supplierName || "", arquivos: [...arq(n.doc?.files, "nota"), ...arq(n.doc?.proofs, "comprovante")] })) });
  }
  if (!["GET", "HEAD"].includes(metodo)) exigirEdicao(ator, req); else exigirLeitura(ator);

  if (metodo === "GET" && partes[1] === "meta") return json(await meta(store));
  if (metodo === "GET" && partes[1] === "items" && partes.length === 2) return json({ items: await store.allLean() });
  if (metodo === "POST" && partes[1] === "items" && partes.length === 2) {
    if (ator.soNotasTag) throw httpError(403, "Esta conta só consulta a aba Notas TAG.");
    const corpo = await lerJson(req);
    const file = corpo.file ? decodificar(corpo.file) : null;
    return json({ item: await store.createNote(corpo.values || {}, file) }, 201);
  }
  if (partes[1] === "items" && partes[2]) {
    const id = partes[2];
    if (metodo === "GET" && partes.length === 3) return json({ item: await store.requireItem(id), events: await store.events({ itemId: id, limit: 100 }) });
    if (metodo === "DELETE" && partes.length === 3) { const it = await store.deleteNote(id); return json({ ok: true, id: it.id }); }
    if (metodo === "PATCH" && partes[3] === undefined) { const corpo = await lerJson(req); if (corpo.patch && "approverNotes" in corpo.patch && !ator.canDecide) throw httpError(403, "A narrativa da decisão é do Otávio."); const r = await store.patchFields(id, corpo.patch || {}); return json({ item: r.item, changes: r.changes }); }
    if (metodo === "POST" && partes[3] === "move") {
      const corpo = await lerJson(req);
      // Mover para Pendentes ou Reprovadas da TAG mudaria a decisão do Otávio: com a nota já aprovada, isso também fica travado.
      if (!ator.canUnlock) {
        const atual = await store.requireItem(id), destino = GROUPS.find((g: any) => g.id === corpo.groupId);
        if (atual.otavio === "Aprovado" && destino && destino.company === "TAG" && ["pending", "rejected"].includes(destino.stage)) throw httpError(403, MSG_TRAVADA);
      }
      return json({ item: await store.moveGroup(id, corpo.groupId) });
    }
    if (metodo === "POST" && partes[3] === "set") { const corpo = await lerJson(req); if (corpo.column === "otavio" && !ator.canDecide) throw httpError(403, "Só o Otávio decide a Aprovação Otávio.");
      if (corpo.column === "otavio" && !ator.canUnlock) { const atual = await store.requireItem(id); if (atual.otavio === "Aprovado" && (corpo.value || "") !== "Aprovado") throw httpError(403, MSG_TRAVADA); }
      return json({ item: await store.setColumn(id, corpo.column, corpo.value) }); }
    if (metodo === "POST" && partes[3] === "proofs") {
      const corpo = await lerJson(req), { name, buffer } = decodificar(corpo.file);
      await store.requireItem(id);
      const guardado = await store.storeUpload(id, { name, buffer }, "proofs");
      return json({ item: await store.addProof(id, guardado) }, 201);
    }
    if (metodo === "DELETE" && partes[3] === "proofs" && partes[4]) return json({ item: await store.removeProof(id, partes[4]) });
    // 17/11/2026: incluir e remover arquivo da nota (NF, boleto), como nos painéis.
    if (metodo === "POST" && partes[3] === "files" && partes.length === 4) {
      const corpo = await lerJson(req), { name, buffer } = decodificar(corpo.file);
      await store.requireItem(id);
      const guardado = await store.storeUpload(id, { name, buffer }, "files");
      return json({ item: await store.addFile(id, guardado) }, 201);
    }
    if (metodo === "DELETE" && partes[3] === "files" && partes[4]) return json({ item: await store.removeFile(id, partes[4]) });
  }
  if (partes[1] === "automations") {
    if (metodo === "GET" && partes.length === 2) return json({ automations: await store.automations() });
    if (metodo === "PATCH" && partes[2]) { const corpo = await lerJson(req); return json({ automation: await store.setAutomationEnabled(partes[2], Boolean(corpo.enabled)) }); }
  }
  if (metodo === "GET" && partes[1] === "events") return json({ events: await store.events({ limit: Math.min(Number(url.searchParams.get("limit") || 200), 1000) }) });
  if (metodo === "GET" && partes[1] === "outbox") return json({ outbox: await store.outbox() });
  throw httpError(404, "Rota não encontrada.");
}

async function arquivo(req: Request, url: URL, partes: string[]): Promise<Response> {
  const ator = await identidade(req, url);
  exigirLeitura(ator);
  const [, itemId, fileId] = partes;
  const nota = await repo.getNota(itemId);
  if (!nota) throw httpError(404, "Nota não encontrada.");
  const f = [...(nota.files || []), ...(nota.proofs || [])].find((x: any) => x.id === fileId);
  if (!f) throw httpError(404, "Arquivo não encontrado nesta nota.");
  const m = /^storage:([\w-]+)\/(.+)$/.exec(String(f.local || ""));
  if (!m) return json({ error: "Sem cópia deste arquivo.", url: f.url, note: "Abra pelo link da Monday (exige login)." }, 404);
  const { data, error } = await sb.storage.from(m[1]).download(m[2]);
  if (error || !data) throw httpError(404, "Arquivo ausente.");
  const ext = (String(f.name).split(".").pop() || "").toLowerCase();
  return new Response(data, { headers: { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${encodeURIComponent(f.name)}"`, "X-Content-Type-Options": "nosniff" } });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const caminho = url.pathname.replace(/^\/(functions\/v1\/)?tag-api/, "");
    const partes = caminho.split("/").filter(Boolean).map(decodeURIComponent);
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (partes[0] === "files" && req.method === "GET") return await arquivo(req, url, partes);
    if (partes[0] === "api") return await api(req, url, partes);
    throw httpError(404, "Rota não encontrada.");
  } catch (e: any) {
    const status = e?.status || 500;
    if (status === 500) console.error("tag-api:", e?.message || e);
    return json({ error: status === 500 ? "Erro interno." : e.message, details: e?.details ?? null }, status);
  }
});
