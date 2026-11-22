// Converte o export de get_board_items_page (Monday) no formato interno da tela.
// Somente leitura: nada aqui escreve na Monday.
import { DEPARTMENTS, DUE_COLUMNS, COLUMNS, GROUP_BY_ID } from './catalog.mjs';

const MIRROR_UNSUPPORTED = 'Column value type is not supported';

const clean = (v) => (v === null || v === undefined || v === MIRROR_UNSUPPORTED ? '' : String(v).trim());

function departmentFromLabel(label) {
  const t = clean(label);
  if (!t) return { departmentId: null, department: '' };
  const d = DEPARTMENTS.find((x) => x.label === t || x.mondayLabel === t);
  return { departmentId: d ? d.id : null, department: d ? d.label : t };
}

function paymentFromLabel(label) {
  const map = { 'Boleto': 1, 'Dados bancários': 2, 'Parcelado': 3, 'Cartão de crédito': 4, 'Link de Crédito': 5, 'Pago por terceiro': 7 };
  const t = clean(label);
  return { paymentId: map[t] ?? null, payment: t };
}

// A coluna de arquivos traz URLs separadas por vírgula. O id do recurso identifica o arquivo local.
export function parseFiles(value, localIndex) {
  const text = clean(value);
  if (!text) return [];
  return [...text.matchAll(/https:\/\/[^\s,]+/g)].map((m) => {
    const url = m[0];
    const resourceId = url.match(/resources\/(\d+)/)?.[1] ?? null;
    let name = 'Documento';
    try { name = decodeURIComponent(url.split('/').pop()); } catch { name = url.split('/').pop(); }
    const local = resourceId ? localIndex.get(resourceId) ?? null : null;
    return { id: resourceId || url, name, url, local };
  });
}

export function normalizeItem(raw, localIndex = new Map()) {
  const cv = raw.column_values || {};
  const group = raw.group || {};
  const groupMeta = GROUP_BY_ID[group.id];
  const supplierLink = Array.isArray(cv[COLUMNS.supplierLink]) ? cv[COLUMNS.supplierLink][0] : null;
  const addresses = Array.isArray(cv[COLUMNS.address]) ? cv[COLUMNS.address] : [];
  const payerText = clean(cv[COLUMNS.payer]);
  const dep = departmentFromLabel(cv[COLUMNS.department]);
  const pay = paymentFromLabel(cv[COLUMNS.payment]);
  const valueText = clean(cv[COLUMNS.value]);

  return {
    id: String(raw.id),
    name: raw.name,
    nf: clean(cv[COLUMNS.nf]),
    supplierName: clean(cv[COLUMNS.supplierName]) || (supplierLink ? clean(supplierLink.name) : ''),
    supplierDoc: supplierLink ? clean(supplierLink.name) : '',
    supplierId: supplierLink ? String(supplierLink.id) : null,
    groupId: group.id || null,
    group: group.title || groupMeta?.title || '',
    departmentId: dep.departmentId,
    department: dep.department,
    payer: payerText ? payerText.split(/,\s*/).filter(Boolean) : [],
    address: addresses.map((a) => a.name),
    addressIds: addresses.map((a) => String(a.id)),
    category: clean(cv[COLUMNS.category]),
    paymentId: pay.paymentId,
    payment: pay.payment,
    bank: clean(cv[COLUMNS.bank]),
    paymentNotes: clean(cv[COLUMNS.paymentNotes]),
    approverNotes: clean(cv[COLUMNS.approverNotes]),
    otavio: clean(cv[COLUMNS.otavio]),
    engineering: clean(cv[COLUMNS.engineering]),
    status: clean(cv[COLUMNS.status]),
    value: valueText === '' ? null : Number(valueText),
    narrative: clean(cv[COLUMNS.narrative]),
    issueDate: clean(cv[COLUMNS.issueDate]) || null,
    dues: DUE_COLUMNS.map((k) => clean(cv[k]) || null),
    files: parseFiles(cv[COLUMNS.file], localIndex),
    proofs: parseFiles(cv[COLUMNS.proofs], localIndex),
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
    mondayUrl: raw.url || null,
  };
}

// Índice: id do recurso do Monday -> caminho local (pasta da Central TAG).
export function buildLocalIndex(manifest, filesDirRelative) {
  const idx = new Map();
  for (const m of manifest) {
    if (m && m.id && m.filename) idx.set(String(m.id), `${filesDirRelative}/${m.filename}`);
  }
  return idx;
}
