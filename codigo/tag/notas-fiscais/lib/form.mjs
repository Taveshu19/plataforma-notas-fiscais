// Regras do formulário "Formulário" do quadro (mesmas condições de exibição e obrigatoriedade).
import { DUE_COLUMNS, DEPARTMENTS, PAYMENTS, PAYERS, CATEGORIES } from './catalog.mjs';

// Condições reais do Monday:
// - Pagador aparece para os departamentos 0,1,2,3,6,7,8
// - Endereço aparece para os departamentos 1,2,8
// - Dados bancários aparece para o pagamento 2
// - Vencimento 01 aparece para os pagamentos 1,2,3,4
// - Vencimentos 02 a 12 aparecem para o pagamento 3 (Parcelado)
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export function formVisibility(values) {
  const dep = num(values.departmentId);
  const pay = num(values.paymentId);
  return {
    payer: [0, 1, 2, 3, 6, 7, 8].includes(dep),
    address: [1, 2, 8].includes(dep),
    bank: pay === 2,
    due: [1, 2, 3, 4].includes(pay),
    dueMore: pay === 3,
  };
}

export function validateNewNote(values, { hasFile }) {
  const errors = [];
  const vis = formVisibility(values);
  const need = (cond, key, msg) => { if (cond) errors.push({ field: key, message: msg }); };

  need(!String(values.nf ?? '').trim(), 'nf', 'Informe o número da nota fiscal.');
  need(!String(values.supplierName ?? '').trim(), 'supplierName', 'Informe o fornecedor.');
  need(!DEPARTMENTS.some((d) => d.id === num(values.departmentId)), 'departmentId', 'Selecione o departamento / empresa.');
  need(vis.payer && !(values.payer || []).length, 'payer', 'Selecione o pagador.');
  need(vis.address && !String(values.address ?? '').trim(), 'address', 'Informe o endereço do imóvel.');
  need(!CATEGORIES.includes(values.category), 'category', 'Selecione a categoria.');
  need(!hasFile, 'file', 'Anexe o PDF da nota fiscal e do boleto.');
  need(!values.issueDate, 'issueDate', 'Informe a data de emissão.');
  need(!String(values.narrative ?? '').trim(), 'narrative', 'Descreva a finalidade do serviço.');
  need(!(Number(values.value) > 0), 'value', 'Informe o valor.');
  need(!PAYMENTS.some((p) => p.id === num(values.paymentId)), 'paymentId', 'Selecione a forma de pagamento.');
  need(vis.bank && !String(values.bank ?? '').trim(), 'bank', 'Informe os dados bancários.');
  need(vis.due && !values.dues?.[0], 'dues', 'Informe o vencimento 01.');
  return errors;
}

export function normalizePayers(list) {
  return (list || []).filter((p) => PAYERS.includes(p));
}

export { DUE_COLUMNS };
