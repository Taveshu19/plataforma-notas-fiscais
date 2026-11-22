// Liga a tela (app.js, sem alterações) à versão de demonstração: intercepta /api/* e responde
// com DemoStore, no lugar do servidor local. Carregado antes do app.js.
import { DemoStore } from './demo-store.mjs';

const store = new DemoStore();
const original = window.fetch.bind(window);
const SESSAO_DEMO = {
  actor: { id: 'visitante', email: 'visitante@demo.exemplo', canRead: true, canEdit: true, mustChange: false },
  auth: { url: 'https://demonstracao.invalid', key: 'demonstracao' },
};

const json = (status, data) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

function route(method, path, params, body) {
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]
  const [, recurso, id, acao, sub] = parts;

  if (method === 'GET' && recurso === 'meta') return { data: store.meta() };
  if (recurso === 'items' && !id) {
    if (method === 'GET') return { data: { items: store.allItems().map((it) => store.lean(it)) } };
    if (method === 'POST') {
      const item = store.createNote(body.values || {}, body.file ? { name: String(body.file.name || 'arquivo') } : null);
      return { status: 201, data: { item } };
    }
  }
  if (recurso === 'items' && id) {
    if (method === 'GET' && !acao) {
      const events = store.events.filter((e) => e.itemId === id).slice(-100).reverse();
      return { data: { item: store.requireItem(id), events } };
    }
    if (method === 'PATCH' && !acao) return { data: store.patchFields(id, body.patch || {}) };
    if (method === 'POST' && acao === 'move') return { data: { item: store.moveGroup(id, body.groupId) } };
    if (method === 'POST' && acao === 'set') return { data: { item: store.setColumn(id, body.column, body.value) } };
    if (method === 'POST' && acao === 'proofs') {
      store.requireItem(id);
      const file = { id: `p${store.events.length + 1}`, name: String((body.file && body.file.name) || 'comprovante'), url: null, local: null };
      return { status: 201, data: { item: store.addProof(id, file) } };
    }
    if (method === 'DELETE' && acao === 'proofs' && sub) return { data: { item: store.removeProof(id, sub) } };
  }
  if (recurso === 'automations') {
    if (method === 'GET' && !id) return { data: { automations: store.automations() } };
    if (method === 'PATCH' && id) return { data: { automation: store.setAutomationEnabled(id, Boolean(body.enabled)) } };
  }
  if (method === 'GET' && recurso === 'events') {
    const limit = Math.min(Number(params.get('limit') || 200), 1000);
    return { data: { events: store.events.slice(-limit).reverse() } };
  }
  if (method === 'GET' && recurso === 'outbox') return { data: { outbox: [...store.outbox].reverse() } };
  return { status: 404, data: { error: 'Rota não encontrada.' } };
}

// Notas da Engenharia com Pagador Tag (14/11): chegam pela janela que abriu o painel (aba Administrativo da Engenharia).
// Na demonstração pública, a Engenharia fica no mesmo endereço (a mesma origem já é aceita abaixo).
const ORIGENS_ENGENHARIA = ['null'];
window.addEventListener('message', (ev) => {
  if (ev.source !== window.parent || window.parent === window || !(ORIGENS_ENGENHARIA.includes(ev.origin) || ev.origin === window.location.origin)) return;
  if (ev.data?.tipo !== 'vale:nota-tag') return;
  const responder = (d) => ev.source.postMessage({ tipo: 'vale:nota-tag:ok', pedido: ev.data.pedido, ...d }, ev.origin === 'null' ? '*' : ev.origin);
  try {
    const item = store.receberDaEngenharia(ev.data.nota);
    responder({ id: item.id, grupo: item.group });
    window.dispatchEvent(new Event('notas:recarregar'));
  } catch (e) { responder({ erro: e.message }); }
});

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  if (!url.pathname.startsWith('/api/')) return original(input, init);
  const method = (init.method || 'GET').toUpperCase();
  const headers = init.headers || {};
  // Demonstração estática: o visitante entra direto, lê e edita (tudo fica só na memória da página).
  if (url.pathname === '/api/session') return json(200, SESSAO_DEMO);
  if (url.pathname === '/api/primeiro-acesso') return json(200, { ok: true });
  let body = {};
  if (init.body) {
    try { body = JSON.parse(init.body); } catch { body = {}; }
  }
  try {
    const r = route(method, url.pathname, url.searchParams, body);
    return json(r.status || 200, r.data);
  } catch (e) {
    return json(e.status || 500, { error: e.message, details: e.details || null });
  }
};
