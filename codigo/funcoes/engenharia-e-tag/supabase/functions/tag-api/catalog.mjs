// Catálogo do quadro "Notas Fiscais" (Monday 18407995628), com os mesmos ids e rótulos
// usados nas colunas de status/dropdown. Fonte: get_board_info em 14/11/2026.

export const BOARD = {
  id: '18407995628',
  name: 'Notas Fiscais',
  workspace: 'Administrativo',
  mondayUrl: 'https://exemplo.monday.com/boards/0000000000',
};

export const TAG = 'TAG EXEMPLO FUNDO DE INVESTIMENTO IMOBILIARIO';

// Grupos do quadro. "stage" é a etapa do fluxo; "company" é a empresa dona da nota.
export const GROUPS = [
  { id: 'topics', title: 'Holding - Notas pendentes de aprovação', short: 'Holding · Pendentes', company: 'Holding', stage: 'pending' },
  { id: 'group_mm296wvf', title: 'Holding - Notas aprovadas', short: 'Holding · Aprovadas', company: 'Holding', stage: 'approved' },
  { id: 'group_mm2c6ng7', title: 'Holding - Notas enviadas', short: 'Holding · Enviadas', company: 'Holding', stage: 'sent' },
  { id: 'group_mm29vceb', title: 'Empresa Exemplo - Notas pendentes de aprovação', short: 'Empresa Exemplo · Pendentes', company: 'Empresa Exemplo', stage: 'pending' },
  { id: 'group_mm29st8y', title: 'Empresa Exemplo - Notas aprovadas', short: 'Empresa Exemplo · Aprovadas', company: 'Empresa Exemplo', stage: 'approved' },
  { id: 'group_mm2c9m9j', title: 'Empresa Exemplo - Enviadas', short: 'Empresa Exemplo · Enviadas', company: 'Empresa Exemplo', stage: 'sent' },
  { id: 'group_mm2c28pe', title: 'TAG - Notas Fiscais Pendentes de aprovação', short: 'TAG · Pendentes de aprovação', company: 'TAG', stage: 'pending' },
  { id: 'group_mm2ct5t8', title: 'TAG - Notas aprovadas', short: 'TAG · Aprovadas', company: 'TAG', stage: 'approved' },
  { id: 'group_mm332dfe', title: 'TAG - Aguardando Comprovante', short: 'TAG · Aguardando comprovante', company: 'TAG', stage: 'awaiting' },
  { id: 'group_mm2daf7r', title: 'TAG - Pagas', short: 'TAG · Pagas', company: 'TAG', stage: 'paid' },
  { id: 'group_mm2np6s6', title: 'TAG - NFs Reprovados', short: 'TAG · Reprovadas', company: 'TAG', stage: 'rejected' },
  { id: 'group_mm296vy', title: 'Não Pertencem a engenharia', short: 'Não pertencem à engenharia', company: 'Outros', stage: 'other' },
];

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// Colunas de status (rótulos exatos do Monday; o índice é o id interno da coluna).
export const OTAVIO_LABELS = ['Em analise', 'Aprovado', 'Reprovado'];
export const ENGENHARIA_LABELS = ['Em Analise', 'Aprovado', 'Reprovado'];
export const PAYMENT_STATUS_LABELS = ['Em andamento', 'Pago', 'Aguardando Retorno'];

// "Departamento / Empresa" (id = índice do rótulo no Monday; cor = hex do status).
export const DEPARTMENTS = [
  { id: 0, label: 'Expansão', hex: '#579bfc' },
  { id: 1, label: 'Engenharia Empresa Exemplo', hex: '#66ccff' },
  { id: 2, label: 'Financeiro Empresa Exemplo', hex: '#df2f4a' },
  { id: 3, label: 'Jurídico Holding', hex: '#007eb5' },
  { id: 4, label: 'Facilities Empresa Exemplo', hex: '#9d50dd' },
  { id: 6, label: 'RH Empresa Exemplo', hex: '#037f4c' },
  { id: 7, label: 'Compras Empresa Exemplo', hex: '#ff6d3b' },
  { id: 8, label: 'Administrativo', hex: '#9cd326', mondayLabel: 'Adminstrativo' },
  { id: 9, label: 'Green Machine', hex: '#ffcb00' },
  { id: 10, label: 'Condomínio Lago', hex: '#ffadad' },
  { id: 11, label: 'Recepção Holding', hex: '#bb3354' },
  { id: 12, label: 'Comercial Empresa Exemplo', hex: '#ff007f' },
];

export const CATEGORIES = [
  'Manutenção', 'Obras/Reformas', 'Despesa para Rateio', 'Segurança Patrimonial', 'Projetos/Licenciamentos',
  'Material', 'Serviço', 'Aluguel', 'Taxa Condomínio', 'Consumo Energia', 'Processos Judiciais',
  'Despesa com Pessoal', 'Controle de Pragas', 'Contábil', 'Impostos', 'Concessionária', 'Taxa ADM',
  'Manutenção Elevadores', 'Portaria e Segurança', 'Locações', 'Paisagismo', 'Suporte TI',
  'Manutenção e Conservação', 'Telefonia', 'Limpeza', 'Uso e Consumo', 'CFTV', 'Bens e Moveis',
  'Coleta de Lixo', 'Seguro', 'Ato Declaratório', 'Consumo Água', 'Condomínio VV', 'Condomínio Lago',
  'Serviços',
];

