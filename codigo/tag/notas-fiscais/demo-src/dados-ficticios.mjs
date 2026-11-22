// Dados 100% fictícios para a versão de demonstração publicada.
// Nenhum fornecedor, CNPJ, endereço, conta bancária ou valor vem do quadro real da Monday.
// Os nomes de grupos, departamentos, categorias e automações são a estrutura do processo (lib/catalog.mjs).
import { TAG, GROUPS, DEPARTMENTS, PAYMENTS } from './lib/catalog.mjs';

const HOLDING_PAGADOR = '001 - HOLDING SOROCABA';
const VV_PAGADOR = 'EMPRESA EXEMPLO SERVICOS LTDA';

const FORNECEDORES = [
  'Fornecedor Exemplo Alfa Ltda', 'Beta Serviços Demonstração ME', 'Gama Manutenções Fictícias Ltda',
  'Delta Construtora Modelo S.A.', 'Épsilon Elétrica Exemplo Ltda', 'Zeta Limpeza Demonstrativa ME',
  'Eta Consultoria Fictícia', 'Teta Materiais de Exemplo Ltda', 'Iota Telecom Exemplo S.A.',
  'Kappa Segurança Modelo Ltda', 'Lambda Jardinagem Fictícia', 'Mu Engenharia Demonstrativa Ltda',
  'Nu Transportes Exemplo', 'Xi Locações Modelo Ltda',
];
const NARRATIVAS = [
  'Serviço de manutenção preventiva (demonstração)', 'Material de escritório (demonstração)',
  'Taxa mensal de administração (demonstração)', 'Consumo de energia do período (demonstração)',
  'Limpeza e conservação do mês (demonstração)', 'Locação de equipamento (demonstração)',
  'Reparo emergencial no imóvel (demonstração)', 'Assessoria técnica contratada (demonstração)',
];
const ENDERECOS = [
  'Rua Exemplo, 100 - Centro', 'Avenida Modelo, 2000 - Bairro Fictício', 'Travessa Demonstração, 15',
  'Rua Teste, 450 - Sala 3',
];
const CATEGORIAS = [
  'Manutenção', 'Serviço', 'Material', 'Consumo Energia', 'Limpeza', 'Locações', 'Taxa ADM', 'Suporte TI',
];
const BANCO = 'Banco Exemplo S.A. · Ag 0001 · C/C 00000-0 · chave PIX fictícia';

// Mulberry32: gerador determinístico, para que a demonstração sempre tenha os mesmos dados.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDias = (base, dias) => new Date(base.getTime() + dias * 86400000);

// Plano por grupo: quantidade e decisão do Otávio / status. Espelha a distribuição do quadro, com dados inventados.
const PLANO = [
  { groupId: 'topics', n: 3, payer: HOLDING_PAGADOR, otavio: () => '', status: () => '', dept: [3] },
  { groupId: 'group_mm29vceb', n: 2, payer: VV_PAGADOR, otavio: () => '', status: () => '', dept: [1] },
  { groupId: 'group_mm2c28pe', n: 14, payer: TAG, otavio: (i) => (i < 10 ? '' : 'Reprovado'), status: () => '', dept: [0, 1, 2, 3, 6, 7, 8] },
  { groupId: 'group_mm2ct5t8', n: 6, payer: TAG, otavio: () => 'Aprovado', status: () => '', dept: [0, 1, 2, 3, 6, 7, 8] },
  { groupId: 'group_mm332dfe', n: 3, payer: TAG, otavio: () => 'Aprovado', status: () => 'Em andamento', dept: [0, 1, 2, 3, 6, 7, 8] },
  { groupId: 'group_mm2daf7r', n: 22, payer: TAG, otavio: () => 'Aprovado', status: () => 'Pago', dept: [0, 1, 2, 3, 6, 7, 8], comprovante: (i) => i < 16 },
  { groupId: 'group_mm2np6s6', n: 4, payer: TAG, otavio: () => 'Reprovado', status: () => '', dept: [0, 1, 2, 3, 6, 7, 8] },
];

export function gerarItens() {
  const r = rng(20261114);
  const grupos = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const itens = [];
  let k = 0;
  for (const p of PLANO) {
    for (let i = 0; i < p.n; i++, k++) {
      // Sorteia uma vez, antes da busca (sortear dentro do find mudava o índice a cada departamento testado).
      const deptId = p.dept[Math.floor(r() * p.dept.length)];
      const dep = DEPARTMENTS.find((d) => d.id === deptId);
      const pagId = PAYMENTS[Math.floor(r() * PAYMENTS.length)].id;
      const pag = PAYMENTS.find((x) => x.id === pagId);
      const fornecedor = FORNECEDORES[k % FORNECEDORES.length];
      const nf = String(1000 + k * 37);
      const emissao = addDias(new Date(Date.UTC(2026, 6, 1)), Math.floor(r() * 130));
      const vencto1 = addDias(emissao, 20 + Math.floor(r() * 40));
      const dues = Array(12).fill(null);
      if ([1, 2, 3, 4].includes(pagId)) dues[0] = iso(vencto1);
      if (pagId === 3) for (let d = 1; d < 4; d++) dues[d] = iso(addDias(vencto1, 30 * d));
      const addressOk = [1, 2, 8].includes(dep.id);
      const payer = p.payer === TAG || p.payer === HOLDING_PAGADOR || p.payer === VV_PAGADOR ? [p.payer] : [];
      const id = `d${100000 + k}`;
      const otavio = p.otavio(i);
      const status = p.status(i);
      const comprovante = p.comprovante && p.comprovante(i);
      const dt = (base) => `${iso(addDias(new Date(Date.UTC(2026, 7, 1)), Math.floor(r() * 90)))}T12:00:00.000Z`;
      itens.push({
        id,
        name: `${nf} - ${fornecedor}`,
        nf,
        supplierName: fornecedor,
        supplierDoc: `00.000.000/0001-${pad(k % 99)}`,
        supplierId: `s${k % 14}`,
        groupId: p.groupId,
        group: grupos[p.groupId].title,
        departmentId: dep.id,
        department: dep.label,
        payer,
        address: addressOk ? [ENDERECOS[k % ENDERECOS.length]] : [],
        addressIds: [],
        category: CATEGORIAS[k % CATEGORIAS.length],
        paymentId: pag.id,
        payment: pag.label,
        bank: pagId === 2 ? BANCO : '',
        paymentNotes: '',
        approverNotes: otavio === 'Reprovado' ? 'Falta documentação (demonstração)' : '',
        otavio,
        engineering: '',
        status,
        value: r() < 0.07 ? null : Math.round((500 + r() * 22000) * 100) / 100,
        narrative: NARRATIVAS[k % NARRATIVAS.length],
        issueDate: iso(emissao),
        dues,
        files: [{ id: `f${k}`, name: `NF ${nf} - ${fornecedor}.pdf`, url: null, local: 'documento-demo.pdf' }],
        proofs: comprovante ? [{ id: `p${k}`, name: `Comprovante ${nf}.pdf`, url: null, local: 'documento-demo.pdf' }] : [],
        createdAt: dt(),
        updatedAt: dt(),
        mondayUrl: null,
      });
    }
  }
  return itens;
}

export const SNAPSHOT_AT = '2026-11-14';
