// Motor de regras que replica as automações do quadro Notas Fiscais.
// Funções puras: planejam o que fazer; quem executa é lib/store.mjs.
import { AUTOMATIONS, TAG, EMAIL_TEMPLATE, GROUP_BY_ID } from './catalog.mjs';

// Quais automações disparam para uma alteração.
// change = { type: 'create' } | { type: 'set', column, from, to } | { type: 'change', column }
export function matchingAutomations(change, automations = AUTOMATIONS) {
  return automations.filter((a) => {
    if (!a.enabled) return false;
    const t = a.trigger;
    if (change.type === 'create') return t.type === 'create';
    if (change.type === 'set') {
      if (t.type === 'set') return t.column === change.column && t.value === change.to && change.from !== change.to;
      if (t.type === 'change') return t.column === change.column;
      return false;
    }
    if (change.type === 'change') return t.type === 'change' && t.column === change.column;
    return false;
  });
}

// Converte as ações de uma automação em efeitos concretos sobre a nota.
// Retorna uma lista de passos legíveis, para o histórico mostrar o que aconteceu.
export function planEffects(item, automation) {
  const steps = [];
  for (const action of automation.actions) {
    if (action.type === 'name') {
      const nf = item.nf || '';
      const sup = item.supplierName || '';
      steps.push({ kind: 'set', column: 'name', value: `${nf} - ${sup}`.trim(), label: 'Nome' });
    } else if (action.type === 'set') {
      steps.push({ kind: 'set', column: action.column, value: action.value, label: action.column });
    } else if (action.type === 'move') {
      const g = GROUP_BY_ID[action.groupId];
      if (g) steps.push({ kind: 'move', groupId: action.groupId, label: g.title });
    } else if (action.type === 'email') {
      const name = item.name || '';
      steps.push({
        kind: 'email',
        subject: EMAIL_TEMPLATE.subject(name),
        body: EMAIL_TEMPLATE.body(name, item.otavio, item.approverNotes),
        label: 'E-mail (fila de envio)',
      });
    }
  }
  return steps;
}

export const MAX_CASCADE = 5;

export { TAG };
