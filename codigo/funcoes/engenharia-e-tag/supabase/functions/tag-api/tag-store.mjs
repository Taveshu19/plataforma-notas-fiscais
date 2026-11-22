// TAG real (16/11/2026): a lógica do Store local da TAG (notas-fiscais/lib/store.mjs), agora assíncrona e sobre um "repo" (banco).
// A regra é a mesma: nota, grupos, automações da Monday (criação, Otávio aprovado/reprovado, status, comprovantes), eventos e histórico.
// O que muda é só onde se guarda: o repo (tag_notas, tag_eventos, tag_automacoes, tag_outbox e o bucket tag-arquivos).
// Nada aqui chama a API da Monday. Roda no Node (testes) e no Deno (função tag-api).
import { AUTOMATIONS, GROUP_BY_ID, OTAVIO_LABELS, PAYMENT_STATUS_LABELS, DEPARTMENTS, PAYMENTS, PAYERS, CATEGORIES, DUE_COLUMNS } from './catalog.mjs';
import { matchingAutomations, planEffects, MAX_CASCADE } from './rules.mjs';
import { formVisibility, validateNewNote } from './form.mjs';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const TAG_PENDING_GROUP = 'group_mm2c28pe';

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
const uuid = () => globalThis.crypto.randomUUID();

// Linha enxuta para a tabela. O detalhe completo vem de /api/items/:id.
export function lean(it) {
  const dues = (it.dues || []).filter(Boolean).sort();
  return {
    id: it.id, name: it.name, nf: it.nf, supplierName: it.supplierName, supplierDoc: it.supplierDoc,
    groupId: it.groupId, group: it.group, departmentId: it.departmentId, department: it.department,
    payer: it.payer, address: it.address, category: it.category, payment: it.payment, paymentId: it.paymentId,
    value: it.value, narrative: it.narrative, issueDate: it.issueDate, dueDate: dues[0] || null,
    otavio: it.otavio, status: it.status, filesCount: it.files.length, proofsCount: it.proofs.length,
    preview: it.files.find(f => /\.pdf$/i.test(f.name) && f.local) || null,
    createdAt: it.createdAt, updatedAt: it.updatedAt,
    otavioAt: it.otavioAt || null, groupAt: it.groupAt || null, approverNotes: it.approverNotes || '',   // 18/11/2026: data da decisão do Otávio e da última mudança de grupo
  };
}

export class TagStore {
  // repo: getNota(id), listLeves(), saveNota(doc, leve), addEvento(rec), listEventos({itemId, limit}), getAutomacoes(), setAutomacao(id, ativa),
  //       addOutbox(rec), listOutbox(), getMeta(chave), storeFile(bucket, path, bytes, contentType)
  constructor(repo, actor = 'Operador') {
    this.repo = repo;
    this.actor = actor;
    this.cache = new Map();
  }

  // ---------- leitura ----------
  async automations() {
    const estado = await this.repo.getAutomacoes();
    return AUTOMATIONS.map((a) => ({ ...a, enabled: estado[a.id] !== undefined ? estado[a.id] : a.enabled }));
  }
  async getItem(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const doc = await this.repo.getNota(id);
    if (doc) this.cache.set(id, doc);
    return doc;
  }
  async requireItem(id) {
    const item = await this.getItem(id);
    if (!item) throw httpError(404, 'Nota não encontrada.');
    return item;
  }
  async allLean() { return this.repo.listLeves(); }
  async events({ itemId = null, limit = 200 } = {}) { return this.repo.listEventos({ itemId, limit }); }
  async outbox() { return this.repo.listOutbox(); }

  // ---------- escrita ----------
  async save(item) {
    item.updatedAt = new Date().toISOString();
    this.cache.set(item.id, item);
    await this.repo.saveNota(item, lean(item));
  }
  async event(e) {
    const rec = { id: uuid(), at: new Date().toISOString(), actor: this.actor, ...e };
    await this.repo.addEvento(rec);
    return rec;
  }

  // Exclusão (16/11/2026, pedido do Gustavo): a nota inteira fica guardada no evento 'note_deleted' (dá para restaurar); os arquivos continuam no bucket.
  async deleteNote(id) {
    const item = await this.requireItem(id);
    await this.event({ type: 'note_deleted', itemId: id, snapshot: item });
    await this.repo.deleteNota(id);
    this.cache.delete(id);
    return item;
  }

  async setAutomationEnabled(id, enabled) {
    const a = AUTOMATIONS.find((x) => x.id === id);
    if (!a) throw httpError(404, 'Automação não encontrada.');
    const antes = (await this.automations()).find((x) => x.id === id).enabled;
    await this.repo.setAutomacao(id, Boolean(enabled));
    await this.event({ type: 'automation_toggled', itemId: null, detail: `${a.title}: ${antes ? 'ativa' : 'desativada'} → ${enabled ? 'ativa' : 'desativada'}` });
    return (await this.automations()).find((x) => x.id === id);
  }

