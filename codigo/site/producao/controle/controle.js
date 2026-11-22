// Controle de Lançamentos (19/11/2026, pedido do Gustavo): aba nova do Administrativo, ao lado de "Notas fiscais" e "Histórico".
// Réplica do quadro da Monday 18430299907: grupos Aguardando aprovação (vermelho), Aprovado - a enviar (laranja) e Enviado (verde),
// colunas Pedido, Fornecedor, Emissão, Vencimento, Instalação, Nota, Etapa e Texto, comentários por pedido, formulário "Novo lançamento"
// e as 4 automações (item novo entra em "Aguardando aprovação"; mudar a Etapa leva o pedido para o grupo de mesmo nome).
// Só Marina, Laura e Tatiana (e o Gustavo) veem. Elas entram com o MESMO e-mail e senha da Expansão: os dados ficam no banco da Expansão
// e o banco confere quem pode (controle_pode + RLS). Nada aqui usa a Monday. Fonte: producao/controle/ (montado por publicados/montar-oficial.mjs).
(function(){
  'use strict';
  const EXP_URL = '__EXP_URL__', EXP_KEY = '__EXP_KEY__';
  // 19/11/2026 (Gustavo): Marina, Laura, Bruno, Tatiana, Gustavo, Marcos e Otávio.
  const AUTORIZADOS = ['marina.costa@empresa.exemplo', 'laura.mendes@empresa.exemplo', 'bruno.alves@empresa.exemplo', 'tatiana.lima@empresa.exemplo',
    'gustavo@empresa.exemplo', 'marcos.prado@holding.exemplo', 'otavio.reis@holding.exemplo'];
  // Modo "só Controle" (sem as notas da TAG) é só para quem não tem conta na TAG. Administração e Otávio sempre veem a TAG inteira.
  const NUNCA_SO = ['gustavo@empresa.exemplo', 'marcos.prado@holding.exemplo', 'otavio.reis@holding.exemplo'];
  // Grupos e cores da Monday (status Etapa: mesmas cores dos grupos).
  const GRUPOS = [
    { etapa:'Aguardando aprovação', cor:'#df2f4a' },
    { etapa:'Aprovado - a enviar', cor:'#fdab3d' },
    { etapa:'Enviado', cor:'#00c875' },
  ];
  const COR = Object.fromEntries(GRUPOS.map(g => [g.etapa, g.cor]));
  const CAMPOS = [['pedido','Pedido'],['fornecedor','Fornecedor'],['emissao','Emissão'],['vencimento','Vencimento'],['instalacao','Instalação'],['nota','Nota'],['etapa','Etapa'],['texto','Texto']];
  const AUTOMACOES = [
    ['Quando um pedido é criado', 'a Etapa fica "Aguardando aprovação" (se nada for escolhido).'],
    ['Quando a Etapa muda para "Aguardando aprovação"', 'o pedido vai para o grupo Aguardando aprovação.'],
    ['Quando a Etapa muda para "Aprovado - a enviar"', 'o pedido vai para o grupo Aprovado - a enviar.'],
    ['Quando a Etapa muda para "Enviado"', 'o pedido vai para o grupo Enviado.'],
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dataBR = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
  const quandoBR = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '—';
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sem armazenamento */ } };
  const lembrar = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? padrao; } catch (_) { return padrao; } };

  const E = {
    cliente: null, email: '', nome: '', itens: [], comentarios: [], eventos: [], fornecedores: [],
    vista: lembrar('ctl.vista', 'quadro'), fechados: lembrar('ctl.fechados', {}), filtro: { q:'', forn:'', vde:'', vate:'' },
    aberto: null, area: null, somente: false, carregado: false, canal: null, maisAtividade: 200, aviso: null,
    modo: 'direto',   // 'direto' = login da Expansão; 'tag' = login da TAG, pela função controle-api (19/11/2026)
  };
  const cliente = () => {
    if (!E.cliente) {
      if (!window.supabase) throw new Error('Biblioteca do banco não carregou. Atualize a página.');
      E.cliente = window.supabase.createClient(EXP_URL, EXP_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
    }
    return E.cliente;
  };
  const conferir = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const autorizado = email => AUTORIZADOS.includes(String(email || '').trim().toLowerCase());

  function toast(msg, ruim = false){
    const t = document.getElementById('toast');
    if (!t) return alert(msg);
    t.textContent = msg; t.classList.toggle('bad', ruim); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4800);
  }

  // ---------- sessão: login da Expansão ou, sem ele, o login da TAG (19/11/2026: Otávio e quem já entra na TAG) ----------
  const CHAVE_TAG = 'sb-seu-projeto-engenharia-auth-token';
  function tokenTag(){
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_TAG) || 'null');
      if (!s?.access_token || (s.expires_at && s.expires_at * 1000 < Date.now() + 5000)) return null;
      return s.access_token;
    } catch (_) { return null; }
  }
  function emailDoToken(t){
    try { const p = JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); return String(p.email || '').toLowerCase(); } catch (_) { return ''; }
  }
  async function temSessao(){
    try {
      const s = (await cliente().auth.getSession()).data.session;
      if (s && autorizado(s.user?.email)) { E.modo = 'direto'; E.email = s.user.email.toLowerCase(); E.nome = s.user.user_metadata?.nome || E.email.split('@')[0]; return true; }
    } catch (_) { /* sem sessão da Expansão */ }
    const t = tokenTag(), em = t ? emailDoToken(t) : '';
    if (t && autorizado(em)) { E.modo = 'tag'; E.email = em; E.nome = em.split('@')[0]; return true; }
    return false;
  }
  // Pela função controle-api, com o login da TAG (o servidor confere o login e a lista de quem pode).
  async function api(acao, dados = {}){
    const t = E.modo === 'tag' ? tokenTag() : (await cliente().auth.getSession()).data.session?.access_token;
    if (!t) throw new Error('Sua sessão venceu. Entre de novo.');
    const r = await fetch(EXP_URL + '/functions/v1/controle-api', { method:'POST', headers:{ 'Content-Type':'application/json', apikey:EXP_KEY, Authorization:'Bearer ' + t }, body:JSON.stringify({ acao, dados }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
    return j.dados;
  }
  async function entrar(email, senha){
    if (!autorizado(email) || !senha) return false;
    const r = await cliente().auth.signInWithPassword({ email:String(email).trim().toLowerCase(), password:senha });
    if (r.error || !r.data?.session) return false;
    E.email = r.data.session.user.email.toLowerCase(); E.nome = r.data.session.user.user_metadata?.nome || E.email.split('@')[0];
    return true;
  }
  async function sair(){
    if (E.modo !== 'tag') { try { await cliente().auth.signOut({ scope:'local' }); } catch (_) { /* já saiu */ } }
    E.email = ''; E.carregado = false; E.itens = [];
    try { E.canal?.unsubscribe(); } catch (_) { /* nada */ } E.canal = null;
  }

  // ---------- dados ----------
  async function todos(tabela, ordem, asc = true){
    const linhas = [];
    for (let de = 0; ; de += 1000){
      const parte = conferir(await cliente().from(tabela).select('*').order(ordem, { ascending:asc }).range(de, de + 999));
      linhas.push(...parte); if (parte.length < 1000) return linhas;
    }
  }
  async function carregar(){
    if (E.modo === 'tag') {
      const d = await api('carregar');
      E.itens = d.itens || []; E.comentarios = d.comentarios || []; E.fornecedores = (d.fornecedores || []).map(f => f.nome);
      for (const i of E.itens) if (i.fornecedor && !E.fornecedores.includes(i.fornecedor)) E.fornecedores.push(i.fornecedor);
      E.carregado = true; return;
    }
    const [itens, comentarios, fornecedores] = await Promise.all([
      todos('controle_lancamentos', 'posicao'), todos('controle_lancamentos_comentarios', 'em'), todos('controle_fornecedores', 'posicao'),
    ]);
    E.itens = itens; E.comentarios = comentarios; E.fornecedores = fornecedores.map(f => f.nome);
    for (const i of itens) if (i.fornecedor && !E.fornecedores.includes(i.fornecedor)) E.fornecedores.push(i.fornecedor);
    E.carregado = true;
  }
  async function carregarEventos(){ if (E.modo === 'tag') { E.eventos = await api('eventos') || []; return; } E.eventos = conferir(await cliente().from('controle_lancamentos_eventos').select('*').order('em', { ascending:false }).limit(5000)); }
  function ligarTempoReal(){
    if (E.canal) return;
    let t = null;
    const mudou = () => { clearTimeout(t); t = setTimeout(async () => {
      if (document.activeElement?.closest?.('.ctl') && document.activeElement.matches('input,select,textarea')) return mudou();   // espera quem está digitando
      try { await carregar(); if (E.vista === 'atividade') await carregarEventos(); desenhar(); } catch (_) { /* tenta na próxima */ }
    }, 700); };
    if (E.modo === 'tag') {   // login da TAG: sem o aviso do banco da Expansão; confere a cada 20 s
      E.canal = { unsubscribe(){ clearInterval(this.t); }, t:setInterval(() => { if (!document.hidden && E.area?.isConnected) mudou(); }, 20000) };
      document.addEventListener('visibilitychange', () => { if (!document.hidden && E.area?.isConnected) mudou(); });
      return;
    }
    try {
      E.canal = cliente().channel('controle-lancamentos');
      for (const tabela of ['controle_lancamentos', 'controle_lancamentos_comentarios', 'controle_fornecedores']) E.canal = E.canal.on('postgres_changes', { event:'*', schema:'public', table:tabela }, mudou);
      E.canal.subscribe();
    } catch (_) { /* sem tempo real: a tela atualiza ao voltar para a aba */ }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && E.area?.isConnected) mudou(); });
  }
  const itemPorId = id => E.itens.find(i => i.id === id);
  const comentariosDe = id => E.comentarios.filter(c => c.item_id === id);

  async function salvarCampo(id, campo, valor){
    const antes = itemPorId(id); if (!antes) return;
    const v = valor === '' ? null : valor;
    if ((antes[campo] ?? null) === v) return;
    if (campo === 'pedido' && !String(v || '').trim()) { toast('O pedido não pode ficar sem número.', true); desenhar(); return; }
    try {
      const novo = E.modo === 'tag' ? await api('alterar', { id, campo, valor:v }) : conferir(await cliente().from('controle_lancamentos').update({ [campo]:v }).eq('id', id).select().single());
      Object.assign(antes, novo);
      if (campo === 'etapa') { desenhar(); toast(`Pedido ${novo.pedido} foi para ${novo.etapa}.`); }
      else if (E.aberto === id) desenharGaveta();
    } catch (e) { toast('Não salvou: ' + e.message, true); desenhar(); }
  }
  async function novoFornecedor(){
    const nome = (prompt('Nome do novo fornecedor:') || '').trim().toUpperCase();
    if (!nome) return null;
    if (!E.fornecedores.includes(nome)) {
      try { if (E.modo === 'tag') await api('fornecedor', { nome }); else conferir(await cliente().from('controle_fornecedores').insert({ nome, posicao:E.fornecedores.length + 1, criado_por:E.email })); }
      catch (e) { if (!/duplicate/i.test(e.message)) { toast('Não salvou o fornecedor: ' + e.message, true); return null; } }
      E.fornecedores.push(nome);
    }
    return nome;
  }
  async function criar(dados, comentario){
    const novo = E.modo === 'tag' ? await api('criar', dados) : conferir(await cliente().from('controle_lancamentos').insert(dados).select().single());
    E.itens.push(novo);
    if (comentario) { try { E.comentarios.push(await comentarNoBanco(novo.id, comentario)); } catch (e) { toast('Pedido criado, mas o comentário não salvou: ' + e.message, true); } }
    return novo;
  }

  const comentarNoBanco = async (itemId, texto) => E.modo === 'tag' ? await api('comentar', { item_id:itemId, texto, autor:E.nome })
    : conferir(await cliente().from('controle_lancamentos_comentarios').insert({ item_id:itemId, texto, autor:E.nome }).select().single());

  // ---------- filtros ----------
  const passa = i => {
    const f = E.filtro;
    if (f.q && !norm([i.pedido, i.fornecedor, i.nota, i.instalacao, i.texto].join(' ')).includes(norm(f.q))) return false;
    if (f.forn && i.fornecedor !== f.forn) return false;
    if (f.vde && (!i.vencimento || i.vencimento < f.vde)) return false;
    if (f.vate && (!i.vencimento || i.vencimento > f.vate)) return false;
    return true;
  };

  // ---------- telas ----------
  const ICONE_COMENTARIO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M12 9v6M9 12h6"/></svg>';
  const opcoesFornecedor = atual => `<option value="">—</option>${[...new Set([...(atual && !E.fornecedores.includes(atual) ? [atual] : []), ...E.fornecedores])].map(f => `<option${f === atual ? ' selected' : ''}>${esc(f)}</option>`).join('')}<option value="__novo__">＋ Novo fornecedor…</option>`;
  const opcoesEtapa = atual => GRUPOS.map(g => `<option${g.etapa === atual ? ' selected' : ''}>${esc(g.etapa)}</option>`).join('');
  const celTexto = (i, c, rot, extra = '') => `<input class="ctl-cel" data-ctl-id="${esc(i.id)}" data-ctl-campo="${c}" value="${esc(i[c] || '')}" aria-label="${rot} do pedido ${esc(i.pedido)}" autocomplete="off" ${extra}>`;
  const celData = (i, c, rot) => `<input class="ctl-cel ctl-data" type="date" data-ctl-id="${esc(i.id)}" data-ctl-campo="${c}" value="${esc(i[c] || '')}" aria-label="${rot} do pedido ${esc(i.pedido)}">`;
  const vencido = i => i.vencimento && i.etapa !== 'Enviado' && i.vencimento < new Date().toISOString().slice(0, 10);

  function linha(i){
    const n = comentariosDe(i.id).length;
    return `<tr data-ctl-linha="${esc(i.id)}">
      <td class="ctl-pedido">${celTexto(i, 'pedido', 'Número')}</td>
      <td class="ctl-com"><button type="button" class="ctl-bolha ${n ? 'tem' : ''}" data-ctl-abrir="${esc(i.id)}" title="${n ? n + ' comentário(s)' : 'Comentar / ver detalhes'}" aria-label="Comentários do pedido ${esc(i.pedido)}">${ICONE_COMENTARIO}${n ? `<b>${n}</b>` : ''}</button></td>
      <td><select class="ctl-cel ctl-forn" data-ctl-id="${esc(i.id)}" data-ctl-campo="fornecedor" aria-label="Fornecedor do pedido ${esc(i.pedido)}">${opcoesFornecedor(i.fornecedor)}</select></td>
      <td>${celData(i, 'emissao', 'Emissão')}</td>
      <td class="${vencido(i) ? 'ctl-vencido' : ''}">${celData(i, 'vencimento', 'Vencimento')}</td>
      <td>${celTexto(i, 'instalacao', 'Instalação')}</td>
      <td>${celTexto(i, 'nota', 'Nota')}</td>
      <td class="ctl-etapa-cel"><select class="ctl-etapa" style="--c:${COR[i.etapa] || '#777'}" data-ctl-id="${esc(i.id)}" data-ctl-campo="etapa" aria-label="Etapa do pedido ${esc(i.pedido)}">${opcoesEtapa(i.etapa)}</select></td>
      <td>${celTexto(i, 'texto', 'Texto')}</td>
      <td class="ctl-mais"><button type="button" class="cx-btn cx-mini" data-ctl-abrir="${esc(i.id)}" title="Detalhes, histórico e excluir" aria-label="Mais do pedido ${esc(i.pedido)}">⋯</button></td>
    </tr>`;
  }
  const CABECALHO = '<colgroup><col style="width:150px"><col style="width:46px"><col style="width:190px"><col style="width:140px"><col style="width:140px"><col style="width:150px"><col style="width:130px"><col style="width:190px"><col style="width:230px"><col style="width:52px"></colgroup><thead><tr><th>Pedido</th><th aria-label="Comentários"></th><th>Fornecedor</th><th>Emissão</th><th>Vencimento</th><th>Instalação</th><th>Nota</th><th>Etapa</th><th>Texto</th><th></th></tr></thead>';
  function bateria(lista){
    const total = lista.length || 1;
    return `<div class="ctl-bateria" title="${GRUPOS.map(g => `${g.etapa}: ${lista.filter(i => i.etapa === g.etapa).length}`).join(' · ')}">${GRUPOS.map(g => { const n = lista.filter(i => i.etapa === g.etapa).length; return n ? `<i style="background:${g.cor};width:${(n / total) * 100}%"></i>` : ''; }).join('')}</div>`;
  }
  function grupoHtml(g){
    const lista = E.itens.filter(i => i.etapa === g.etapa && passa(i)).sort((a, b) => a.posicao - b.posicao);
    const fechado = !!E.fechados[g.etapa];
    return `<section class="ctl-grupo ${fechado ? 'fechado' : ''}" style="--g:${g.cor}">
      <div class="ctl-grupo-cabeca"><button type="button" data-ctl-recolher="${esc(g.etapa)}" aria-expanded="${!fechado}"><span class="seta" aria-hidden="true">${fechado ? '▸' : '▾'}</span><h3>${esc(g.etapa)}</h3></button><span class="cnt">${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}</span></div>
      ${fechado ? '' : `<div class="ctl-tabela"><table>${CABECALHO}<tbody>${lista.map(linha).join('') || '<tr><td colspan="10" class="ctl-vazio">Nenhum pedido neste grupo.</td></tr>'}
        <tr class="ctl-novo-linha"><td colspan="10"><input class="ctl-cel" data-ctl-adicionar="${esc(g.etapa)}" placeholder="+ Adicionar pedido (digite o número e tecle Enter)" aria-label="Adicionar pedido em ${esc(g.etapa)}" autocomplete="off"></td></tr></tbody>
        <tfoot><tr><td colspan="7"></td><td>${bateria(lista)}</td><td colspan="2"></td></tr></tfoot></table></div>`}
    </section>`;
  }
  function ferramentas(){
    const f = E.filtro;
    return `<div class="ctl-ferramentas"><label class="ctl-busca">Pesquisar<input type="search" data-ctl-filtro="q" value="${esc(f.q)}" placeholder="Pedido, fornecedor, nota, instalação…" autocomplete="off"></label>
      <label>Fornecedor<select data-ctl-filtro="forn"><option value="">Todos</option>${E.fornecedores.map(x => `<option${x === f.forn ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Vencimento de<input type="date" data-ctl-filtro="vde" value="${esc(f.vde)}"></label><label>Vencimento até<input type="date" data-ctl-filtro="vate" value="${esc(f.vate)}"></label>
      <button type="button" class="cx-btn cx-mini" data-ctl-limpar>Limpar filtros</button></div>`;
  }
  function abas(){
    const vistas = [['quadro', 'Quadro principal'], ['novo', 'Novo lançamento'], ['atividade', 'Atividade']];
    return `<nav class="notas-abas ctl-abas" aria-label="Visualizações do Controle de Lançamentos">${vistas.map(([k, t], i) => `<button type="button" class="${E.vista === k ? 'active' : ''}" data-ctl-vista="${k}"><span class="idx">${String(i + 1).padStart(2, '0')}</span>${t}${k === 'quadro' ? `<span class="cnt">${E.itens.length}</span>` : ''}</button>`).join('')}</nav>`;
  }
  function cabecalho(){
    return `<div class="notas-painel-cabeca"><div><span class="cx-kicker">ADMINISTRATIVO · CONTROLE DE LANÇAMENTOS</span><h1>Controle de Lançamentos</h1>
      <p>Pedidos por etapa, como no quadro da Monday: aguardando aprovação, aprovados a enviar e enviados. Mude a Etapa e o pedido vai sozinho para o grupo dela. Tudo fica no histórico.</p></div>
      <div class="ctl-acoes"><button type="button" class="cx-btn notas-btn" data-ctl-vista="novo">Criar pedido</button><button type="button" class="cx-btn" data-ctl-exportar>Exportar Excel</button><button type="button" class="cx-btn" data-ctl-automacoes>Automações · 4</button></div></div>`;
  }
  function telaFormulario(){
    const a = E.aviso;
    return `<form class="ctl-form" data-ctl-form novalidate><h2>Novo Lançamento</h2><p class="notas-faint">Pedido, Fornecedor e Emissão são obrigatórios. O pedido entra em "Aguardando aprovação", a menos que você escolha outra Etapa.</p>
      ${a ? `<div class="notas-ok">${esc(a)} <button type="button" class="cx-btn cx-mini" data-ctl-vista="quadro">Ver no quadro</button></div>` : ''}
      <div class="ctl-form-grade">
        <label>Pedido *<input name="pedido" required autocomplete="off"></label>
        <label>Fornecedor *<select name="fornecedor" data-ctl-forn-form required>${opcoesFornecedor('')}</select></label>
        <label>Emissão *<input name="emissao" type="date" required></label>
        <label>Vencimento<input name="vencimento" type="date"></label>
        <label>Instalação<input name="instalacao" autocomplete="off"></label>
        <label>Nota<input name="nota" autocomplete="off"></label>
        <label>Etapa<select name="etapa">${opcoesEtapa('Aguardando aprovação')}</select></label>
        <label>Texto<input name="texto" autocomplete="off"></label>
        <label class="largo">Comentário (opcional)<textarea name="comentario" rows="3" placeholder="Fica nos comentários do pedido"></textarea></label>
      </div>
      <div class="ctl-form-acoes"><button type="submit" class="cx-btn notas-btn">Lançar pedido</button></div></form>`;
  }
  const ROTULO_TIPO = { criado:'Criado', alterado:'Alterado', etapa:'Etapa', grupo:'Movido de grupo', comentario:'Comentário', excluido:'Excluído', quadro:'Quadro' };
  function eventoTexto(e){
    if (e.tipo === 'criado') return `Pedido criado${e.depois ? ' em ' + e.depois : ''}`;
    if (e.tipo === 'comentario') return `Comentou: ${e.depois || ''}`;
    if (e.tipo === 'excluido') return 'Pedido excluído';
    if (e.tipo === 'quadro') return `${e.campo || ''}${e.depois ? ': ' + e.depois : ''}`;
    const fmt = v => v == null || v === '' ? 'vazio' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? dataBR(v) : v;
    return `${e.campo || ''}: ${fmt(e.antes)} → ${fmt(e.depois)}`;
  }
  function telaAtividade(){
    const q = norm(E.filtro.q);
    const lista = E.eventos.filter(e => !q || norm([e.pedido, e.ator, e.campo, e.antes, e.depois].join(' ')).includes(q));
    return `<div class="ctl-ferramentas"><label class="ctl-busca">Pesquisar<input type="search" data-ctl-filtro="q" value="${esc(E.filtro.q)}" placeholder="Pedido, pessoa, campo…" autocomplete="off"></label><span class="notas-faint">${lista.length} registros (inclui todo o histórico importado da Monday)</span></div>
      <div class="ctl-tabela"><table class="ctl-atividade"><colgroup><col style="width:150px"><col style="width:110px"><col style="width:150px"><col><col style="width:230px"></colgroup><thead><tr><th>Quando</th><th>Pedido</th><th>O quê</th><th>Detalhe</th><th>Quem</th></tr></thead><tbody>
      ${lista.slice(0, E.maisAtividade).map(e => `<tr><td class="notas-faint">${esc(quandoBR(e.em))}</td><td>${e.item_id && itemPorId(e.item_id) ? `<button type="button" class="ctl-link" data-ctl-abrir="${esc(e.item_id)}">${esc(e.pedido || '—')}</button>` : esc(e.pedido || '—')}</td><td>${esc(ROTULO_TIPO[e.tipo] || e.tipo)}</td><td>${esc(eventoTexto(e))}</td><td class="notas-faint">${esc(e.ator || '—')}${e.origem === 'monday' ? ' · Monday' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="ctl-vazio">Sem registros.</td></tr>'}
      </tbody></table></div>${lista.length > E.maisAtividade ? '<div class="ctl-form-acoes"><button type="button" class="cx-btn" data-ctl-mais-atividade>Mostrar mais</button></div>' : ''}`;
  }
  function telaLogin(){
    return `<form class="ctl-form ctl-login" data-ctl-login novalidate><h2>Entrar no Controle de Lançamentos</h2><p class="notas-faint">Entre com o seu login da TAG (Notas fiscais) ou com o e-mail e a senha da Expansão. Acesso: Marina, Laura, Bruno, Tatiana, Gustavo, Marcos e Otávio.</p>
      <div class="ctl-form-grade"><label>E-mail<input name="email" type="email" autocomplete="username" required value="${esc(E.email)}"></label><label>Senha<input name="senha" type="password" autocomplete="current-password" required></label></div>
      <div class="ctl-form-acoes"><button type="submit" class="cx-btn notas-btn">Entrar</button></div></form>`;
  }

  async function render(area){
    E.area = area || E.area || document.getElementById('cxArea');
    if (!E.area) return;
    if (!E.email && !(await temSessao())) { E.area.innerHTML = `<section class="notas-painel ctl">${cabecalhoSimples()}${telaLogin()}</section>`; return; }
    if (!E.carregado) {
      E.area.innerHTML = '<div class="cx-carregando-tela" role="status"><span class="cx-anel" aria-hidden="true"></span>Carregando o Controle de Lançamentos…</div>';
      try { await carregar(); ligarTempoReal(); }
      catch (e) { E.area.innerHTML = `<section class="notas-painel ctl">${cabecalhoSimples()}<div class="notas-nota">Não foi possível carregar: ${esc(e.message)}. ${/permission|policy|42501/i.test(e.message) ? 'Sua conta não tem acesso a esta aba.' : ''}</div></section>`; return; }
    }
    if (E.vista === 'atividade' && !E.eventos.length) { try { await carregarEventos(); } catch (e) { toast(e.message, true); } }
    desenhar();
  }
  const cabecalhoSimples = () => '<div class="notas-painel-cabeca"><div><span class="cx-kicker">ADMINISTRATIVO · CONTROLE DE LANÇAMENTOS</span><h1>Controle de Lançamentos</h1></div></div>';
  function desenhar(){
    if (!E.area?.isConnected || !E.carregado) return;
    const foco = document.activeElement?.closest?.('.ctl') ? { sel:document.activeElement.dataset.ctlFiltro, pos:document.activeElement.selectionStart } : null;
    const corpo = E.vista === 'novo' ? telaFormulario() : E.vista === 'atividade' ? telaAtividade() : ferramentas() + `<div class="ctl-grupos">${GRUPOS.map(grupoHtml).join('')}</div>`;
    E.area.innerHTML = `<section class="notas-painel ctl">${cabecalho()}${abas()}${corpo}</section>`;
    if (foco?.sel) { const el = E.area.querySelector(`[data-ctl-filtro="${foco.sel}"]`); if (el) { el.focus(); try { if (foco.pos != null) el.setSelectionRange(foco.pos, foco.pos); } catch (_) { /* data */ } } }
    if (E.aberto) desenharGaveta();
  }

  // ---------- gaveta do pedido ----------
  function desenharGaveta(){
    const i = itemPorId(E.aberto); let raiz = document.getElementById('ctlGavetaRaiz');
    if (!i) { if (raiz) raiz.innerHTML = ''; E.aberto = null; return; }
    if (!raiz) { raiz = document.createElement('div'); raiz.id = 'ctlGavetaRaiz'; document.body.appendChild(raiz); }
    const coms = comentariosDe(i.id).slice().sort((a, b) => String(b.em).localeCompare(String(a.em)));
    const hist = E.eventos.length ? E.eventos.filter(e => e.item_id === i.id) : null;
    raiz.innerHTML = `<div class="notas-veu" data-ctl-fechar></div><aside class="notas-gaveta ctl ctl-gaveta" role="dialog" aria-label="Pedido ${esc(i.pedido)}">
      <div class="notas-gaveta-topo"><div><h2>Pedido ${esc(i.pedido || '—')}</h2><div class="sub">${esc(i.fornecedor || 'Sem fornecedor')} · <span class="ctl-etq" style="--c:${COR[i.etapa]}">${esc(i.etapa)}</span>${i.origem === 'monday' ? ' · veio da Monday' : ''}</div></div><button class="cx-btn cx-mini" type="button" data-ctl-fechar>Fechar</button></div>
      <div class="ctl-gaveta-corpo">
        <div class="ctl-form-grade">
          <label>Pedido${celTexto(i, 'pedido', 'Número')}</label>
          <label>Fornecedor<select class="ctl-cel" data-ctl-id="${esc(i.id)}" data-ctl-campo="fornecedor">${opcoesFornecedor(i.fornecedor)}</select></label>
          <label>Emissão${celData(i, 'emissao', 'Emissão')}</label><label>Vencimento${celData(i, 'vencimento', 'Vencimento')}</label>
          <label>Instalação${celTexto(i, 'instalacao', 'Instalação')}</label><label>Nota${celTexto(i, 'nota', 'Nota')}</label>
          <label>Etapa<select class="ctl-etapa" style="--c:${COR[i.etapa]}" data-ctl-id="${esc(i.id)}" data-ctl-campo="etapa">${opcoesEtapa(i.etapa)}</select></label>
          <label>Texto${celTexto(i, 'texto', 'Texto')}</label>
        </div>
        <p class="notas-faint">Criado em ${esc(quandoBR(i.criado_em))}${i.criado_por ? ' por ' + esc(i.criado_por) : ''} · última alteração ${esc(quandoBR(i.atualizado_em))}${i.atualizado_por ? ' por ' + esc(i.atualizado_por) : ''}</p>
        <h4>Comentários (${coms.length})</h4>
        <div class="ctl-comentar"><textarea id="ctlComentario" rows="3" placeholder="Escreva um comentário (fica no pedido, com seu nome e a hora)"></textarea><button type="button" class="cx-btn notas-btn" data-ctl-comentar="${esc(i.id)}">Comentar</button></div>
        <ul class="ctl-comentarios">${coms.map(c => `<li><div class="t">${esc(c.autor || c.autor_email || '—')} · ${esc(quandoBR(c.em))}${c.origem === 'monday' ? ' · Monday' : ''}</div><div>${esc(c.texto)}</div></li>`).join('') || '<li class="notas-faint">Nenhum comentário.</li>'}</ul>
        <h4>Histórico do pedido</h4>
        ${hist === null ? '<p class="notas-faint">Carregando…</p>' : `<ul class="ctl-comentarios">${hist.map(e => `<li><div class="t">${esc(quandoBR(e.em))} · ${esc(e.ator || '—')}${e.origem === 'monday' ? ' · Monday' : ''}</div><div>${esc(eventoTexto(e))}</div></li>`).join('') || '<li class="notas-faint">Sem registros.</li>'}</ul>`}
        <div class="ctl-excluir" id="ctlExcluir"><button type="button" class="cx-btn" data-ctl-excluir="${esc(i.id)}" style="color:#e05a5a">Excluir pedido</button></div>
      </div></aside>`;
    if (hist === null) carregarEventos().then(() => { if (E.aberto === i.id) desenharGaveta(); }).catch(() => {});
  }
  function fecharGaveta(){ E.aberto = null; const r = document.getElementById('ctlGavetaRaiz'); if (r) r.innerHTML = ''; }

  function exportar(){
    if (!window.XLSX) return toast('A biblioteca do Excel ainda está carregando. Tente de novo em alguns segundos.', true);
    const linhas = GRUPOS.flatMap(g => E.itens.filter(i => i.etapa === g.etapa && passa(i)).sort((a, b) => a.posicao - b.posicao).map(i => ({
      'Grupo': g.etapa, 'Pedido': i.pedido, 'Fornecedor': i.fornecedor || '', 'Emissão': dataBR(i.emissao), 'Vencimento': dataBR(i.vencimento),
      'Instalação': i.instalacao || '', 'Nota': i.nota || '', 'Etapa': i.etapa, 'Texto': i.texto || '', 'Comentários': comentariosDe(i.id).length })));
    const ws = XLSX.utils.json_to_sheet(linhas), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle');
    XLSX.writeFile(wb, `controle-de-lancamentos-${new Date().toLocaleDateString('sv-SE')}.xlsx`);
  }
  function automacoes(){
    let d = document.getElementById('ctlAutomacoes');
    if (!d) { d = document.createElement('dialog'); d.id = 'ctlAutomacoes'; d.className = 'ctl-dialogo'; document.body.appendChild(d); }
    d.innerHTML = `<h2>Automações (4)</h2><p class="notas-faint">As mesmas 4 regras do quadro da Monday, agora feitas pelo próprio painel (sempre ligadas).</p><ol>${AUTOMACOES.map(([q, e]) => `<li><b>${esc(q)}</b>, ${esc(e)}</li>`).join('')}</ol><div class="ctl-form-acoes"><button type="button" class="cx-btn" data-ctl-fechar-dialogo>Fechar</button></div>`;
    try { d.showModal(); } catch (_) { d.setAttribute('open', ''); }
  }

  // ---------- modo só Controle (quem não tem acesso à TAG, ex.: Tatiana) ----------
  function temaSomente(){
    const botao = document.getElementById('notasTema'); if (!botao || botao.dataset.ctlTema) return;
    botao.dataset.ctlTema = '1';
    const aplicar = claro => { if (claro) document.documentElement.setAttribute('data-theme', 'claro'); else document.documentElement.removeAttribute('data-theme'); botao.textContent = claro ? 'Escuro' : 'Claro'; botao.setAttribute('aria-pressed', String(claro)); guardar('notas.tema.ctl', claro); try { localStorage.setItem('notas.tema', claro ? 'claro' : 'escuro'); } catch (_) { /* sem armazenamento */ } };
    let claro = false; try { claro = localStorage.getItem('notas.tema') === 'claro'; } catch (_) { /* padrão escuro */ }
    aplicar(claro);
    botao.addEventListener('click', () => aplicar(document.documentElement.getAttribute('data-theme') !== 'claro'));
  }
  const podeSomente = () => autorizado(E.email) && !NUNCA_SO.includes(E.email);
  async function somente(){
    if (!podeSomente()) return;
    E.somente = true;
    guardar('ctl.so', E.email);
    temaSomente();
    try { document.getElementById('janela-login')?.close(); } catch (_) { /* fechada */ }
    const nav = document.getElementById('cxAbas');
    if (nav) nav.innerHTML = `<div class="cx-marca"><span class="cx-marca-simbolo" aria-hidden="true"><i></i><i></i><i></i></span><span>administrativo<small>EMPRESA EXEMPLO</small></span></div>
      <div class="cx-nav-rotulo">ÁREA DE TRABALHO</div><div class="cx-nav-links"><button type="button" data-ctl-entrar-tag title="Entrar com o login da TAG para ver as notas fiscais"><svg class="cx-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Notas fiscais (entrar)</span></button><button role="tab" type="button" class="ativa">${'<svg class="cx-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>'}<span>Controle de Lançamentos</span></button></div>
      <div class="cx-nav-nota"><span class="cx-nav-traco"></span><p>Pedidos por etapa.<br>Um quadro só.</p><small>Controle de Lançamentos</small></div>
      <div class="cx-nav-pessoa"><span class="cx-avatar">${esc((E.email || '?').charAt(0).toUpperCase())}</span><div><b>${esc(E.email)}</b><small>Controle de Lançamentos</small></div><span class="cx-presenca" title="Sessão ativa"></span></div>`;
    const acesso = document.getElementById('notasAcesso');
    if (acesso) acesso.innerHTML = `<span>${esc(E.email)}</span><button class="cx-btn cx-mini" type="button" data-ctl-sair>Sair</button>`;
    await render(document.getElementById('cxArea'));
  }

  // ---------- eventos ----------
  document.addEventListener('click', async ev => {
    const t = ev.target;
    if (!t.closest?.('.ctl, #ctlGavetaRaiz, #ctlAutomacoes, [data-ctl-sair], [data-ctl-entrar-tag]')) return;
    const vista = t.closest('[data-ctl-vista]');
    if (vista) { E.vista = vista.dataset.ctlVista; guardar('ctl.vista', E.vista); if (E.vista !== 'novo') E.aviso = null; await render(); return; }
    const rec = t.closest('[data-ctl-recolher]');
    if (rec) { const g = rec.dataset.ctlRecolher; E.fechados[g] = !E.fechados[g]; guardar('ctl.fechados', E.fechados); desenhar(); return; }
    const abrir = t.closest('[data-ctl-abrir]');
    if (abrir) { E.aberto = abrir.dataset.ctlAbrir; desenharGaveta(); setTimeout(() => $('#ctlComentario')?.focus(), 30); return; }
    if (t.closest('[data-ctl-fechar]')) { fecharGaveta(); return; }
    if (t.closest('[data-ctl-fechar-dialogo]')) { t.closest('dialog')?.close(); return; }
    if (t.closest('[data-ctl-limpar]')) { E.filtro = { q:'', forn:'', vde:'', vate:'' }; desenhar(); return; }
    if (t.closest('[data-ctl-exportar]')) { exportar(); return; }
    if (t.closest('[data-ctl-automacoes]')) { automacoes(); return; }
    if (t.closest('[data-ctl-mais-atividade]')) { E.maisAtividade += 300; desenhar(); return; }
    if (t.closest('[data-ctl-sair]')) { await sair(); location.reload(); return; }
    if (t.closest('[data-ctl-entrar-tag]')) { const j = document.getElementById('janela-login'); try { j?.showModal(); } catch (_) { j?.setAttribute('open', ''); } return; }
    const com = t.closest('[data-ctl-comentar]');
    if (com) {
      const texto = ($('#ctlComentario')?.value || '').trim(); if (!texto) { toast('Escreva o comentário.', true); return; }
      com.disabled = true;
      try { E.comentarios.push(await comentarNoBanco(com.dataset.ctlComentar, texto)); E.eventos = []; await render(); toast('Comentário salvo.'); }
      catch (e) { com.disabled = false; toast('Não salvou: ' + e.message, true); }
      return;
    }
    const exc = t.closest('[data-ctl-excluir]');
    if (exc) { $('#ctlExcluir').innerHTML = `<span class="notas-faint">Excluir o pedido de vez? Fica uma cópia no histórico.</span> <button type="button" class="cx-btn" data-ctl-excluir-sim="${esc(exc.dataset.ctlExcluir)}" style="color:#e05a5a">Sim, excluir</button> <button type="button" class="cx-btn cx-mini" data-ctl-fechar>Cancelar</button>`; return; }
    const sim = t.closest('[data-ctl-excluir-sim]');
    if (sim) {
      sim.disabled = true;
      try { const id = sim.dataset.ctlExcluirSim, p = itemPorId(id)?.pedido; if (E.modo === 'tag') await api('excluir', { id }); else conferir(await cliente().from('controle_lancamentos').delete().eq('id', id)); E.itens = E.itens.filter(i => i.id !== id); E.eventos = []; fecharGaveta(); await render(); toast(`Pedido ${p} excluído.`); }
      catch (e) { sim.disabled = false; toast('Não excluiu: ' + e.message, true); }
    }
  });
  document.addEventListener('change', async ev => {
    const el = ev.target;
    if (!el.closest?.('.ctl')) return;
    if (el.dataset.ctlFiltro && el.type !== 'search') {
      // Data digitada aos poucos: só aplica com o ano completo (o navegador avisa a cada parte).
      if (el.type === 'date' && el.value && !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(el.value)) return;
      E.filtro[el.dataset.ctlFiltro] = el.value; desenhar(); return;
    }
    if (el.matches('[data-ctl-forn-form]') && el.value === '__novo__') { const n = await novoFornecedor(); el.innerHTML = opcoesFornecedor(n || ''); return; }
    if (!el.dataset.ctlCampo) return;
    let valor = el.value;
    if (el.dataset.ctlCampo === 'fornecedor' && valor === '__novo__') { valor = await novoFornecedor(); if (!valor) { el.value = itemPorId(el.dataset.ctlId)?.fornecedor || ''; return; } }
    if (el.dataset.ctlCampo === 'pedido' || el.type === 'text' || el.tagName === 'INPUT' && el.type !== 'date') valor = valor.trim();
    await salvarCampo(el.dataset.ctlId, el.dataset.ctlCampo, valor);
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (!el.closest?.('.ctl') || el.dataset.ctlFiltro !== 'q') return;
    clearTimeout(el._t); el._t = setTimeout(() => { E.filtro.q = el.value; desenhar(); }, 300);
  });
  document.addEventListener('keydown', async ev => {
    const el = ev.target;
    if (ev.key === 'Escape' && E.aberto && !el.closest?.('dialog')) { fecharGaveta(); return; }
    if (ev.key !== 'Enter' || !el.closest?.('.ctl')) return;
    if (el.dataset.ctlAdicionar !== undefined) {
      ev.preventDefault();
      const pedido = el.value.trim(); if (!pedido) return;
      el.disabled = true;
      try { const n = await criar({ pedido, etapa:'Aguardando aprovação' }); desenhar(); toast(`Pedido ${n.pedido} criado em Aguardando aprovação.`); const novo = E.area.querySelector(`[data-ctl-linha="${n.id}"] [data-ctl-campo="fornecedor"]`); novo?.focus(); }
      catch (e) { el.disabled = false; toast('Não criou: ' + e.message, true); }
      return;
    }
    if (el.matches('input.ctl-cel[data-ctl-campo]')) { ev.preventDefault(); el.blur(); }
  });
  document.addEventListener('submit', async ev => {
    const f = ev.target;
    if (f.matches?.('[data-ctl-login]')) {
      ev.preventDefault();
      const b = f.querySelector('button'); b.disabled = true;
      const ok = await entrar(f.elements.email.value, f.elements.senha.value).catch(() => false);
      b.disabled = false;
      if (!ok) { toast(autorizado(f.elements.email.value) ? 'Não foi possível entrar. Confira o e-mail e a senha da Expansão.' : 'Este e-mail não tem acesso ao Controle de Lançamentos.', true); return; }
      if (E.somente) somente(); else render();
      return;
    }
    if (!f.matches?.('[data-ctl-form]')) return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    const pedido = String(d.pedido || '').trim(), comentario = String(d.comentario || '').trim();
    if (!pedido) return toast('Informe o Pedido.', true);
    if (!d.fornecedor || d.fornecedor === '__novo__') return toast('Escolha o Fornecedor.', true);
    if (!d.emissao) return toast('Informe a Emissão.', true);
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try {
      const n = await criar({ pedido, fornecedor:d.fornecedor, emissao:d.emissao, vencimento:d.vencimento || null, instalacao:String(d.instalacao || '').trim() || null,
        nota:String(d.nota || '').trim() || null, texto:String(d.texto || '').trim() || null, etapa:d.etapa || 'Aguardando aprovação' }, comentario);
      E.aviso = `Pedido ${n.pedido} lançado em ${n.etapa}.`; desenhar(); toast(E.aviso);
    } catch (e) { b.disabled = false; toast('Não lançou: ' + e.message, true); }
  });

  window.Controle = {
    // Mostra a aba no menu: quem já entrou na Expansão (sessão guardada) ou quem entrou na TAG com um e-mail autorizado.
    visivel: emailTag => autorizado(E.email) || autorizado(emailTag),
    temSessao, entrar, sair, somente, render: area => render(area), podeSomente,
    soControle: () => podeSomente() && lembrar('ctl.so', '') === E.email,
    limparSo: () => { try { localStorage.removeItem('ctl.so'); } catch (_) { /* sem armazenamento */ } },
  };
})();
