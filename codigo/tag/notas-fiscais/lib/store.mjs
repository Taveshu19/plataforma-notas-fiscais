// Estado local da tela. A base é o snapshot exportado da Monday (somente leitura).
// Tudo que a tela altera fica em data/state.json e no histórico data/events.jsonl.
// Nada aqui chama a API da Monday.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, renameSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { requestActor } from './access.mjs';
import { join, dirname } from 'node:path';
import {
  AUTOMATIONS, GROUP_BY_ID, OTAVIO_LABELS, PAYMENT_STATUS_LABELS, DEPARTMENTS, PAYMENTS, PAYERS,
  CATEGORIES, DUE_COLUMNS, TAG,
} from './catalog.mjs';
import { matchingAutomations, planEffects, MAX_CASCADE } from './rules.mjs';
import { formVisibility, validateNewNote } from './form.mjs';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TAG_PENDING_GROUP = 'group_mm2c28pe';

export class Store {
  constructor({ dataDir, snapshotPath, actor = 'Operador local' }) {
    this.dataDir = dataDir;
    this.actor = actor;
    this.statePath = join(dataDir, 'state.json');
    this.eventsPath = join(dataDir, 'events.jsonl');
    this.outboxPath = join(dataDir, 'outbox.jsonl');
    mkdirSync(dataDir, { recursive: true });

    const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    this.snapshotAt = snap.snapshotAt;
    this.snapshotSource = snap.source;
    this.base = new Map(snap.items.map((it) => [it.id, it]));
    this.baseOrder = snap.items.map((it) => it.id);

    this.state = { overrides: {}, created: [], automations: {} };
    if (existsSync(this.statePath)) {
      this.state = { ...this.state, ...JSON.parse(readFileSync(this.statePath, 'utf8')) };
    }
  }

  // ---------- leitura ----------
  automations() {
    return AUTOMATIONS.map((a) => ({
      ...a,
      enabled: this.state.automations[a.id] !== undefined ? this.state.automations[a.id] : a.enabled,
    }));
  }

  getItem(id) {
    if (this.state.overrides[id]) return this.state.overrides[id];
    const created = this.state.created.find((c) => c.id === id);
    if (created) return created;
    return this.base.get(id) || null;
  }

  allItems() {
    const createdIds = new Set(this.state.created.map((c) => c.id));
    const baseItems = this.baseOrder
      .filter((id) => !createdIds.has(id))
      .map((id) => this.getItem(id));
    return [...this.state.created, ...baseItems];
  }

  events({ itemId = null, limit = 200 } = {}) {
    if (!existsSync(this.eventsPath)) return [];
    const lines = readFileSync(this.eventsPath, 'utf8').split('\n').filter(Boolean);
    let list = lines.map((l) => JSON.parse(l));
    if (itemId) list = list.filter((e) => e.itemId === itemId);
    return list.slice(-limit).reverse();
  }

