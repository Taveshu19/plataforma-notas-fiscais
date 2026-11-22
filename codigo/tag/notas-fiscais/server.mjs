// Servidor local da tela de Notas Fiscais. Sem dependências (Node 22+).
// Escuta somente em 127.0.0.1. Não escreve na Monday: a base é o snapshot em data/snapshot.json.
import http from 'node:http';
import { auth, identity, requireEditor, requestActor } from './lib/access.mjs';
import { pedirPrimeiroAcesso } from './lib/primeiro-acesso.mjs';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { dirname, join, normalize, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, httpError } from './lib/store.mjs';
import {
  BOARD, GROUPS, DEPARTMENTS, CATEGORIES, PAYMENTS, PAYERS, DUE_COLUMNS, OTAVIO_LABELS, PAYMENT_STATUS_LABELS,
} from './lib/catalog.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3420);
const HOST = '127.0.0.1';
const publicDir = join(root, 'public');
// NOTAS_DATA_DIR permite testar com uma pasta de dados separada (o padrão é ./data).
const dataDir = process.env.NOTAS_DATA_DIR ? resolve(process.env.NOTAS_DATA_DIR) : join(root, 'data');
const snapshotPath = process.env.NOTAS_SNAPSHOT ? resolve(process.env.NOTAS_SNAPSHOT) : join(dataDir, 'snapshot.json');
// Caminhos locais dos arquivos são relativos à pasta-pai de dataDir (a pasta notas-fiscais, por padrão).
const localBase = dirname(dataDir);
const allowedFileRoots = [join(dataDir, 'uploads'), resolve(root, '..', 'aprovacao-tag', 'data', 'files')];
const MAX_BODY = 20 * 1024 * 1024;

const store = new Store({
  dataDir,
  snapshotPath,
  actor: process.env.NOTAS_OPERADOR || 'Operador local',
});

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(payload);
}

function fail(res, err) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  send(res, status, { error: err.message || 'Erro interno.', details: err.details || null });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw httpError(413, 'Arquivo grande demais (limite 20 MB).');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw httpError(400, 'JSON inválido.'); }
}

function decodeUpload(file) {
  if (!file || typeof file.dataBase64 !== 'string') throw httpError(400, 'Arquivo não recebido.');
  const buffer = Buffer.from(file.dataBase64, 'base64');
  const name = String(file.name || 'arquivo');
  const ext = extname(name).toLowerCase();
  if (!['.pdf', '.png', '.jpg', '.jpeg', '.xml'].includes(ext)) throw httpError(400, 'Use PDF, PNG, JPG ou XML.');
  if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) throw httpError(400, 'Arquivo vazio ou maior que 10 MB.');
  return { name, buffer };
}

// Linha enxuta para a tabela. O detalhe completo vem de /api/items/:id.
function lean(it) {
  const dues = (it.dues || []).filter(Boolean).sort();
  return {
    id: it.id, name: it.name, nf: it.nf, supplierName: it.supplierName, supplierDoc: it.supplierDoc,
    groupId: it.groupId, group: it.group, departmentId: it.departmentId, department: it.department,
    payer: it.payer, address: it.address, category: it.category, payment: it.payment, paymentId: it.paymentId,
    value: it.value, narrative: it.narrative, issueDate: it.issueDate, dueDate: dues[0] || null,
    otavio: it.otavio, status: it.status, filesCount: it.files.length, proofsCount: it.proofs.length,
    preview: it.files.find(f => /\.pdf$/i.test(f.name) && f.local) || null,
    createdAt: it.createdAt, updatedAt: it.updatedAt,
  };
}

function meta() {
  const items = store.allItems();
  const counts = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  let total = 0;
  for (const it of items) { total += 1; if (counts[it.groupId] !== undefined) counts[it.groupId] += 1; }
  return {
    board: BOARD,
    snapshotAt: store.snapshotAt,
    snapshotSource: store.snapshotSource,
    total,
    groups: GROUPS.map((g) => ({ ...g, count: counts[g.id] || 0 })),
    catalog: {
      departments: DEPARTMENTS, categories: CATEGORIES, payments: PAYMENTS, payers: PAYERS,
      otavio: OTAVIO_LABELS, paymentStatus: PAYMENT_STATUS_LABELS, dueCount: DUE_COLUMNS.length,
    },
    automations: store.automations(),
  };
}

