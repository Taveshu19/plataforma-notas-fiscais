// Banco falso em memória: a cópia nunca fala com o Supabase real.
// Imita só o que o painel usa de sb.from/auth/storage/channel. Os dados são fictícios
// e ficam na sessionStorage da aba, para sobreviver à troca de pessoa e ao F5.
(function(){
  'use strict';
  const CHAVE = 'copia_demo_banco_v5', CHAVE_SESSAO = 'copia_demo_sessao_v1';
  const PESSOAS = [
    { email:'gustavo@empresa.exemplo', nome:'Gustavo', perfil:'admin', rotulo:'Administração · vê tudo' },
    { email:'marcos.prado@holding.exemplo', nome:'Marcos', perfil:'admin', rotulo:'Administração · Projetos' },
    { email:'marina.costa@empresa.exemplo', nome:'Marina', perfil:'equipe', rotulo:'Equipe de lançamento' },
    { email:'laura.mendes@empresa.exemplo', nome:'Laura', perfil:'equipe', rotulo:'Equipe de lançamento' },
    { email:'rafael.souza@holding.exemplo', nome:'Rafael', perfil:'engenharia', rotulo:'Engenharia', primeiroAcesso:true },
    { email:'andre.castro@holding.exemplo', nome:'André', perfil:'engenharia', rotulo:'Engenharia', primeiroAcesso:true },
    { email:'bruno.nunes@holding.exemplo', nome:'Bruno', perfil:'engenharia', rotulo:'Engenharia', primeiroAcesso:true },
    { email:'helena.rocha@empresa.exemplo', nome:'Helena', perfil:'compras', rotulo:'Compras', primeiroAcesso:true },
  ];

  // Primeiro acesso: senha inicial e, depois, a senha escolhida pela pessoa (fluxo do próprio painel).
  // Só na demonstração: a senha fica na aba, em texto, para os botões de entrada funcionarem.
  const SENHA_INICIAL = 'SenhaDemo2026', CHAVE_CONTAS = 'copia_demo_contas_v1';
  const lerContas = () => { try { return JSON.parse(sessionStorage.getItem(CHAVE_CONTAS)) || {}; } catch (e) { return {}; } };
  const pendente = p => !!p && !!p.primeiroAcesso && !lerContas()[p.email];
  const acharPessoa = email => PESSOAS.find(x => x.email === String(email || '').trim().toLowerCase());

  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const nota = (id, nf, fornecedor, unidade, natureza, valor, status, extra) => ({
    id, nf, fornecedor, unidade, natureza, valor, status,
    descricao:natureza === 'Serviço' ? 'Execução de serviços de infraestrutura e adequação da unidade' : 'Materiais para adequação da plataforma',
    cnpj_fornecedor:'12.345.678/0001-95', emissao:dia(-6), vencimento:dia(12), data_recebimento:dia(-3),
    pagamento:'Boleto', requer_revisao:false, possivel_duplicata:false, travado_por:null, travado_em:null,
    pedido:null, contrato:null, criado_em:new Date(Date.now() - 3 * 864e5).toISOString(),
    atualizado_em:new Date().toISOString(),
    arquivos:[{ id:'nf-'+id, nome:'NF-'+nf+'.pdf', por:'Lançamento', em:dia(-3)+'T10:00:00', exemplo:true },
              { id:'bol-'+id, nome:'Boleto-'+nf+'.pdf', por:'Lançamento', em:dia(-3)+'T10:01:00', exemplo:true }],
    ...extra,
  });

  const arq = (id, nome, por) => ({ id, nome, por, em:dia(-2) + 'T12:00:00', exemplo:true });

  // Arquivos de exemplo são montados na hora; só o que a pessoa anexa vai para o IndexedDB.
  function pdfExemplo(nome){
    const seguro = t => t.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');
    const linhas = [['18', nome], ['12', 'Documento de exemplo da demonstracao'], ['12', 'Dados ficticios, sem valor real.']];
    const texto = 'BT 60 760 Td ' + linhas.map(([t, l]) => `/F1 ${t} Tf (${seguro(l)}) Tj 0 -28 Td`).join(' ') + ' ET 60 600 475 90 re S';
    const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      `<</Length ${texto.length}>>\nstream\n${texto}\nendstream`, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
    let pdf = '%PDF-1.4\n'; const pos = [];
    objs.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const inicio = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${inicio}\n%%EOF`;
    return new Blob([pdf], { type:'application/pdf' });
  }
  function imagemExemplo(nome){
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const g = c.getContext('2d');
    g.fillStyle = '#2f7fc4'; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#fff'; g.font = '28px sans-serif'; g.fillText(nome, 40, 240); g.font = '18px sans-serif'; g.fillText('Imagem de exemplo', 40, 280);
    return new Promise(ok => c.toBlob(ok, 'image/png'));
  }

  // Guarda os arquivos anexados para continuarem disponíveis ao trocar de pessoa.
  const BASE_ARQUIVOS = 'copia_demo_anexos';
  const abrirBase = () => new Promise((ok, erro) => {
    const r = indexedDB.open(BASE_ARQUIVOS, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
  async function naBase(modo, acao){
    const base = await abrirBase();
    return new Promise((ok, erro) => {
      const tx = base.transaction('arquivos', modo), pedido = acao(tx.objectStore('arquivos'));
      tx.oncomplete = () => { base.close(); ok(pedido.result); }; tx.onerror = () => { base.close(); erro(tx.error); };
    });
  }
  const apagarBase = () => new Promise(ok => { const r = indexedDB.deleteDatabase(BASE_ARQUIVOS); r.onsuccess = r.onerror = r.onblocked = () => ok(); });

  const CONTRATOS_DEMO = [
    { id:'C-001', nome:'SOLIDUM COMERCIO E ENGENHARIA LTDA', grupo:'Contratos Globais', unidade:'020 - Araraquara', tipologia:'Civil', tipo:'Contrato Global', status:'Ativo', aprovador:'Rafael Souza', referencia:'CT-2026-014', narrativa:'', valorFechado:2900000, aceite:'2026-03-10', cnpj:'12.345.678/0001-95', inclusao:'2026-03-01', aditivos:['C-003'], notas:['DEMO-008'], subitens:[{ id:'S-1', nome:'Medição 01', referencia:'MED-01', valor:50000, aceite:'2026-04-01', arquivos:1, lista:[arq('ctr-S-1','Medicao-01.pdf','Monday')] }], arquivos:[arq('ctr-C-001','Contrato-SOLIDUM.pdf','Monday'), arq('ctr-C-001b','Proposta-SOLIDUM.pdf','Monday')] },
    { id:'C-002', nome:'BOTA CONSTRUCOES E CONSULTORIA LTDA', grupo:'Contrato - Faturamento direto', unidade:'019 - Pinhal', tipologia:'Civil', tipo:'Contrato - Faturamento direto', status:'Ativo', aprovador:'Marcos Prado', referencia:'', narrativa:'', valorFechado:949913.48, aceite:'2026-02-02', cnpj:'98.765.432/0001-10', inclusao:'2026-02-01', aditivos:[], notas:['DEMO-009'], subitens:[], arquivos:[] },
    { id:'C-003', nome:'SOLIDUM - ADITIVO 1', grupo:'Aditivos', unidade:'020 - Araraquara', tipologia:'Civil', tipo:'Aditivo', status:'Ativo', aprovador:'Rafael Souza', referencia:'', narrativa:'', valorFechado:300000, aceite:'2026-05-05', cnpj:'12.345.678/0001-95', inclusao:'2026-05-01', aditivos:[], notas:[], subitens:[], arquivos:[] },
    { id:'C-004', nome:'OFICINA MODELO LTDA', grupo:'Contratos finalizados', unidade:'006 - Pelotas', tipologia:'Mecânica', tipo:'Contrato', status:'Encerrado', aprovador:'André Castro', referencia:'', narrativa:'', valorFechado:120000, aceite:'2025-11-11', cnpj:'11.222.333/0001-44', inclusao:'2025-11-01', aditivos:[], notas:[], subitens:[], arquivos:[] },
    { id:'C-005', nome:'ESTRUTURA ENGENHARIA LTDA', grupo:'Contratos', unidade:'002 - Americana', tipologia:'Mecânica, Elétrica', tipo:'Contrato', status:'Ativo', aprovador:'Bruno Nunes', referencia:'', narrativa:'', valorFechado:450000, aceite:'2026-04-04', cnpj:'55.666.777/0001-88', inclusao:'2026-04-01', aditivos:[], notas:[], subitens:[], arquivos:[] },
    { id:'C-006', nome:'CONTRATO PEQUENO LTDA', grupo:'Contratos', unidade:'020 - Araraquara', tipologia:'Civil', tipo:'Contrato', status:'Ativo', aprovador:'Rafael Souza', referencia:'', narrativa:'', valorFechado:1000, aceite:'2026-04-04', cnpj:'00.000.000/0001-00', inclusao:'2026-04-01', aditivos:[], notas:[], subitens:[], arquivos:[] },
  ];

  // Quadro de Projetos (só o Marcos vê): mesmo formato que o painel recebe do banco; dados fictícios.
  const PROJETOS_DEMO = {
    quadro:{ nome:'Portifólio de Projetos', espelhadoEm:new Date().toISOString(), grupos:[{ id:'topics', titulo:'Projetos em Execução' }, { id:'g_estudo', titulo:'Projetos em Estudo' }, { id:'g_pos', titulo:'Pós Obras em andamento' }, { id:'g_conc', titulo:'Projetos Concluídos' }],
      colunas:[{ id:'name', titulo:'Name', tipo:'name' }, { id:'sub', titulo:'Subelementos', tipo:'subtasks' }, { id:'u', titulo:'Unidade', tipo:'text' }, { id:'p', titulo:'Person', tipo:'people' },
        { id:'s', titulo:'Status', tipo:'status', cores:{ 'Em Andamento':'#fdab3d', 'Concluído':'#00c875', 'Parado':'#df2f4a', 'Aguardando inicio':'#007eb5' } },
        { id:'dp', titulo:'Duração Planejada', tipo:'numbers' }, { id:'cp', titulo:'Cronograma Planejado', tipo:'timeline' }, { id:'kp', titulo:'Custo Planejado', tipo:'numbers' },
        { id:'dr', titulo:'Duração Real', tipo:'numbers' }, { id:'cr', titulo:'Cronograma Real', tipo:'timeline' }, { id:'kr', titulo:'Custo Realizado', tipo:'numbers' }],
      subColunas:[{ id:'name', titulo:'Name', tipo:'name' }, { id:'status', titulo:'Status', tipo:'status', cores:{ 'Em andamento':'#fdab3d', 'Feito':'#00c875' } }] },
    itens:[
      { item_id:'P-1', grupo_id:'topics', ordem:0, nome:'Construção nova unidade de Bauru', valores:{ u:{ t:'Araraquara' }, s:{ t:'Em Andamento' }, dp:{ t:'563' }, cp:{ t:'2025-04-01 - 2026-10-15' }, kp:{ t:'22424219.19' } }, subitens:[{ id:'S-1', nome:'Terraplenagem', valores:{ status:{ t:'Feito' } } }] },
      { item_id:'P-2', grupo_id:'topics', ordem:1, nome:'Construção unidade de Pinhal', valores:{ u:{ t:'Pinhal' }, s:{ t:'Em Andamento' }, dp:{ t:'512' }, cp:{ t:'2026-03-10 - 2027-08-03' }, kp:{ t:'23960759.8' } }, subitens:[] },
      { item_id:'P-3', grupo_id:'g_estudo', ordem:2, nome:'Modernização Plataforma Campina Grande', valores:{ u:{ t:'Holding Campina Grande' }, s:{ t:'Parado' }, dp:{ t:'229' }, cp:{ t:'2026-04-02 - 2026-11-16' }, kp:{ t:'9271316' } }, subitens:[] },
      { item_id:'P-4', grupo_id:'g_pos', ordem:3, nome:'Regularização de pontos civil e ajustes mecânicos', valores:{ u:{ t:'Blumenau' }, s:{ t:'Em Andamento' }, dp:{ t:'220' }, cp:{ t:'2026-01-20 - 2026-08-27' } }, subitens:[] },
      { item_id:'P-5', grupo_id:'g_conc', ordem:4, nome:'Ampliação Tancagem Campina Grande', valores:{ u:{ t:'Holding Campina Grande' }, s:{ t:'Concluído' }, dp:{ t:'323' }, cp:{ t:'2025-09-01 - 2026-07-20' }, kp:{ t:'5931666.67' }, dr:{ t:'355' }, cr:{ t:'2025-09-01 - 2026-08-21' }, kr:{ t:'6400000' } }, subitens:[] },
    ],
  };
  const EMAILS_PROJETOS = ['marcos.prado@holding.exemplo', 'gustavo@empresa.exemplo'];   // só estes veem Projetos e Portfólio (igual ao banco real)

  function dadosIniciais(){
    return {
      lancamentos: [
        nota('DEMO-001','8042','Horizonte Materiais','ARARAQUARA','Material',4280,'Pendente'),
        nota('DEMO-002','5518','Vértice Instalações','IPATINGA','Serviço',3120,'Pendente',{ pagamento:null }),
        nota('DEMO-003','77','Oficina Modelo','PELOTAS','Serviço',980,'Pendente',{ cnpj_fornecedor:null, requer_revisao:true }),
        nota('DEMO-004','217','Estrutura Engenharia','AMERICANA','Serviço',8450,'Enviado'),
        nota('DEMO-005','3302','Campo Alto Terraplenagem','ARARAQUARA','Serviço',12600,'Enviado'),
        nota('DEMO-006','9301','Norte Equipamentos','MARINGÁ','Material',1930,'Enviado'),
        nota('DEMO-007','331','Base Serviços','IPATINGA','Serviço',6700,'Enviado'),
        nota('DEMO-008','1209','Sul Materiais','PELOTAS','Material',1560,'Enviado'),
        nota('DEMO-009','470','Concreto Modelo','PINHAL','Material',5200,'Enviado'),
      ],
      historico_status: [], arquivos_processados: [], exclusoes_recentes: [],
      // Tabelas novas da proposta: o fluxo guarda a etapa de cada nota já enviada.
      fluxo: {
        'DEMO-004': { etapa:'engenharia', narrativa:'', contrato:'', expansao:'', pedido:'', historico:['Recebida do lançamento · dados fictícios'] },
        'DEMO-005': { etapa:'engenharia', narrativa:'', contrato:'', expansao:'', pedido:'', historico:['Recebida do lançamento · dados fictícios'] },
        'DEMO-006': { etapa:'pedido', vinculo:{ notaDe:'Rafael', cartaoDe:'Marcos', por:'Rafael', em:dia(-1) + 'T09:00:00' }, narrativa:'Material para adequação da plataforma de envase.', contrato:'Não', expansao:'Sim', pedido:'', historico:['Análise aprovada pela engenharia · dados fictícios'] },
        'DEMO-007': { etapa:'aprovacao', narrativa:'Serviço de manutenção da cobertura.', contrato:'Não', expansao:'Sim', pedido:'131800', historico:['Pedido 131800 registrado · dados fictícios'] },
        'DEMO-008': { etapa:'escrituracao', narrativa:'Materiais para instalação elétrica.', contrato:'Não', expansao:'Sim', pedido:'131809', historico:['Pedido aprovado · dados fictícios'] },
        'DEMO-009': { etapa:'escrituracao', narrativa:'Concretagem da base da plataforma.', contrato:'Sim', contratoRef:'CT-EX-03', expansao:'Sim', pedido:'131810', historico:['Pedido aprovado · dados fictícios'] },
      },
      requisicoes: [
        { id:'REQ-EX-001', nome:'Materiais para adequação da plataforma', descricao:'Cabos, eletrodutos e quadros para a adequação elétrica da plataforma de envase.', unidade:'ARARAQUARA', tipo:'Material', prioridade:'Padrão', sla:10, etapa:'Aguardando Compras', comprador:'', solicitante:'Rafael', terceiros:'Não solicitada', criadaEm:dia(-1) + 'T12:00:00', prazoDesejado:dia(20), anexos:{ rm:[arq('ex-1','RM-001.pdf','Rafael')], propostas:[], certificados:[] }, emails:[], historico:['Requisição criada; cotação vinculada · dados fictícios'] },
        { id:'REQ-EX-002', nome:'Serviço de cobertura', descricao:'Troca de telhas e calhas da cobertura do galpão, com mão de obra.', unidade:'IPATINGA', tipo:'Serviço', prioridade:'Padrão', sla:20, etapa:'Em cotação', comprador:'Helena', solicitante:'André', terceiros:'Não solicitada', criadaEm:dia(-4) + 'T12:00:00', prazoDesejado:dia(30), anexos:{ rm:[arq('ex-2','RM-002.pdf','André')], propostas:[arq('ex-3','Proposta-A.pdf','Helena'),arq('ex-4','Proposta-B.pdf','Helena'),arq('ex-5','Proposta-C.pdf','Helena')], certificados:[] }, emails:[], historico:['Requisição criada; cotação vinculada · dados fictícios','Comprador atribuído; negociação iniciada · dados fictícios'] },
        { id:'REQ-EX-003', nome:'Equipamento de manutenção', descricao:'Compressor de ar para a oficina de manutenção da unidade.', unidade:'PELOTAS', tipo:'Equipamento', prioridade:'Urgente', sla:3, etapa:'Aguardando Engenharia', comprador:'Helena', solicitante:'Bruno', terceiros:'Pendente', criadaEm:dia(-2) + 'T12:00:00', prazoDesejado:'', anexos:{ rm:[arq('ex-6','RM-003.pdf','Bruno'),arq('ex-7','Foto-do-equipamento.png','Bruno')], propostas:[arq('ex-8','Proposta-unica.pdf','Helena')], certificados:[arq('ex-9','Certificado-qualidade.pdf','Helena')] }, emails:[], historico:['Negociação concluída; engenharia deve analisar as propostas · dados fictícios'] },
      ],
    };
  }

  let banco;
  try { banco = JSON.parse(sessionStorage.getItem(CHAVE)) || dadosIniciais(); } catch (e) { banco = dadosIniciais(); }
  // Compatibilidade com sessões da primeira prévia, sem apagar trabalho de teste.
  for (const r of banco.requisicoes){
    r.solicitanteEmail ||= PESSOAS.find(p => p.nome === r.solicitante)?.email || '';
    r.descricao ??= r.nome;
  }
  for (const n of banco.lancamentos) n.descricao ??= n.natureza === 'Serviço' ? 'Execução de serviços de infraestrutura e adequação da unidade' : 'Materiais para adequação da plataforma';
  const salvar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(banco)); } catch (e) {} };
  salvar();

  const canais = [];
  const avisos = [];
  function emitir(table, eventType, novo, antigo){
    canais.forEach(c => c.handlers.forEach(h => {
      if (h.tipo !== 'postgres_changes' || h.filtro.table !== table) return;
      if (h.filtro.event !== '*' && h.filtro.event !== eventType) return;
      setTimeout(() => h.cb({ eventType, new:novo, old:antigo }));
    }));
    avisos.forEach(fn => setTimeout(fn));
  }

  class Consulta {
    constructor(tabela){ this.tabela = tabela; this.op = 'select'; this.filtros = []; this.devolve = false; this.um = null; this.opts = {}; }
    select(_c, opts){ if (this.op === 'select') this.opts = opts || {}; else this.devolve = true; return this; }
    insert(linhas){ this.op = 'insert'; this.linhas = [].concat(linhas); return this; }
    upsert(linhas){ this.op = 'upsert'; this.linhas = [].concat(linhas); return this; }
    update(patch){ this.op = 'update'; this.patch = patch; return this; }
    delete(){ this.op = 'delete'; return this; }
    eq(c, v){ this.filtros.push(r => r[c] === v); return this; }
    neq(c, v){ this.filtros.push(r => r[c] !== v); return this; }
    is(c, v){ this.filtros.push(r => (r[c] ?? null) === v); return this; }
    in(c, l){ this.filtros.push(r => l.includes(r[c])); return this; }
    gt(c, v){ this.filtros.push(r => r[c] > v); return this; }
    gte(c, v){ this.filtros.push(r => r[c] >= v); return this; }
    lt(c, v){ this.filtros.push(r => r[c] < v); return this; }
    lte(c, v){ this.filtros.push(r => r[c] <= v); return this; }
    like(c, p){ const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); this.filtros.push(r => re.test(String(r[c] ?? ''))); return this; }
    not(c, op, v){
      const nega = { is:r => (r[c] ?? null) !== v, eq:r => r[c] !== v, in:r => !String(v).replace(/[()]/g, '').split(',').includes(String(r[c])) }[op];
      if (nega) this.filtros.push(nega); else throw Error('Filtro não previsto na demonstração: ' + op);
      return this;
    }
    filter(c, op, v){ return op === 'eq' ? this.eq(c, v) : this; }
    or(){ return this; }
    abortSignal(){ return this; }
    match(obj){ Object.entries(obj).forEach(([c, v]) => this.eq(c, v)); return this; }
    order(c, o){ this.ordem = this.ordem || []; this.ordem.push([c, o?.ascending !== false]); return this; }
    limit(n){ this.teto = n; return this; }
    range(de, ate){ this.faixa = [de, ate]; return this; }
    single(){ this.um = 'single'; return this; }
    maybeSingle(){ this.um = 'maybe'; return this; }
    executar(){
      const t = banco[this.tabela] || (banco[this.tabela] = []);
      const passa = r => this.filtros.every(f => f(r));
      let linhas = [];
      if (this.op === 'insert' || this.op === 'upsert'){
        for (const nova of this.linhas){
          const r = { id:nova.id ?? ('demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)), criado_em:new Date().toISOString(), ...nova };
          const i = this.op === 'upsert' ? t.findIndex(x => x.id === r.id) : -1;
          if (i >= 0) t[i] = { ...t[i], ...r }; else t.push(r);
          linhas.push(r); emitir(this.tabela, 'INSERT', r, null);
        }
      } else if (this.op === 'update'){
        t.forEach((r, i) => {
          if (!passa(r)) return;
          const antigo = r;
          t[i] = { ...r, ...this.patch, atualizado_em:new Date().toISOString() };
          linhas.push(t[i]); emitir(this.tabela, 'UPDATE', t[i], antigo);
        });
      } else if (this.op === 'delete'){
        for (let i = t.length - 1; i >= 0; i--) if (passa(t[i])){ const [r] = t.splice(i, 1); linhas.push(r); emitir(this.tabela, 'DELETE', null, r); }
      } else {
        linhas = t.filter(passa).map(r => ({ ...r }));
        (this.ordem || []).slice().reverse().forEach(([c, asc]) => linhas.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)));
        if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1);
        if (this.teto != null) linhas = linhas.slice(0, this.teto);
      }
      if (this.op !== 'select') salvar();
      if (this.op !== 'select' && !this.devolve) return { data:null, error:null };
      const count = this.opts.count ? linhas.length : null;
      if (this.opts.head) return { data:null, count, error:null };
      if (this.um) return { data:linhas[0] ?? null, count, error:(this.um === 'single' && !linhas.length) ? { message:'Nenhuma linha' } : null };
      return { data:linhas, count, error:null };
    }
    then(ok, erro){ return Promise.resolve().then(() => this.executar()).then(ok, erro); }
    catch(erro){ return this.then(undefined, erro); }
  }

  const lerSessao = () => { try { return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO)); } catch (e) { return null; } };
  const montarSessao = p => ({ user:{ id:p.email, email:p.email, user_metadata:{ nome:p.nome } } });
  const SEM_ARQUIVO = { message:'Cópia de demonstração: não há documentos reais aqui.' };

  const cliente = {
    from: tabela => new Consulta(tabela),
    rpc: async () => ({ data:[], error:null }),
    functions: { invoke: async () => ({ data:null, error:{ message:'Desligado na cópia de demonstração.' } }) },
    storage: { from: () => ({
      upload: async p => ({ data:{ path:p }, error:null }),
      remove: async () => ({ data:[], error:null }),
      download: async () => ({ data:null, error:SEM_ARQUIVO }),
      createSignedUrl: async () => ({ data:null, error:SEM_ARQUIVO }),
      getPublicUrl: () => ({ data:{ publicUrl:'' } }),
    }) },
    auth: {
      signInWithPassword: async ({ email, password }) => {
        const p = acharPessoa(email), conta = p && lerContas()[p.email];
        const incorreto = { data:null, error:{ message:'E-mail ou senha incorretos.' } };
        if (!p) return incorreto;
        if (pendente(p) ? password !== SENHA_INICIAL : !!conta && password !== conta.senha) return incorreto;
        // Sem nome no cadastro = primeiro acesso: o painel pede nome e senha nova.
        const s = pendente(p) ? { user:{ id:p.email, email:p.email, user_metadata:{ nome:'', precisa_trocar_senha:true } } } : montarSessao(p);
        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
        return { data:{ user:s.user, session:s }, error:null };
      },
      getSession: async () => ({ data:{ session:lerSessao() } }),
      signOut: async () => { sessionStorage.removeItem(CHAVE_SESSAO); return { error:null }; },
      updateUser: async ({ password, data } = {}) => {
        const s = lerSessao(); if (!s) return { data:null, error:{ message:'Sessão expirada.' } };
        const contas = lerContas(), atual = contas[s.user.email] || {};
        contas[s.user.email] = { senha:password || atual.senha || '', nome:data?.nome || atual.nome || s.user.user_metadata.nome };
        sessionStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas));
        s.user.user_metadata = { ...s.user.user_metadata, ...(data || {}) };
        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
        return { data:{ user:s.user }, error:null };
      },
      onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
    },
    channel(nome, opts){
      const presenca = {};
      const canal = {
        nome, handlers:[],
        on(tipo, filtro, cb){ this.handlers.push({ tipo, filtro, cb }); return this; },
        subscribe(cb){ if (cb) setTimeout(() => cb('SUBSCRIBED')); return this; },
        presenceState: () => presenca,
        track: async meta => {
          presenca[opts?.config?.presence?.key || 'eu'] = [meta];
          canal.handlers.filter(h => h.tipo === 'presence').forEach(h => setTimeout(() => h.cb({})));
          return 'ok';
        },
        untrack: async () => 'ok', unsubscribe: async () => 'ok', send: async () => 'ok',
      };
      canais.push(canal);
      return canal;
    },
    removeChannel: async c => { const i = canais.indexOf(c); if (i >= 0) canais.splice(i, 1); return 'ok'; },
    getChannels: () => canais,
  };

  window.supabase = { createClient: () => cliente };
  window.__demo = {
    PESSOAS, cliente, salvar, SENHA_INICIAL,
    pendente: email => pendente(acharPessoa(email)),
    senhaDemo: email => { const p = acharPessoa(email); return pendente(p) ? SENHA_INICIAL : lerContas()[p?.email]?.senha || 'demonstracao'; },
    arquivos: {
      guardar: (id, blob) => naBase('readwrite', s => s.put(blob, id)),
      apagar: id => naBase('readwrite', s => s.delete(id)),
      ler: a => a.exemplo ? (/\.pdf$/i.test(a.nome) ? pdfExemplo(a.nome) : imagemExemplo(a.nome)) : naBase('readonly', s => s.get(a.id)),
    },
    get fluxo(){ return banco.fluxo; },
    get requisicoes(){ return banco.requisicoes; },
    get contratos(){ return CONTRATOS_DEMO; },
    get projetosAcesso(){ return EMAILS_PROJETOS.includes(lerSessao()?.user?.email); },
    get projetos(){ return this.projetosAcesso ? PROJETOS_DEMO : null; },
    get lancamentos(){ return banco.lancamentos; },
    aoMudar: fn => avisos.push(fn),
    sessao: lerSessao,
    verComo(email){
      const p = PESSOAS.find(x => x.email === email); if (!p) return;
      if (pendente(p)){ sessionStorage.removeItem(CHAVE_SESSAO); sessionStorage.removeItem('painel_nf_login_ts'); sessionStorage.setItem('copia_demo_preencher', p.email); location.reload(); return; }
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(montarSessao(p)));
      sessionStorage.setItem('painel_nf_usuario', p.nome);
      sessionStorage.setItem('painel_nf_login_ts', String(Date.now()));
      location.reload();
    },
    async reiniciar(){ sessionStorage.clear(); try { window['local' + 'Storage'].removeItem('expansao_colaboracao_v1'); } catch (e) {} localStorage.removeItem('expansao_colaboracao_v1'); await apagarBase(); location.reload(); },
  };
})();