  outbox() {
    if (!existsSync(this.outboxPath)) return [];
    return readFileSync(this.outboxPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse();
  }

  // ---------- escrita (somente local) ----------
  persist() {
    const tmp = `${this.statePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    renameSync(tmp, this.statePath);
  }

  event(e) {
    const rec = { id: randomUUID(), at: new Date().toISOString(), actor: requestActor.getStore()?.email || this.actor, ...e };
    appendFileSync(this.eventsPath, JSON.stringify(rec) + '\n', 'utf8');
    return rec;
  }

  save(item) {
    const existsCreated = this.state.created.findIndex((c) => c.id === item.id);
    if (existsCreated >= 0) this.state.created[existsCreated] = item;
    else this.state.overrides[item.id] = item;
    item.updatedAt = new Date().toISOString();
    this.persist();
  }

  setAutomationEnabled(id, enabled) {
    const a = AUTOMATIONS.find((x) => x.id === id);
    if (!a) throw httpError(404, 'Automação não encontrada.');
    const before = this.automations().find((x) => x.id === id).enabled;
    this.state.automations[id] = Boolean(enabled);
    this.persist();
    this.event({ type: 'automation_toggled', itemId: null, detail: `${a.title}: ${before ? 'ativa' : 'desativada'} → ${enabled ? 'ativa' : 'desativada'}` });
    return this.automations().find((x) => x.id === id);
  }

  // Edição de campos da nota (não dispara automações: o quadro não tem automação para estes campos).
  patchFields(id, patch, origin = 'manual') {
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
          if (!d) throw httpError(400, 'Departamento inválido.');
          set('departmentId', d.id, 'Departamento'); item.department = d.label; break;
        }
        case 'payer': {
          const list = (raw || []).filter((p) => PAYERS.includes(p));
          set('payer', list, 'Pagador'); break;
        }
        case 'address': set('address', (raw || []).map(String).filter(Boolean), 'Endereço'); break;
        case 'category': {
          if (raw === null || raw === '') { set('category', '', 'Categoria'); break; }
          if (!CATEGORIES.includes(raw)) throw httpError(400, 'Categoria inválida.');
          set('category', raw, 'Categoria'); break;
        }
        case 'paymentId': {
          if (raw === null || raw === '') { set('paymentId', null, 'Pagamento'); item.payment = ''; break; }
          const p = PAYMENTS.find((x) => x.id === Number(raw));
          if (!p) throw httpError(400, 'Forma de pagamento inválida.');
          set('paymentId', p.id, 'Pagamento'); item.payment = p.label; break;
        }
        case 'value': {
          const v = raw === null || raw === '' ? null : Number(raw);
          if (v !== null && !(v >= 0)) throw httpError(400, 'Valor inválido.');
          set('value', v, 'Valor'); break;
        }
        case 'issueDate': set('issueDate', validDate(raw), 'Data de emissão'); break;
        case 'dues': {
          if (!Array.isArray(raw) || raw.length !== DUE_COLUMNS.length) throw httpError(400, 'Vencimentos inválidos.');
          set('dues', raw.map(validDate), 'Vencimentos'); break;
        }
        case 'narrative': set('narrative', String(raw ?? ''), 'Narrativa'); break;
        case 'bank': set('bank', String(raw ?? ''), 'Dados bancários'); break;
        case 'paymentNotes': set('paymentNotes', String(raw ?? ''), 'Observação - Pagamento'); break;
        case 'approverNotes': set('approverNotes', String(raw ?? ''), 'Observações Aprovador'); break;
        default: throw httpError(400, `Campo não editável: ${key}`);
      }
    }
    if (changes.length) {
      this.save(item);
      for (const c of changes) this.event({ type: 'field_changed', itemId: id, origin, ...c });
    }
    return { item, changes: changes.length };
  }

  moveGroup(id, groupId, origin = { type: 'manual' }, depth = 0) {
    const item = this.requireItem(id);
    const g = GROUP_BY_ID[groupId];
    if (!g) throw httpError(400, 'Grupo inválido.');
    const from = item.group;
    if (item.groupId === groupId) return item;
    item.groupId = groupId;
    item.group = g.title;
    this.save(item);
    this.event({ type: 'group_changed', itemId: id, from, to: g.title, origin: origin.type, automation: origin.automation || null });
    return item;
  }

  // Altera uma coluna com status e dispara as automações correspondentes.
  setColumn(id, column, value, origin = { type: 'manual' }, depth = 0) {
    const item = this.requireItem(id);
    if (column === 'otavio') {
      if (value && !OTAVIO_LABELS.includes(value)) throw httpError(400, 'Valor inválido para Aprovação Otávio.');
      const from = item.otavio;
      if (from === value) return item;
      item.otavio = value;
      this.save(item);
      this.event({ type: 'column_changed', itemId: id, column: 'Aprovação Otávio', from, to: value, origin: origin.type, automation: origin.automation || null });
      this.runAutomations(id, { type: 'set', column: 'otavio', from, to: value }, depth);
      return this.requireItem(id);
    }
    if (column === 'status') {
      if (value && !PAYMENT_STATUS_LABELS.includes(value)) throw httpError(400, 'Valor inválido para Status.');
      const from = item.status;
      if (from === value) return item;
      item.status = value;
      this.save(item);
      this.event({ type: 'column_changed', itemId: id, column: 'Status', from, to: value, origin: origin.type, automation: origin.automation || null });
      this.runAutomations(id, { type: 'set', column: 'status', from, to: value }, depth);
      return this.requireItem(id);
    }
    if (column === 'payer') {
      const asList = Array.isArray(value) ? value : (value ? [value] : []);
      const list = asList.filter((p) => PAYERS.includes(p));
      const from = item.payer;
      item.payer = list;
      this.save(item);
      this.event({ type: 'column_changed', itemId: id, column: 'Pagador', from: from.join(', '), to: list.join(', '), origin: origin.type, automation: origin.automation || null });
      return item;
    }
    if (column === 'name') {
      const from = item.name;
      item.name = String(value ?? '');
      this.save(item);
      this.event({ type: 'column_changed', itemId: id, column: 'Nome', from, to: item.name, origin: origin.type, automation: origin.automation || null });
      return item;
    }
    throw httpError(400, `Coluna não suportada: ${column}`);
  }

  addProof(id, file) {
    const item = this.requireItem(id);
    item.proofs = [...item.proofs, file];
    this.save(item);
    this.event({ type: 'file_added', itemId: id, column: 'Comprovantes', file: file.name });
    this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  removeProof(id, fileId) {
    const item = this.requireItem(id);
    const file = item.proofs.find((f) => f.id === fileId);
    if (!file) throw httpError(404, 'Comprovante não encontrado.');
    item.proofs = item.proofs.filter((f) => f.id !== fileId);
    this.save(item);
    this.event({ type: 'file_removed', itemId: id, column: 'Comprovantes', file: file.name });
    // Igual ao Monday: qualquer alteração na coluna dispara a automação, inclusive remoção.
    this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  // Executa as automações que casam com a alteração. Cascata limitada a MAX_CASCADE.
  runAutomations(id, change, depth = 0) {
    if (depth >= MAX_CASCADE) {
      this.event({ type: 'automation_stopped', itemId: id, detail: 'Limite de encadeamento atingido.' });
      return;
    }
    const matched = matchingAutomations(change, this.automations());
    for (const a of matched) {
      const item = this.requireItem(id);
      const steps = planEffects(item, a);
      this.event({ type: 'automation_run', itemId: id, automationId: a.id, detail: a.title, steps: steps.length });
      const origin = { type: 'automation', automation: a.id };
      for (const step of steps) {
        if (step.kind === 'set') this.setColumn(id, step.column, step.value, origin, depth + 1);
        else if (step.kind === 'move') this.moveGroup(id, step.groupId, origin, depth + 1);
        else if (step.kind === 'email') this.queueEmail(id, step, a.id);
      }
    }
  }

  queueEmail(id, step, automationId) {
    const rec = {
      id: randomUUID(), at: new Date().toISOString(), itemId: id, automationId,
      to: [], subject: step.subject, body: step.body,
      status: 'nao_enviado',
      note: 'Envio desativado nesta versão. Destinatários (assinantes do item) não foram migrados.',
    };
    appendFileSync(this.outboxPath, JSON.stringify(rec) + '\n', 'utf8');
    this.event({ type: 'email_queued', itemId: id, automationId, detail: step.subject });
  }

  // Lançamento de nota (formulário). Cria no grupo TAG pendentes e roda a automação de criação.
  createNote(values, file) {
    const errors = validateNewNote(values, { hasFile: Boolean(file) });
    if (errors.length) throw httpError(400, 'Revise os campos obrigatórios.', errors);
    const vis = formVisibility(values);
    const id = `L${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
    const dep = DEPARTMENTS.find((d) => d.id === Number(values.departmentId));
    const pay = PAYMENTS.find((p) => p.id === Number(values.paymentId));
    const dues = DUE_COLUMNS.map((_, i) => {
      if (i === 0) return vis.due ? validDate(values.dues?.[0]) : null;
      return vis.dueMore ? validDate(values.dues?.[i]) : null;
    });
    const now = new Date().toISOString();
    const item = {
      id,
      name: '',
      nf: String(values.nf).trim(),
      supplierName: String(values.supplierName).trim(),
      supplierDoc: String(values.supplierDoc || '').trim(),
      supplierId: null,
      groupId: TAG_PENDING_GROUP,
      group: GROUP_BY_ID[TAG_PENDING_GROUP].title,
      departmentId: dep.id,
      department: dep.label,
      payer: vis.payer ? (values.payer || []) : [],
      address: vis.address ? [String(values.address).trim()] : [],
      addressIds: [],
      category: values.category,
      paymentId: pay.id,
      payment: pay.label,
      bank: vis.bank ? String(values.bank || '') : '',
      paymentNotes: '',
      approverNotes: '',
      otavio: '',
      engineering: '',
      status: '',
      value: Number(values.value),
      narrative: String(values.narrative).trim(),
      issueDate: validDate(values.issueDate),
      dues,
      files: [],
      proofs: [],
      createdAt: now,
      updatedAt: now,
      mondayUrl: null,
    };
    if (file) item.files = [this.storeUpload(id, file, 'files')];
    this.state.created.unshift(item);
    this.persist();
    this.event({ type: 'created', itemId: id, detail: `${item.nf} · ${item.supplierName}`, origin: 'formulário' });
    this.runAutomations(id, { type: 'create' }, 0);
    return this.requireItem(id);
  }

  // Arquivos enviados pela tela ficam em data/uploads/<itemId>/.
  storeUpload(itemId, file, kind) {
    const fileId = randomUUID().slice(0, 8);
    const safe = String(file.name || 'arquivo').replace(/[^\w.\- ()]/g, '_').slice(0, 120);
    const dir = join(this.dataDir, 'uploads', itemId);
    mkdirSync(dir, { recursive: true });
    const rel = join('data', 'uploads', itemId, `${fileId}-${safe}`).replace(/\\/g, '/');
    writeFileSync(join(this.dataDir, '..', rel), file.buffer);
    return { id: fileId, name: safe, url: null, local: rel, kind, origin: 'tela' };
  }

  requireItem(id) {
    const item = this.getItem(id);
    if (!item) throw httpError(404, 'Nota não encontrada.');
    return item;
  }
}

export function httpError(status, message, details) {
  const e = new Error(message);
  e.status = status;
  e.details = details;
  return e;
}

function validDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!ISO.test(String(v))) throw httpError(400, `Data inválida: ${v}`);
  return String(v);
}

export { TAG, OTAVIO_LABELS, PAYMENT_STATUS_LABELS };