// "Pagamento" (id de cada rótulo no Monday).
export const PAYMENTS = [
  { id: 1, label: 'Boleto' },
  { id: 2, label: 'Dados bancários' },
  { id: 3, label: 'Parcelado' },
  { id: 4, label: 'Cartão de crédito' },
  { id: 5, label: 'Link de Crédito' },
  { id: 7, label: 'Pago por terceiro' },
];

// "Pagador" (dropdown múltiplo no Monday).
export const PAYERS = [
  TAG, 'CONDOMINIO LAGO', 'PARCEIRA LTDA', 'EMPRESA EXEMPLO SERVICOS LTDA',
  '001 - HOLDING SOROCABA', '002 - HOLDING AMERICANA', '003 - HOLDING ILHÉUS',
  '004 - HOLDING CAMPINA GRANDE', '005 - HOLDING LONDRINA', '006 - HOLDING PELOTAS',
  '007 - HOLDING ANÁPOLIS', '008 - HOLDING CONTAGEM', '009 - HOLDING NITEROI',
  '010 - HOLDING CASCAVEL', '011 - HOLDING MARÍLIA', '012 - HOLDING JOINVILLE',
  '013 - HOLDING MONTES CLAROS', '014 - HOLDING PALMAS', '015 - HOLDING IPATINGA', '016 - FEIRA DE SANTANA',
  '017 - HOLDING BLUMENAU', '018 - MARINGÁ', '019 - HOLDING PINHAL', '020 - ARARAQUARA',
  '099 - HOLDING CORPORATIVO',
];

// Vencimentos: coluna do Monday para cada número de parcela.
export const DUE_COLUMNS = [
  'datet2azib2t', 'datesqdsnx1e', 'datelabga7ei', 'date7tejs6rr', 'dateqs21zdvn', 'datef5jm8hpz',
  'dateqxnr5zfv', 'dategzv6o6e0', 'datexfzj7sb7', 'datebizlrzko', 'datexrwtdv94', 'dateqanuxxcm',
];

// Colunas do Monday usadas como campos da nota (usado no snapshot e nos formulários).
export const COLUMNS = {
  nf: 'numeric_mm2c1as7',
  file: 'file16etm2wt',
  value: 'numbernw6wwm8g',
  narrative: 'long_textl5vw25mf',
  address: 'connect_boardsfvsdji',
  category: 'dropdown_mm269y8d',
  payment: 'dropdown_mm26s39g',
  bank: 'long_texttoxprtdu',
  paymentNotes: 'text_mm2xb51w',
  approverNotes: 'text_mm2ccqr5',
  otavio: 'color_mm2c8jqq',
  engineering: 'color_mm26kqta',
  department: 'single_selectby2rao7',
  payer: 'multi_select6mtrcu40',
  supplierLink: 'connect_boardsfosp5k',
  supplierName: 'lookup_mm295pk8',
  proofs: 'file_mm2cgtws',
  status: 'color_mm2cy533',
  issueDate: 'dateiggjokoa',
};

// Automações ativas e desativadas do quadro, com a lógica exata de cada uma.
// trigger.type: create | set (coluna muda para um valor) | change (qualquer alteração na coluna).
export const AUTOMATIONS = [
  {
    id: '7917895475',
    title: 'Ao criar item: nomear e definir pagador',
    description: 'Nome = "Número da NF - Nome do fornecedor" e Pagador = TAG EXEMPLO.',
    enabled: true,
    trigger: { type: 'create' },
    actions: [{ type: 'name' }, { type: 'set', column: 'payer', value: TAG }],
  },
  {
    id: '7917897786',
    title: 'Aprovação Otávio = Aprovado',
    description: 'Move a nota para "TAG - Notas aprovadas".',
    enabled: true,
    trigger: { type: 'set', column: 'otavio', value: 'Aprovado' },
    actions: [{ type: 'move', groupId: 'group_mm2ct5t8' }],
  },
  {
    id: '7917908135',
    title: 'Aprovação Otávio = Reprovado',
    description: 'Move a nota para "TAG - NFs Reprovados" e avisa a Beatriz por e-mail (18/11/2026, pedido do Gustavo).',
    enabled: true,
    trigger: { type: 'set', column: 'otavio', value: 'Reprovado' },
    actions: [{ type: 'email' }, { type: 'move', groupId: 'group_mm2np6s6' }],
  },
  {
    id: '7918501812',
    title: 'Status = Em andamento',
    description: 'Move a nota para "TAG - Aguardando Comprovante".',
    enabled: true,
    trigger: { type: 'set', column: 'status', value: 'Em andamento' },
    actions: [{ type: 'move', groupId: 'group_mm332dfe' }],
  },
  {
    id: '7918501969',
    title: 'Comprovantes alterado',
    description: 'Define Status = Pago e move a nota para "TAG - Pagas". Dispara em qualquer alteração na coluna, inclusive remoção de arquivo.',
    enabled: true,
    trigger: { type: 'change', column: 'proofs' },
    actions: [{ type: 'set', column: 'status', value: 'Pago' }, { type: 'move', groupId: 'group_mm2daf7r' }],
  },
];

export const EMAIL_TEMPLATE = {
  subject: (name) => `Nota reprovada pela TAG - ${name}`,
  body: (name, otavio, reason) =>
    `Olá, Beatriz.

A nota ${name} foi reprovada pelo Otávio no painel Notas TAG.

Motivo: ${reason || '(sem observação)'}

A nota está no grupo "TAG - NFs Reprovados".

Mensagem automática do painel.`,
};