  // Edição de campos da nota (não dispara automações: o quadro não tem automação para estes campos).
  async patchFields(id, patch, origin = 'manual') {
    const item = await this.requireItem(id);
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
      await this.save(item);
      for (const c of changes) await this.event({ type: 'field_changed', itemId: id, origin, ...c });
    }
    return { item, changes: changes.length };
  }

  async moveGroup(id, groupId, origin = { type: 'manual' }) {
    const item = await this.requireItem(id);
    const g = GROUP_BY_ID[groupId];
    if (!g) throw httpError(400, 'Grupo inválido.');
    const from = item.group;
    if (item.groupId === groupId) return item;
    item.groupId = groupId;
    item.group = g.title;
    item.groupAt = new Date().toISOString();
    // 18/11/2026 (Gustavo): grupo e Aprovação Otávio sempre coerentes (reprovadas = Reprovado; aprovadas, aguardando e pagas = Aprovado; pendentes = Em analise).
    const decisao = g.company !== 'TAG' ? null : g.stage === 'rejected' ? 'Reprovado' : ['approved', 'awaiting', 'paid'].includes(g.stage) ? 'Aprovado' : g.stage === 'pending' ? 'Em analise' : null;
    const otavioAntes = item.otavio;
    if (decisao && item.otavio !== decisao) { item.otavio = decisao; item.otavioAt = item.groupAt; }
    await this.save(item);
    await this.event({ type: 'group_changed', itemId: id, from, to: g.title, origin: origin.type, automation: origin.automation || null });
    if (decisao && otavioAntes !== decisao) await this.event({ type: 'column_changed', itemId: id, column: 'Aprovação Otávio', from: otavioAntes || '', to: decisao, origin: 'grupo', automation: null });
    return item;
  }

  // Altera uma coluna com status e dispara as automações correspondentes.
  async setColumn(id, column, value, origin = { type: 'manual' }, depth = 0) {
    const item = await this.requireItem(id);
    if (column === 'otavio') {
      if (value && !OTAVIO_LABELS.includes(value)) throw httpError(400, 'Valor inválido para Aprovação Otávio.');
      const from = item.otavio;
      if (from === value) return item;
      item.otavio = value;
      item.otavioAt = new Date().toISOString();
      await this.save(item);
      await this.event({ type: 'column_changed', itemId: id, column: 'Aprovação Otávio', from, to: value, origin: origin.type, automation: origin.automation || null });
      await this.runAutomations(id, { type: 'set', column: 'otavio', from, to: value }, depth);
      return this.requireItem(id);
    }
    if (column === 'status') {
      if (value && !PAYMENT_STATUS_LABELS.includes(value)) throw httpError(400, 'Valor inválido para Status.');
      const from = item.status;
      if (from === value) return item;
      item.status = value;
      await this.save(item);
      await this.event({ type: 'column_changed', itemId: id, column: 'Status', from, to: value, origin: origin.type, automation: origin.automation || null });
      await this.runAutomations(id, { type: 'set', column: 'status', from, to: value }, depth);
      return this.requireItem(id);
    }
    if (column === 'payer') {
      const asList = Array.isArray(value) ? value : (value ? [value] : []);
      const list = asList.filter((p) => PAYERS.includes(p));
      const from = item.payer;
      item.payer = list;
      await this.save(item);
      await this.event({ type: 'column_changed', itemId: id, column: 'Pagador', from: from.join(', '), to: list.join(', '), origin: origin.type, automation: origin.automation || null });
      return item;
    }
    if (column === 'name') {
      const from = item.name;
      item.name = String(value ?? '');
      await this.save(item);
      await this.event({ type: 'column_changed', itemId: id, column: 'Nome', from, to: item.name, origin: origin.type, automation: origin.automation || null });
      return item;
    }
    throw httpError(400, `Coluna não suportada: ${column}`);
  }

  async addProof(id, file) {
    const item = await this.requireItem(id);
    item.proofs = [...item.proofs, file];
    await this.save(item);
    await this.event({ type: 'file_added', itemId: id, column: 'Comprovantes', file: file.name });
    await this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  async removeProof(id, fileId) {
    const item = await this.requireItem(id);
    const file = item.proofs.find((f) => f.id === fileId);
    if (!file) throw httpError(404, 'Comprovante não encontrado.');
    item.proofs = item.proofs.filter((f) => f.id !== fileId);
    await this.save(item);
    await this.event({ type: 'file_removed', itemId: id, column: 'Comprovantes', file: file.name });
    // Igual ao Monday: qualquer alteração na coluna dispara a automação, inclusive remoção.
    await this.runAutomations(id, { type: 'change', column: 'proofs' }, 0);
    return this.requireItem(id);
  }

  // Arquivos da nota (NF, boleto) incluídos ou removidos pela tela (17/11/2026, Gustavo): o mesmo que os painéis já permitem.
  // Não disparam automação (a da Monday é só para Comprovantes). Ficam no histórico da nota.
  async addFile(id, file) {
    const item = await this.requireItem(id);
    item.files = [...(item.files || []), file];
    await this.save(item);
    await this.event({ type: 'file_added', itemId: id, column: 'Arquivos', file: file.name });
    return this.requireItem(id);
  }

  async removeFile(id, fileId) {
    const item = await this.requireItem(id);
    const file = (item.files || []).find((f) => f.id === fileId);
    if (!file) throw httpError(404, 'Arquivo não encontrado.');
    item.files = item.files.filter((f) => f.id !== fileId);
    await this.save(item);
    await this.event({ type: 'file_removed', itemId: id, column: 'Arquivos', file: file.name });
    return this.requireItem(id);
  }

  // Executa as automações que casam com a alteração. Cascata limitada a MAX_CASCADE.
  async runAutomations(id, change, depth = 0) {
    if (depth >= MAX_CASCADE) {
      await this.event({ type: 'automation_stopped', itemId: id, detail: 'Limite de encadeamento atingido.' });
      return;
    }
    const matched = matchingAutomations(change, await this.automations());
    for (const a of matched) {
      const item = await this.requireItem(id);
      const steps = planEffects(item, a);
      await this.event({ type: 'automation_run', itemId: id, automationId: a.id, detail: a.title, steps: steps.length });
      const origin = { type: 'automation', automation: a.id };
      for (const step of steps) {
        if (step.kind === 'set') await this.setColumn(id, step.column, step.value, origin, depth + 1);
        else if (step.kind === 'move') await this.moveGroup(id, step.groupId, origin);
        else if (step.kind === 'email') await this.queueEmail(id, step, a.id);
      }
    }
  }

  async queueEmail(id, step, automationId) {
    const rec = {
      id: uuid(), at: new Date().toISOString(), itemId: id, automationId,
      to: ['beatriz.martins@empresa.exemplo'], subject: step.subject, body: step.body,   // 18/11/2026: reprovação avisa a Beatriz
      status: 'pendente',
      note: 'Enviado pela caixa do painel (Microsoft Graph).',
    };
    await this.repo.addOutbox(rec);
    await this.event({ type: 'email_queued', itemId: id, automationId, detail: step.subject });
  }

  // Lançamento de nota (formulário). Cria no grupo TAG pendentes e roda a automação de criação.
  async createNote(values, file) {
    const errors = validateNewNote(values, { hasFile: Boolean(file) });
    if (errors.length) throw httpError(400, 'Revise os campos obrigatórios.', errors);
    const vis = formVisibility(values);
    const id = `L${Date.now().toString(36)}${uuid().slice(0, 6)}`;
    const dep = DEPARTMENTS.find((d) => d.id === Number(values.departmentId));
    const pay = PAYMENTS.find((p) => p.id === Number(values.paymentId));
    const dues = DUE_COLUMNS.map((_, i) => {
      if (i === 0) return vis.due ? validDate(values.dues?.[0]) : null;
      return vis.dueMore ? validDate(values.dues?.[i]) : null;
    });
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
      files: [], proofs: [], createdAt: now, updatedAt: now, mondayUrl: null,
    };
    if (file) item.files = [await this.storeUpload(id, file, 'files')];
    await this.save(item);
    await this.event({ type: 'created', itemId: id, detail: `${item.nf} · ${item.supplierName}`, origin: 'formulário' });
    await this.runAutomations(id, { type: 'create' }, 0);
    return this.requireItem(id);
  }

  // Arquivos enviados pela tela ficam no bucket tag-arquivos, em <idDaNota>/<idDoArquivo>-<nome>.
  async storeUpload(itemId, file, kind) {
    const fileId = uuid().slice(0, 8);
    const safe = String(file.name || 'arquivo').replace(/[^\w.\- ()]/g, '_').slice(0, 120);
    const path = `${itemId}/${fileId}-${safe}`;
    const tipo = /\.pdf$/i.test(safe) ? 'application/pdf' : /\.png$/i.test(safe) ? 'image/png' : /\.jpe?g$/i.test(safe) ? 'image/jpeg' : 'application/octet-stream';
    await this.repo.storeFile('tag-arquivos', path, file.buffer, tipo);
    return { id: fileId, name: safe, url: null, local: `storage:tag-arquivos/${path}`, kind, origin: 'tela' };
  }
}

export { OTAVIO_LABELS, PAYMENT_STATUS_LABELS };
