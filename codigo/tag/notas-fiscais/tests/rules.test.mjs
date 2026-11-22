import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTOMATIONS, TAG } from '../lib/catalog.mjs';
import { matchingAutomations, planEffects } from '../lib/rules.mjs';
import { formVisibility, validateNewNote } from '../lib/form.mjs';
import { Store, httpError } from '../lib/store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
// O export real do quadro só existia no computador de trabalho. Sem ele, os testes usam dados fictícios
// (tests/fixtures/snapshot-ficticio.json, gerado de demo-src/dados-ficticios.mjs).
const snapshotReal = join(root, 'data', 'snapshot.json');
const snapshotPath = existsSync(snapshotReal) ? snapshotReal : join(root, 'tests', 'fixtures', 'snapshot-ficticio.json');

const TAG_PENDING = 'group_mm2c28pe';
const TAG_APPROVED = 'group_mm2ct5t8';
const TAG_AWAITING = 'group_mm332dfe';
const TAG_PAID = 'group_mm2daf7r';
const TAG_REJECTED = 'group_mm2np6s6';

// Cópia temporária dos dados: os testes nunca escrevem em data/ real.
function tempStore() {
  const base = mkdtempSync(join(tmpdir(), 'notas-test-'));
  const dataDir = join(base, 'data');
  mkdirSync(dataDir, { recursive: true });
  const store = new Store({ dataDir, snapshotPath, actor: 'teste' });
  return { store, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

const pendingTag = (store) => store.allItems().find((i) => i.groupId === TAG_PENDING && i.otavio !== 'Aprovado' && i.otavio !== 'Reprovado');

test('catálogo: cinco automações, com a desativada por padrão', () => {
  assert.equal(AUTOMATIONS.length, 5);
  assert.equal(AUTOMATIONS.filter((a) => a.enabled).length, 4);
  assert.equal(AUTOMATIONS.find((a) => a.id === '7917908135').enabled, false);
});

test('Aprovação Otávio = Aprovado dispara só a automação de mover para aprovadas', () => {
  const m = matchingAutomations({ type: 'set', column: 'otavio', from: 'Em analise', to: 'Aprovado' });
  assert.deepEqual(m.map((a) => a.id), ['7917897786']);
});

test('Aprovação Otávio = Reprovado não dispara a automação de e-mail, que está desativada', () => {
  const m = matchingAutomations({ type: 'set', column: 'otavio', from: 'Em analise', to: 'Reprovado' });
  assert.deepEqual(m, []);
});

test('Reprovado dispara e-mail + mover quando a automação está ligada', () => {
  const ligadas = AUTOMATIONS.map((a) => ({ ...a, enabled: true }));
  const m = matchingAutomations({ type: 'set', column: 'otavio', from: 'Em analise', to: 'Reprovado' }, ligadas);
  assert.deepEqual(m.map((a) => a.id), ['7917908135']);
  const passos = planEffects({ nf: '1', supplierName: 'X', otavio: 'Reprovado', approverNotes: 'faltou PIX', name: '1 - X' }, m[0]);
  assert.equal(passos[0].kind, 'email');
  assert.equal(passos[0].subject, 'Atualização - 1 - X');
  assert.match(passos[0].body, /Pedido Reprovado/);
  assert.match(passos[0].body, /Motivo: faltou PIX/);
  assert.equal(passos[1].kind, 'move');
  assert.equal(passos[1].groupId, TAG_REJECTED);
});

test('Status = Em andamento move para aguardando comprovante', () => {
  const m = matchingAutomations({ type: 'set', column: 'status', from: '', to: 'Em andamento' });
  assert.deepEqual(m.map((a) => a.id), ['7918501812']);
});

test('Mesmo valor não dispara automação (Monday só dispara na mudança)', () => {
  assert.deepEqual(matchingAutomations({ type: 'set', column: 'otavio', from: 'Aprovado', to: 'Aprovado' }), []);
});

test('Comprovantes alterado dispara em qualquer alteração (inclusive remoção)', () => {
  const m = matchingAutomations({ type: 'change', column: 'proofs' });
  assert.deepEqual(m.map((a) => a.id), ['7918501969']);
  const passos = planEffects({ status: '' }, m[0]);
  assert.deepEqual(passos.map((p) => p.kind), ['set', 'move']);
  assert.equal(passos[0].value, 'Pago');
  assert.equal(passos[1].groupId, TAG_PAID);
});

test('Criação: nome = NF - fornecedor e pagador TAG', () => {
  const m = matchingAutomations({ type: 'create' });
  assert.deepEqual(m.map((a) => a.id), ['7917895475']);
  const passos = planEffects({ nf: '466', supplierName: 'FORNECEDORA EXEMPLO ASSESSORIA LTDA' }, m[0]);
  assert.equal(passos[0].value, '466 - FORNECEDORA EXEMPLO ASSESSORIA LTDA');
  assert.equal(passos[1].column, 'payer');
  assert.equal(passos[1].value, TAG);
});

test('visibilidade do formulário segue as condições do Monday', () => {
  assert.equal(formVisibility({ departmentId: '', paymentId: '' }).payer, false);
  assert.equal(formVisibility({ departmentId: 0, paymentId: '' }).payer, true);
  assert.equal(formVisibility({ departmentId: 8, paymentId: '' }).address, true);
  assert.equal(formVisibility({ departmentId: 0, paymentId: 2 }).bank, true);
  assert.equal(formVisibility({ departmentId: 0, paymentId: 4 }).due, true);
  assert.equal(formVisibility({ departmentId: 0, paymentId: 4 }).dueMore, false);
  assert.equal(formVisibility({ departmentId: 0, paymentId: 3 }).dueMore, true);
});

test('validação do lançamento aponta os campos obrigatórios', () => {
  const erros = validateNewNote({ departmentId: '', paymentId: '' }, { hasFile: false }).map((e) => e.field);
  for (const campo of ['nf', 'supplierName', 'departmentId', 'category', 'file', 'issueDate', 'narrative', 'value', 'paymentId']) {
    assert.ok(erros.includes(campo), `faltou ${campo}`);
  }
});

test('store: aprovar pela TAG move a nota e grava o histórico', () => {
  const { store, cleanup } = tempStore();
  try {
    const it = pendingTag(store);
    assert.ok(it, 'precisa de uma nota pendente da TAG');
    store.setColumn(it.id, 'otavio', 'Aprovado');
    assert.equal(store.getItem(it.id).groupId, TAG_APPROVED);
    const ev = store.events({ itemId: it.id });
    assert.ok(ev.some((e) => e.type === 'group_changed' && e.origin === 'automation' && e.automation === '7917897786'));
    // persiste e recarrega
    const again = new Store({ dataDir: join(store.dataDir), snapshotPath, actor: 'teste' });
    assert.equal(again.getItem(it.id).groupId, TAG_APPROVED);
  } finally { cleanup(); }
});

test('store: Em andamento e depois comprovante => aguardando, depois pago', () => {
  const { store, cleanup } = tempStore();
  try {
    const it = pendingTag(store);
    store.setColumn(it.id, 'otavio', 'Aprovado');
    store.setColumn(it.id, 'status', 'Em andamento');
    assert.equal(store.getItem(it.id).groupId, TAG_AWAITING);
    const file = { id: 'p1', name: 'comprovante.pdf', url: null, local: null, origin: 'tela' };
    store.addProof(it.id, file);
    assert.equal(store.getItem(it.id).status, 'Pago');
    assert.equal(store.getItem(it.id).groupId, TAG_PAID);
    store.removeProof(it.id, 'p1');
    // remoção também dispara a automação, como no Monday
    assert.equal(store.getItem(it.id).status, 'Pago');
  } finally { cleanup(); }
});

test('store: reprovar com automação desativada não envia nem fila e-mail', () => {
  const { store, cleanup } = tempStore();
  try {
    const it = pendingTag(store);
    store.setColumn(it.id, 'otavio', 'Reprovado');
    assert.equal(store.getItem(it.id).groupId, TAG_PENDING, 'sem a automação, a nota não muda de grupo');
    assert.equal(store.outbox().length, 0);
  } finally { cleanup(); }
});

test('store: ligar a automação de reprovação gera e-mail na fila (sem envio) e move', () => {
  const { store, cleanup } = tempStore();
  try {
    store.setAutomationEnabled('7917908135', true);
    const it = pendingTag(store);
    store.setColumn(it.id, 'otavio', 'Reprovado');
    assert.equal(store.getItem(it.id).groupId, TAG_REJECTED);
    const out = store.outbox();
    assert.equal(out.length, 1);
    assert.equal(out[0].status, 'nao_enviado');
    assert.deepEqual(out[0].to, []);
  } finally { cleanup(); }
});

test('store: edição de campo não dispara automação e registra alteração', () => {
  const { store, cleanup } = tempStore();
  try {
    const it = pendingTag(store);
    const before = it.narrative;
    const r = store.patchFields(it.id, { narrative: `${before} (ajustado)` });
    assert.equal(r.changes, 1);
    const ev = store.events({ itemId: it.id });
    assert.ok(ev.some((e) => e.type === 'field_changed' && e.field === 'Narrativa'));
    assert.equal(store.getItem(it.id).groupId, TAG_PENDING);
  } finally { cleanup(); }
});

test('store: lançamento cria nota no grupo TAG pendentes com nome e pagador da automação', () => {
  const { store, cleanup } = tempStore();
  try {
    const values = {
      nf: '9999', supplierName: 'FORNECEDOR TESTE LTDA', supplierDoc: '00.000.000/0001-00',
      departmentId: 0, payer: ['PARCEIRA LTDA'], address: '', category: 'Serviço', issueDate: '2026-11-10',
      narrative: 'Teste de lançamento', value: '1234.5', paymentId: 1, bank: '', dues: ['2026-12-10', ...Array(11).fill('')],
    };
    const file = { name: 'nf.pdf', buffer: Buffer.from('%PDF-1.4 teste') };
    const created = store.createNote(values, file);
    assert.equal(created.groupId, TAG_PENDING);
    assert.equal(created.name, '9999 - FORNECEDOR TESTE LTDA');
    assert.deepEqual(created.payer, [TAG], 'automação sobrescreve o pagador com TAG');
    assert.equal(created.files.length, 1);
    assert.equal(created.dues[0], '2026-12-10');
    assert.equal(created.dues[1], null, 'parcelas extras só para Parcelado');
    assert.ok(existsSync(join(store.dataDir, '..', created.files[0].local)));
  } finally { cleanup(); }
});

test('store: lançamento sem arquivo é recusado com detalhes', () => {
  const { store, cleanup } = tempStore();
  try {
    assert.throws(() => store.createNote({ nf: '1' }, null), (e) => e.status === 400 && Array.isArray(e.details) && e.details.some((d) => d.field === 'file'));
  } finally { cleanup(); }
});

test('store: valor de status inválido é recusado', () => {
  const { store, cleanup } = tempStore();
  try {
    const it = pendingTag(store);
    assert.throws(() => store.setColumn(it.id, 'otavio', 'Talvez'), (e) => e.status === 400);
  } finally { cleanup(); }
});

test('store: alterações ficam fora do snapshot da Monday', () => {
  const { store, cleanup } = tempStore();
  try {
    const before = readFileSync(snapshotPath, 'utf8');
    const it = pendingTag(store);
    store.setColumn(it.id, 'otavio', 'Aprovado');
    assert.equal(readFileSync(snapshotPath, 'utf8'), before, 'snapshot exportado não pode mudar');
    const original = JSON.parse(before).items.find((x) => x.id === it.id);
    assert.equal(original.groupId, TAG_PENDING);
  } finally { cleanup(); }
});

test('store: erro de regra usa HTTP 400/404', () => {
  const { store, cleanup } = tempStore();
  try {
    assert.throws(() => store.requireItem('nao-existe'), (e) => e.status === 404);
    assert.equal(httpError(400, 'x').status, 400);
  } finally { cleanup(); }
});
