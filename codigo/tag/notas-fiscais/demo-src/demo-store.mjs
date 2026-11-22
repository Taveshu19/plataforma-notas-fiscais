// Versão de demonstração do lib/store.mjs: mesma lógica, em memória, sem disco.
// Reusa catalog, rules e form sem alteração. Reinicia a cada carregamento da página.
import {
  AUTOMATIONS, GROUPS, GROUP_BY_ID, OTAVIO_LABELS, PAYMENT_STATUS_LABELS, DEPARTMENTS, PAYMENTS, PAYERS,
  CATEGORIES, DUE_COLUMNS, TAG, BOARD,
} from './lib/catalog.mjs';
import { matchingAutomations, planEffects, MAX_CASCADE } from './lib/rules.mjs';
import { formVisibility, validateNewNote } from './lib/form.mjs';
import { gerarItens, SNAPSHOT_AT } from './dados-ficticios.mjs';

const TAG_PENDING_GROUP = 'group_mm2c28pe';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

const validDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (!ISO.test(String(v))) throw new HttpError(400, `Data inválida: ${v}`);
  return String(v);
};

export class DemoStore {
  constructor() {
    this.base = new Map(gerarItens().map((it) => [it.id, it]));
    this.order = [...this.base.keys()];
    this.created = [];
    this.events = [];
    this.outbox = [];
    this.auto = {};
    this.uploadSeq = 0;
  }

  automations() {
    return AUTOMATIONS.map((a) => ({ ...a, enabled: this.auto[a.id] !== undefined ? this.auto[a.id] : a.enabled }));
  }

  allItems() {
    const base = this.order.map((id) => this.base.get(id));
    return [...this.created, ...base];
  }

  getItem(id) {
    return this.created.find((c) => c.id === id) || this.base.get(id) || null;
  }

  requireItem(id) {
    const it = this.getItem(id);
    if (!it) throw new HttpError(404, 'Nota não encontrada.');
    return it;
  }

  log(e) {
    const rec = { id: `e${this.events.length + 1}`, at: new Date().toISOString(), actor: 'Visitante (demonstração)', ...e };
    this.events.push(rec);
    return rec;
  }

  meta() {
    const items = this.allItems();
    const counts = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
    for (const it of items) if (counts[it.groupId] !== undefined) counts[it.groupId] += 1;
    return {
      board: BOARD,
      snapshotAt: SNAPSHOT_AT,
      snapshotSource: 'Demonstração · dados fictícios',
      total: items.length,
      groups: GROUPS.map((g) => ({ ...g, count: counts[g.id] || 0 })),
      catalog: {
        departments: DEPARTMENTS, categories: CATEGORIES, payments: PAYMENTS, payers: PAYERS,
        otavio: OTAVIO_LABELS, paymentStatus: PAYMENT_STATUS_LABELS, dueCount: DUE_COLUMNS.length,
      },
      automations: this.automations(),
    };
  }