function fileFor(itemId, fileId) {
  const it = store.requireItem(itemId);
  const f = [...it.files, ...it.proofs].find((x) => x.id === fileId);
  if (!f) throw httpError(404, 'Arquivo não encontrado nesta nota.');
  return f;
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]
  const method = req.method;

  if (method === 'GET' && parts[1] === 'session') return send(res,200,{actor:await identity(req.headers.authorization),auth});
  if (method === 'POST' && parts[1] === 'primeiro-acesso') {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw httpError(403,'Origem não permitida.');
    return send(res,200,await pedirPrimeiroAcesso((await readJson(req)).email,{adminKey:process.env.ECOSSISTEMA_ADMIN_KEY}));
  }
  if (!['GET','HEAD'].includes(method)) {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw httpError(403,'Origem não permitida.');
    const actor=await identity(req.headers.authorization);
    requireEditor(actor);
    requestActor.enterWith(actor);
  }
  if (method === 'GET' && parts[1] === 'meta') return send(res, 200, meta());
  if (method === 'GET' && parts[1] === 'items' && parts.length === 2) {
    return send(res, 200, { items: store.allItems().map(lean) });
  }
  if (method === 'POST' && parts[1] === 'items' && parts.length === 2) {
    const body = await readJson(req);
    const file = body.file ? decodeUpload(body.file) : null;
    const item = store.createNote(body.values || {}, file);
    return send(res, 201, { item });
  }
  if (parts[1] === 'items' && parts[2]) {
    const id = parts[2];
    if (method === 'GET' && parts.length === 3) {
      const item = store.requireItem(id);
      return send(res, 200, { item, events: store.events({ itemId: id, limit: 100 }) });
    }
    if (method === 'PATCH' && parts[3] === undefined) {
      const body = await readJson(req);
      const r = store.patchFields(id, body.patch || {});
      return send(res, 200, { item: r.item, changes: r.changes });
    }
    if (method === 'POST' && parts[3] === 'move') {
      const body = await readJson(req);
      return send(res, 200, { item: store.moveGroup(id, body.groupId) });
    }
    if (method === 'POST' && parts[3] === 'set') {
      const body = await readJson(req);
      return send(res, 200, { item: store.setColumn(id, body.column, body.value) });
    }
    if (method === 'POST' && parts[3] === 'proofs') {
      const body = await readJson(req);
      const { name, buffer } = decodeUpload(body.file);
      store.requireItem(id);
      const stored = store.storeUpload(id, { name, buffer }, 'proofs');
      return send(res, 201, { item: store.addProof(id, stored) });
    }
    if (method === 'DELETE' && parts[3] === 'proofs' && parts[4]) {
      return send(res, 200, { item: store.removeProof(id, parts[4]) });
    }
  }
  if (parts[1] === 'automations') {
    if (method === 'GET' && parts.length === 2) return send(res, 200, { automations: store.automations() });
    if (method === 'PATCH' && parts[2]) {
      const body = await readJson(req);
      return send(res, 200, { automation: store.setAutomationEnabled(parts[2], Boolean(body.enabled)) });
    }
  }
  if (method === 'GET' && parts[1] === 'events') {
    return send(res, 200, { events: store.events({ limit: Math.min(Number(url.searchParams.get('limit') || 200), 1000) }) });
  }
  if (method === 'GET' && parts[1] === 'outbox') return send(res, 200, { outbox: store.outbox() });

  throw httpError(404, 'Rota não encontrada.');
}

function serveFile(res, itemId, fileId) {
  const f = fileFor(itemId, fileId);
  if (!f.local) {
    return send(res, 404, { error: 'Sem cópia local deste arquivo.', url: f.url, note: 'Abra pelo link do Monday (exige login).' });
  }
  // PDFs da Central TAG vêm como '../aprovacao-tag/...' (relativos à raiz); uploads ficam em dataDir.
  const abs = resolve(f.local.startsWith('../') ? root : localBase, f.local);
  const okRoot = allowedFileRoots.some((r) => abs.startsWith(r + sep) || abs === r);
  if (!okRoot || !existsSync(abs)) return send(res, 404, { error: 'Arquivo local ausente.' });
  const type = MIME[extname(abs).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(abs).size, 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename="${encodeURIComponent(f.name)}"` });
  createReadStream(abs).pipe(res);
}

// Base visual compartilhada do ecossistema (Expansão + camada de cor deste painel).
const visualDir = resolve(root, '..', 'ecossistema-visual');
const VISUAL_FILES = new Set(['direcao.css', 'areas-novas.css', 'verde-notas.css', 'manifesto.json']);

function serveStatic(res, pathname) {
  if (pathname.startsWith('/visual/')) {
    const name = pathname.slice('/visual/'.length);
    if (!VISUAL_FILES.has(name)) return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    const abs = join(visualDir, name);
    return send(res, 200, readFileSync(abs), MIME[extname(abs).toLowerCase()] || 'application/octet-stream');
  }
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const abs = normalize(join(publicDir, rel));
  if (!abs.startsWith(publicDir + sep) || !existsSync(abs) || statSync(abs).isDirectory()) {
    return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
  }
  send(res, 200, readFileSync(abs), MIME[extname(abs).toLowerCase()] || 'application/octet-stream');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const [, , itemId, fileId] = url.pathname.split('/').map((p) => decodeURIComponent(p));
      return serveFile(res, itemId, fileId);
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    send(res, 405, { error: 'Método não permitido.' });
  } catch (err) {
    fail(res, err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Notas Fiscais (cópia local da Monday) em http://${HOST}:${PORT}`);
  console.log(`Base: snapshot de ${store.snapshotAt}. Somente leitura na Monday.`);
});