  lean(it) {
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

  touch(it) { it.updatedAt = new Date().toISOString(); }

  patchFields(id, patch) {
    const item = this.requireItem(id);
    const changes = [];
    const set = (field, value, label) => {
      const before = item[field];
      if (JSON.stringify(before) === JSON.stringify(value)) return;
      item[field] = value;
      changes.push({ field: label || field, from: before, to: value });
    };
    for (const [key, raw] of Object.entries(patch)) {
      switch (key) {
        case 'nf': set('nf', String(raw ?? '').trim()); break;
        case 'supplierName': set('supplierName', String(raw ?? '').trim(), 'Fornecedor'); break;
        case 'supplierDoc': set('supplierDoc', String(raw ?? '').trim(), 'CNPJ'); break;
        case 'departmentId': {
          if (raw === null || raw === '') { set('departmentId', null, 'Departamento'); item.department = ''; break; }
          const d = DEPARTMENTS.find((x) => x.id === Number(raw));
          if (!d) throw new HttpError(400, 'Departamento inválido.');
          set('departmentId', d.id, 'Departamento'); item.department = d.label; break;
        }
        case 'payer': set('payer', (raw || []).filter((p) => PAYERS.includes(p)), 'Pagador'); break;
        case 'address': set('address', (raw || []).map(String).filter(Boolean), 'Endereço'); break;
        case 'category': {
          if (raw === null || raw === '') { set('category', '', 'Categoria'); break; }
          if (!CATEGORIES.includes(raw)) throw new HttpError(400, 'Categoria inválida.');
          set('category', raw, 'Categoria'); break;
        }
        case 'paymentId': {
          if (raw === null || raw === '') { set('paymentId', null, 'Pagamento'); item.payment = ''; break; }
          const p = PAYMENTS.find((x) => x.id === Number(raw));
          if (!p) throw new HttpError(400, 'Forma de pagamento inválida.');
          set('paymentId', p.id, 'Pagamento'); item.payment = p.label; break;
        }
        case 'value': {
          const v = raw === null || raw === '' ? null : Number(raw);
          if (v !== null && !(v >= 0)) throw new HttpError(400, 'Valor inválido.');
          set('value', v, 'Valor'); break;
        }
        case 'issueDate': set('issueDate', validDate(raw), 'Data de emissão'); break;
        case 'dues': set('dues', (raw || []).map(validDate), 'Vencimentos'); break;
        case 'narrative': set('narrative', String(raw ?? ''), 'Narrativa'); break;
        case 'bank': set('bank', String(raw ?? ''), 'Dados bancários'); break;
        case 'paymentNotes': set('paymentNotes', String(raw ?? ''), 'Observação - Pagamento'); break;
        case 'approverNotes': set('approverNotes', String(raw ?? ''), 'Observações Aprovador'); break;
        default: throw new HttpError(400, `Campo não editável: ${key}`);
      }
    }
    if (changes.length) {
      this.touch(item);
      for (const c of changes) this.log({ type: 'field_changed', itemId: id, origin: 'manual', ...c });
    }
    return { item, changes: changes.length };
  }

  moveGroup(id, groupId, origin = { type: 'manual' }) {
    const item = this.requireItem(id);
    const g = GROUP_BY_ID[groupId];
    if (!g) throw new HttpError(400, 'Grupo inválido.');
    if (item.groupId === groupId) return item;
    const from = item.group;
    item.groupId = groupId;
    item.group = g.title;
    this.touch(item);
    this.log({ type: 'group_changed', itemId: id, from, to: g.title, origin: origin.type, automation: origin.automation || null });
    return item;
  }

  setColumn(id, column, value, origin = { type: 'manual' }, depth = 0) {
    const item = this.requireItem(id);
    if (column === 'otavio' || column === 'status') {
      const labels = column === 'otavio' ? OTAVIO_LABELS : PAYMENT_STATUS_LABELS;
      if (value && !labels.includes(value)) throw new HttpError(400, `Valor inválido para ${column === 'otavio' ? 'Aprovação Otávio' : 'Status'}.`);
      const from = item[column];
      if (from === value) return item;
      item[column] = value;
      this.touch(item);
      this.log({ type: 'column_changed', itemId: id, column: column === 'otavio' ? 'Aprovação Otávio' : 'Status', from, to: value, origin: origin.type, automation: origin.automation || null });
      this.runAutomations(id, { type: 'set', column, from, to: value }, depth);
      return this.requireItem(id);
    }
    if (column === 'payer') {
      const asList = Array.isArray(value) ? value : (value ? [value] : []);
      const list = asList.filter((p) => PAYERS.includes(p));
      const from = item.payer;
      item.payer = list;
      this.touch(item);
      this.log({ type: 'column_changed', itemId: id, column: 'Pagador', from: from.join(', '), to: list.join(', '), origin: origin.type, automation: origin.automation || null });
      return item;
    }
    if (column === 'name') {
      const from = item.name;
      item.name = String(value ?? '');
      this.touch(item);
      this.log({ type: 'column_changed', itemId: id, column: 'Nome', from, to: item.name, origin: origin.type, automation: origin.automation || null });
      return item;
    }
    throw new HttpError(400, `Coluna não suportada: ${column}`);
  }

  addProof(id, file) {
    const item = this.requireItem(id);
    item.proofs = [...item.proofs, file];
    this.touch(item);
    this.log({ type: 'file_added', itemId: id, column: 'Comprovantes', file: file.name });
    this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  removeProof(id, fileId) {
    const item = this.requireItem(id);
    const file = item.proofs.find((f) => f.id === fileId);
    if (!file) throw new HttpError(404, 'Comprovante não encontrado.');
    item.proofs = item.proofs.filter((f) => f.id !== fileId);
    this.touch(item);
    this.log({ type: 'file_removed', itemId: id, column: 'Comprovantes', file: file.name });
    this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  runAutomations(id, change, depth = 0) {
    if (depth >= MAX_CASCADE) { this.log({ type: 'automation_stopped', itemId: id, detail: 'Limite de encadeamento atingido.' }); return; }
    for (const a of matchingAutomations(change, this.automations())) {
      const item = this.requireItem(id);
      const steps = planEffects(item, a);
      this.log({ type: 'automation_run', itemId: id, automationId: a.id, detail: a.title, steps: steps.length });
      const origin = { type: 'automation', automation: a.id };
      for (const step of steps) {
        if (step.kind === 'set') this.setColumn(id, step.column, step.value, origin, depth + 1);
        else if (step.kind === 'move') this.moveGroup(id, step.groupId, origin);
        else if (step.kind === 'email') {
          this.outbox.push({ id: `m${this.outbox.length + 1}`, at: new Date().toISOString(), itemId: id, automationId: a.id, to: [], subject: step.subject, body: step.body, status: 'nao_enviado', note: 'Demonstração: nenhum e-mail é enviado.' });
          this.log({ type: 'email_queued', itemId: id, automationId: a.id, detail: step.subject });
        }
      }
    }
  }

  setAutomationEnabled(id, enabled) {
    const a = AUTOMATIONS.find((x) => x.id === id);
    if (!a) throw new HttpError(404, 'Automação não encontrada.');
    const before = this.automations().find((x) => x.id === id).enabled;
    this.auto[id] = Boolean(enabled);
    this.log({ type: 'automation_toggled', itemId: null, detail: `${a.title}: ${before ? 'ativa' : 'desativada'} → ${enabled ? 'ativa' : 'desativada'}` });
    return this.automations().find((x) => x.id === id);
  }

  // Nota da Engenharia com Pagador Tag (14/11): entra em "TAG - Notas Fiscais Pendentes de aprovação" para o Otávio
  // decidir, como uma nota do formulário (mesma automação de criação). Repetir o envio não duplica.
  receberDaEngenharia(n) {
    const dataOk = (v) => { try { return v ? validDate(String(v).slice(0, 10)) : null; } catch { return null; } };
    const origemId = String(n?.origemId || '');
    if (!origemId) throw new HttpError(400, 'Nota sem identificação.');
    const existente = this.created.find((x) => x.origemId === origemId);
    if (existente) return this.requireItem(existente.id);
    const id = `E${Date.now().toString(36)}${(++this.uploadSeq).toString(36)}`;
    const dep = DEPARTMENTS.find((d) => /engenharia/i.test(d.label)) || DEPARTMENTS[0];
    const pay = PAYMENTS.find((p) => p.label.toLowerCase() === String(n.pagamento || '').toLowerCase()) || PAYMENTS[0];
    const now = new Date().toISOString(), nf = String(n.nf || '').trim(), fornecedor = String(n.fornecedor || '').trim();
    const item = {
      id, origemId, name: '', nf, supplierName: fornecedor, supplierDoc: String(n.cnpj || ''), supplierId: null,
      groupId: TAG_PENDING_GROUP, group: GROUP_BY_ID[TAG_PENDING_GROUP].title,
      departmentId: dep.id, department: dep.label, payer: [], address: n.endereco ? [String(n.endereco)] : [], addressIds: [],
      category: String(n.categoria || ''), paymentId: pay.id, payment: pay.label, bank: '', paymentNotes: '', approverNotes: '',
      otavio: '', engineering: 'Aprovado', status: '', value: Number(n.valor) || 0,
      narrative: String(n.narrativa || '').trim(), issueDate: dataOk(n.emissao), dues: DUE_COLUMNS.map((_, i) => (i === 0 ? dataOk(n.vencimento) : null)),
      files: [{ id: `f${id}`, name: `NF ${nf} - ${fornecedor}.pdf`, url: null, local: 'documento-demo.pdf' }], proofs: [],
      createdAt: now, updatedAt: now, mondayUrl: null,
    };
    this.created.unshift(item);
    this.log({ type: 'created', itemId: id, detail: `${nf} · ${fornecedor}`, origin: 'Engenharia (Pagador Tag)' });
    this.runAutomations(id, { type: 'create' }, 0);
    return this.requireItem(id);
  }

  createNote(values, file) {
    const errors = validateNewNote(values, { hasFile: Boolean(file) });
    if (errors.length) throw new HttpError(400, 'Revise os campos obrigatórios.', errors);
    const vis = formVisibility(values);
    const id = `L${Date.now().toString(36)}${(++this.uploadSeq).toString(36)}`;
    const dep = DEPARTMENTS.find((d) => d.id === Number(values.departmentId));
    const pay = PAYMENTS.find((p) => p.id === Number(values.paymentId));
    const dues = DUE_COLUMNS.map((_, i) => (i === 0 ? (vis.due ? validDate(values.dues?.[0]) : null) : (vis.dueMore ? validDate(values.dues?.[i]) : null)));
    const now = new Date().toISOString();
    const item = {
      id, name: '', nf: String(values.nf).trim(), supplierName: String(values.supplierName).trim(),
      supplierDoc: String(values.supplierDoc || '').trim(), supplierId: null,
      groupId: TAG_PENDING_GROUP, group: GROUP_BY_ID[TAG_PENDING_GROUP].title,
      departmentId: dep.id, department: dep.label,
      payer: vis.payer ? (values.payer || []) : [], address: vis.address ? [String(values.address).trim()] : [], addressIds: [],
      category: values.category, paymentId: pay.id, payment: pay.label,
      bank: vis.bank ? String(values.bank || '') : '', paymentNotes: '', approverNotes: '',
      otavio: '', engineering: '', status: '', value: Number(values.value),
      narrative: String(values.narrative).trim(), issueDate: validDate(values.issueDate), dues,
      files: file ? [{ id: `u${id}`, name: file.name, url: null, local: null }] : [], proofs: [],
      createdAt: now, updatedAt: now, mondayUrl: null,
    };
    this.created.unshift(item);
    this.log({ type: 'created', itemId: id, detail: `${item.nf} · ${item.supplierName}`, origin: 'formulário' });
    this.runAutomations(id, { type: 'create' }, 0);
    return this.requireItem(id);
  }
}
