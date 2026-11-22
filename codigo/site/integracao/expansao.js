// Regras de apresentação compartilhadas pela interface e pelos testes.
(function(root){
  'use strict';
  const normalizar = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const statusCompra = r => /^recusad/i.test(r.etapa) ? 'Recusados' : r.etapa === 'Aprovada' ? 'Aprovados' : 'Pendentes';
  const podeVerReq = (p, r) => p.perfil !== 'engenharia' || (r.solicitanteEmail ? normalizar(r.solicitanteEmail) === normalizar(p.email) : normalizar(r.solicitante) === normalizar(p.nome));
  // Quem abriu a requisição aprova, pede ajuste ou recusa; administração também (Gustavo, 09/11).
  const podeDecidirReq = (p, r) => !!r && (p.perfil === 'admin' || (p.perfil === 'engenharia' && podeVerReq(p, r)));
  const texto = r => normalizar([r.id,r.nf,r.nome,r.fornecedor,r.unidade,r.tipo,r.descricao,r.narrativa,...(r.itens || []).map(i=>i.descricao || i.nome || '')].join(' '));
  const dia = v => String(v || '').slice(0, 10);
  const filtrar = (r, f, compras) => (!f.busca || texto(r).includes(normalizar(f.busca))) && (!f.unidade || unidadeChave(r.unidade) === unidadeChave(f.unidade))
    && (!f.status || (compras ? statusCompra(r) : r.etapa) === f.status) && (!f.prioridade || r.prioridade === f.prioridade)
    && (!f.fornecedor || r.fornecedor === f.fornecedor) && (!f.natureza || r.natureza === f.natureza)
    && (!f.de || dia(r.emissao) >= f.de) && (!f.ate || (!!dia(r.emissao) && dia(r.emissao) <= f.ate));
  // Engenharia corrige narrativa e contrato até antes de escriturar (Gustavo, 09/11).
  const ETAPAS_CORRIGIVEIS = ['contrato','pedido','aprovacao','fora'];
  const podeCorrigirAnalise = (p, n) => !!n && ['engenharia','admin'].includes(p.perfil) && ETAPAS_CORRIGIVEIS.includes(n.etapa);
  // "Nota de / No cartão de": só engenheiros, enquanto a nota não foi para a escrituração.
  const podeEditarVinculo = n => !!n && ['engenharia', ...ETAPAS_CORRIGIVEIS].includes(n.etapa);
  // Cores das unidades = cores de status da coluna Unidade nos quadros Aprovações e Notas da Monday (mesmos hex nos dois).
  const CORES_UNIDADE = { '001':'#9aadbd', '002':'#007eb5', '003':'#401694', '004':'#c4c4c4', '005':'#fdab3d', '006':'#00c875', '007':'#df2f4a', '008':'#9d50dd', '009':'#037f4c', '010':'#579bfc', '011':'#cab641', '012':'#ffcb00', '013':'#333333', '014':'#bb3354', '015':'#ff007f', '017':'#784bd1', '018':'#9cd326', '019':'#66ccff', '020':'#ff6d3b', '099':'#757575' };
  const RESERVA = ['#4338ca','#9d174d','#b45309','#1d4ed8','#6d28d9','#0f766e','#92400e','#3730a3'];
  const corUnidade = u => CORES_UNIDADE[unidadeChave(u)] || RESERVA[[...normalizar(u)].reduce((s, c) => s + c.charCodeAt(0), 0) % RESERVA.length];
  // Unidades fixas (Gustavo, 10/11): só estas aparecem no filtro, sempre, na mesma ordem.
  const UNIDADES_FIXAS = [['001','SOROCABA'],['002','AMERICANA'],['003','ILHÉUS'],['004','CAMPINA GRANDE'],['005','LONDRINA'],['006','PELOTAS'],['007','ANÁPOLIS'],['008','CONTAGEM'],['009','NITERÓI'],['010','CASCAVEL'],['011','MARÍLIA'],['012','JOINVILLE'],['013','MONTES CLAROS'],['014','PALMAS'],['015','IPATINGA'],['017','BLUMENAU'],['018','MARINGÁ'],['019','PINHAL'],['020','ARARAQUARA'],['099','CORPORATIVO']];
  const codigoPorNome = new Map(UNIDADES_FIXAS.map(([c, n]) => [normalizar(n), c]));
  // "001" e "001 - SOROCABA" e "SOROCABA" são a mesma unidade.
  const unidadeChave = u => { const s = String(u ?? '').trim(); if (!s) return ''; const m = s.match(/^(\d{3})(?!\d)/); return m ? m[1] : (codigoPorNome.get(normalizar(s)) || normalizar(s)); };
  // Sempre "código - NOME" (ex.: "018 - MARINGÁ"), venha o dado só com o número, só com o nome ou completo.
  const nomeUnidade = u => { const s = String(u ?? '').trim(), cod = unidadeChave(s), fixa = UNIDADES_FIXAS.find(([c]) => c === cod); return fixa ? `${fixa[0]} - ${fixa[1]}` : (s || '—'); };
  const configurarUnidades = () => {};
  const opcoesUnidade = () => UNIDADES_FIXAS.map(([c, n]) => [c, c + ' - ' + n]);
  const api = { unidadeChave, nomeUnidade, configurarUnidades, opcoesUnidade, normalizar, statusCompra, podeVerReq, podeDecidirReq, texto, filtrar, podeCorrigirAnalise, podeEditarVinculo, corUnidade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExpansaoRegras = api;
})(typeof window !== 'undefined' ? window : null);

// Adaptador da prévia: reserva e versão de cada nota entre abas do MESMO navegador.
// Em produção substituir por um adaptador de servidor com o mesmo contrato atômico.
(function(root){
  'use strict';
  function criar({usuario,storage,executar,agora=Date.now,token,ttl=45000,namespace='expansao_colaboracao_v1'}){
    const key = namespace, ler = () => { try { return JSON.parse(storage.getItem(key)) || {reservas:{},dados:{}}; } catch { throw Error('Não foi possível ler as reservas.'); } };
    const mudar = fn => executar(key, () => { const b=ler(), r=fn(b); storage.setItem(key,JSON.stringify(b)); return r; });
    const minha = r => r && r.token === token && r.expira > agora();
    return {
      token,
      adquirir:id=>mudar(b=>{const r=b.reservas[id];if(r && r.expira>agora() && r.token!==token)return {ok:false,reserva:r};const nova={token,nome:usuario.nome,email:usuario.email,expira:agora()+ttl};b.reservas[id]=nova;return {ok:true,reserva:nova,dados:b.dados[id] || null};}),
      renovar:id=>mudar(b=>{if(!minha(b.reservas[id]))return false;b.reservas[id].expira=agora()+ttl;return true;}),
      liberar:id=>mudar(b=>{if(b.reservas[id]?.token===token)delete b.reservas[id];}),
      validar:id=>minha(ler().reservas[id]),
      listar:()=>Object.fromEntries(Object.entries(ler().reservas).filter(([,r])=>r.expira>agora())),
      dados:()=>ler().dados,
      salvar:(id,valor,versao)=>mudar(b=>{if(!minha(b.reservas[id]))throw Error('A reserva desta nota expirou ou pertence a outra pessoa.');const atual=b.dados[id]?.versao || 0;if(atual!==versao)throw Error('A nota foi atualizada em outra sessão. Reabra antes de salvar.');const novo={versao:atual+1,valor};b.dados[id]=novo;return novo;}),
    };
  }
  const api = {criar};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.ExpansaoReservas=api;
})(typeof window!=='undefined'?window:null);

// Interface de Aprovações e Compras. O hospedeiro fornece ExpansaoDados e chama
// ExpansaoUI.entrar(pessoa). A demonstração e seu seletor de perfis ficam em demo-interface.js.
// As transições abaixo ainda são a referência local: a integração de serviços deve
// confirmar persistência/autorização no servidor antes de atualizar esta projeção da tela.
(function(){
  'use strict';
  const D = window.ExpansaoDados;
  const R = window.ExpansaoRegras;
  if (!D) throw new Error('Forneça ExpansaoDados antes de carregar a interface.');
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const dinheiro = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const dataBR = v => v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—';
  const hora = () => new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const icones = {
    documento:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    analise:'<path d="M9 4H5v16h14V4h-4M9 2h6v4H9zM8 13l3 3 5-6"/>',
    compras:'<path d="M3 7h18l-2 14H5L3 7zM8 7V5a4 4 0 0 1 8 0v2"/>',
    relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pedido:'<path d="M4 6h16v15H4zM8 3v6M16 3v6M4 11h16M8 15h3"/>',
    check:'<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>',
    envio:'<path d="m3 3 19 9-19 9 4-9-4-9zM7 12h15"/>',
    busca:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    seta:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    mais:'<path d="M12 5v14M5 12h14"/>',
    grade:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tabela:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  };
  const icone = nome => `<svg class="cx-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[nome] || icones.documento}</svg>`;
  const vazio = texto => `<div class="cx-vazio">${icone('check')}<b>${texto}</b><span>Selecione outra etapa para continuar acompanhando.</span></div>`;
  const filtroVazio = () => ({ busca:'', unidade:'', status:'', prioridade:'', fornecedor:'', natureza:'', de:'', ate:'' });
  const filtros = { aprovacoes:filtroVazio(), compras:filtroVazio(), contratos:filtroVazio(), projetos:filtroVazio() };
  // A aba Contratos tem filtros próprios, para não misturar com os das notas.
  const chaveFiltro = () => (area === 'aprovacoes' && aba === 'contrato' && D.contratos) ? 'contratos' : area;
  function ferramentas(tipo, qtd){
    const f = filtros[area], compras = area === 'compras';
    R.configurarUnidades([...notas(), ...reqVisiveis()].map(r => r.unidade));
    const unidades = R.opcoesUnidade([...notas(), ...reqVisiveis()].map(r => r.unidade));
    const opcoes = (lista, valor) => lista.map(([v,l]) => `<option value="${esc(v)}" ${valor === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<div class="cx-ferramentas"><label class="cx-pesquisa">${icone('busca')}<input class="cx-busca" data-busca aria-label="Buscar ${tipo}" value="${esc(f.busca)}" placeholder="Buscar por descrição do item, ${compras ? 'requisição' : 'NF'} ou unidade…"></label><span class="cx-contagem" aria-live="polite"><b data-contagem>${qtd}</b> ${tipo === 'nota' ? 'notas' : 'requisições'}</span></div><div class="cx-filtros"><label>Unidade<select data-cxfilter="unidade">${opcoes([['','Todas as unidades'],...unidades],f.unidade)}</select></label>${compras ? `<label>Situação<select data-cxfilter="status">${opcoes([['','Todas'],...['Pendentes','Aprovados','Recusados'].map(s => [s,s])],f.status)}</select></label>` : extrasNotas(f, opcoes)}${compras ? `<label>Tipo de prioridade<select data-cxfilter="prioridade">${opcoes([['','Todas'],['Padrão','Padrão'],['Urgente','Urgente']],f.prioridade)}</select></label>` : ''}<button class="cx-btn cx-mini" data-limpar-filtros>Limpar filtros</button></div>`;
  }
  // Filtros de Aprovações (valem em todas as etapas, inclusive Encaminhadas): fornecedor, natureza e período de emissão.
  function extrasNotas(f, opcoes){
    const lista = notas(), unicos = campo => [...new Set(lista.map(n => n[campo]).filter(Boolean))].sort();
    return `<label>Natureza<select data-cxfilter="natureza">${opcoes([['','Todas'],...unicos('natureza').map(x => [x,x])], f.natureza)}</select></label><label>Emissão de<input type="date" data-cxfilter="de" value="${esc(f.de)}"></label><label>Emissão até<input type="date" data-cxfilter="ate" value="${esc(f.ate)}"></label>`;
  }

  // Quem vê cada aba. Lançamento: equipe. Compras: engenharia e Helena.
  const ACESSO = { admin:['lancamento','aprovacoes','compras'], equipe:['lancamento','aprovacoes'], engenharia:['aprovacoes','compras'], compras:['compras'] };
  const TITULO = { lancamento:'Painel de Lançamento de NFs, CT-e e Faturas', aprovacoes:'Aprovações da Expansão', compras:'Compras', projetos:'Quadro de Projetos', portfolio:'Portfólio de Projetos (Monday)', portfolioPainel:'Portfólio de Projetos (nosso painel)' };
  // Projetos e Portfólio (Gustavo, 12/11): só quem o banco libera (Marcos e Gustavo). Ficam embaixo de Compras no menu.
  const areasDe = p => [...ACESSO[p.perfil], ...(D.projetosAcesso ? ['projetos', 'portfolio', 'portfolioPainel'] : [])];
  const PORTFOLIO_URL = 'https://seu-portfolio.netlify.app/';
  const ETAPAS = { engenharia:'Análise da engenharia', contrato:'Vincular contrato', fora:'Fora da expansão', pedido:'A lançar no Datasul', aprovacao:'Aguardando aprovação do pedido', escrituracao:'Pronta para escriturar', encaminhada:'Encaminhada ao fluxo', fiscal:'E-mail enviado ao fiscal', arquivada:'Arquivada na Monday', cancelada:'Cancelada', devolvida:'Devolvida ao lançamento', outro:'Fora dos grupos da Monday' };
  const ABAS = [['engenharia','Expansão'],['contrato','Contratos'],['pedido','A lançar'],['aprovacao','Aprovação do pedido'],['escrituracao','Escrituração'],['fora','Fora da expansão'],['envios','Encaminhadas'],['canceladas','Canceladas'],['todas','Todas']];
  const PROXIMA = { engenharia:'Analisar nota', contrato:'Resolver contrato', pedido:'Registrar pedido', aprovacao:'Conferir aprovação', escrituracao:'Preparar envio', fora:'Consultar destino', encaminhada:'Ver envio', fiscal:'Ver envio', arquivada:'Ver nota', cancelada:'Ver nota', devolvida:'Ver nota', outro:'Ver nota' };

  const ANEXOS = { rm:'RM', propostas:'Propostas', certificados:'Certificados de qualidade' };
  const REMETENTE = 'Caixa da escrituração', DESTINO_COMPRAS = 'helena.rocha@empresa.exemplo';
  const diaBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  // O SLA conta em dias corridos a partir da criação da RM.
  const fimSLA = r => { const d = new Date(r.criadaEm); d.setDate(d.getDate() + r.sla); return d.toLocaleDateString('pt-BR'); };

  let pessoa = null, area = null, aba = 'engenharia', abertoId = null, abertoTipo = null, filtroReq = null, anexoAlvo = null, visaoReq = 'cartoes';
  const pode = perfil => pessoa.perfil === 'admin' || pessoa.perfil === perfil;
  const assinar = texto => `${texto} · ${hora()} · ${pessoa.nome}`;
  let reservas = null, reservaAtual = null, versoes = new Map(), ocupado = false;
  const aplicarRegistroNota = (id, registro) => {
    const n = D.lancamentos.find(n=>n.id===id);
    if (n && registro?.valor){ Object.assign(n,registro.valor.nota); D.fluxo[id]=registro.valor.fluxo; versoes.set(id,registro.versao); }
  };
  function sincronizarNotas(){
    if (!reservas) return;
    let mudou=false;
    for (const [chave,registro] of Object.entries(reservas.dados())){
      const id=chave.replace(/^nota:/,'');
      if(registro.versao>(versoes.get(id)||0) && !(reservaAtual?.id===id && reservas.validar(chave))){aplicarRegistroNota(id,registro);mudou=true;}
    }
    if(mudou){D.salvar();desenhar();}
    atualizarReservas();
  }
  function atualizarReservas(){
    if(!reservas)return;
    if(D.modoValidacao){const t=$('#cxReservas');if(t)t.hidden=true;return;}
    const lista=reservas.listar();
    const topo=$('#cxReservas');
    if(topo)topo.innerHTML=Object.entries(lista).map(([id,r])=>`<span><b>${esc(r.nome)}</b> · NF ${esc(D.lancamentos.find(n=>'nota:'+n.id===id)?.nf || id)}</span>`).join('') || '<span>Nenhuma nota em edição</span>';
    $$('[data-reserva-nota]').forEach(el=>{const r=lista['nota:'+el.dataset.reservaNota];el.textContent=r?`${r.nome} está preenchendo esta nota`:'';});
    if(!reservaAtual || abertoTipo!=='nota')return;
    const minha=reservas.validar('nota:'+reservaAtual.id), dono=lista['nota:'+reservaAtual.id];
    const faixa=$('#cxReservaAtual');
    if(faixa){const texto=minha?`Nota reservada para ${pessoa.nome}. Os demais usuários consultam em modo leitura.`:dono?`${dono.nome} está preenchendo esta nota. Você está em modo leitura.`:'Reserva indisponível. Feche e abra a nota para tentar novamente.';if(faixa.dataset.texto!==texto){faixa.dataset.texto=texto;faixa.innerHTML=esc(texto)+(minha?' <button class="cx-btn cx-mini" data-acao="liberarNota">Liberar nota</button>':'');}}
    $$('#cxModal input,#cxModal select,#cxModal textarea,#cxModal [data-acao]').forEach(el=>{
      if(el.dataset.acao==='fechar')return;
      if(!el.hasAttribute('data-trava-perfil'))el.dataset.travaPerfil=el.disabled?'1':'0';
      el.disabled=!minha || el.dataset.travaPerfil==='1' || ocupado;
    });
  }
  // Engenharia reserva para analisar e, até antes de escriturar, para corrigir a análise ou o vínculo.
  const podeReservar = n => (n.etapa === 'engenharia' && pode('engenharia')) || R.podeCorrigirAnalise(pessoa, n) || (pessoa.perfil === 'engenharia' && R.podeEditarVinculo(n)) || (['contrato','pedido','aprovacao','escrituracao'].includes(n.etapa) && pode('equipe'));
  async function reservarNota(id){
    if(!reservas || D.modoValidacao)return;
    if(reservaAtual?.id===id){atualizarReservas();return;}
    if(reservaAtual)await reservas.liberar('nota:'+reservaAtual.id);
    reservaAtual={id};atualizarReservas();
    const n=notas().find(n=>n.id===id);
    if(!n || !podeReservar(n))return;
    try{
      const r=await reservas.adquirir('nota:'+id);
      if(abertoId!==id || abertoTipo!=='nota'){if(r.ok)await reservas.liberar('nota:'+id);return;}
      if(r.ok && r.dados && r.dados.versao>(versoes.get(id)||0)){aplicarRegistroNota(id,r.dados);D.salvar();abrirNota(id);}
      atualizarReservas();
    }catch(e){aviso(e.message);atualizarReservas();}
  }
  async function alterarNota(id,mudar){
    if(ocupado)return false;
    ocupado=true;atualizarReservas();
    try{
      if(!reservas || !reservas.validar('nota:'+id))throw Error('Reserve a nota antes de alterar.');
      const valor={nota:structuredClone(D.lancamentos.find(n=>n.id===id)),fluxo:structuredClone(D.fluxo[id])};
      mudar(valor);
      const registro=await reservas.salvar('nota:'+id,valor,versoes.get(id)||0);
      aplicarRegistroNota(id,registro);D.salvar();return true;
    }catch(e){aviso(e.message);return false;}finally{ocupado=false;atualizarReservas();}
  }
  const reqVisiveis = () => D.requisicoes.filter(r => R.podeVerReq(pessoa, r));
  const getReq = id => reqVisiveis().find(r => r.id === id);
  // Cores fixas por unidade, iguais para todos (decisão do Gustavo, 09/11).
  const unidade = u => `<span class="cx-unidade-cor"><i style="background:${R.corUnidade(u)}" aria-hidden="true"></i>${esc(R.nomeUnidade(u))}</span>`;
  function aplicarFiltros(){
    if (!filtros[area] || area === 'aprovacoes') return;
    const f = filtros[area], linhas = $$('#cxArea [data-texto]');
    for (const l of linhas) l.hidden = !(!f.busca || l.dataset.texto.includes(R.normalizar(f.busca))) || (!!f.unidade && R.unidadeChave(l.dataset.unidade) !== R.unidadeChave(f.unidade)) || (!!f.status && l.dataset.status !== f.status) || (!!f.prioridade && l.dataset.prioridade !== f.prioridade) || (!!f.fornecedor && l.dataset.fornecedor !== f.fornecedor) || (!!f.natureza && l.dataset.natureza !== f.natureza) || (!!f.de && (l.dataset.emissao || '') < f.de) || (!!f.ate && (!l.dataset.emissao || l.dataset.emissao > f.ate));
    const quantidade = linhas.filter(l=>!l.hidden).length;
    if ($('[data-contagem]')) $('[data-contagem]').textContent = quantidade;
    if ($('.cx-sem-resultado')) $('.cx-sem-resultado').hidden = quantidade > 0 || !Object.values(f).some(Boolean);
  }

  // Em Aprovações a lista é refeita com o filtro; o campo usado volta a ter o foco.
  function filtrou(el){
    if (area !== 'aprovacoes') return aplicarFiltros();
    // O próprio campo volta para a tela redesenhada: mantém foco, cursor e acentuação em andamento.
    const posicao = el.matches('[data-busca]') ? el.selectionStart : null, chave = el.dataset.cxfilter;
    desenhar();
    const novo = chave ? $(`[data-cxfilter="${chave}"]`) : $('[data-busca]');
    if (novo && novo !== el){ novo.replaceWith(el); el.focus(); if (posicao != null) el.setSelectionRange(posicao, posicao); }
  }

  function aviso(texto){
    const t = $('#cxToast'); t.textContent = texto; t.hidden = false;
    clearTimeout(aviso.tempo); aviso.tempo = setTimeout(() => { t.hidden = true; }, 6000);
  }
  const etiqueta = (texto, tipo = '') => `<span class="cx-etq ${tipo}">${esc(texto)}</span>`;
  const botao = (id, texto, liberado = true, forte = true) => `<button class="cx-btn ${forte ? 'forte' : ''}" data-acao="${id}" ${liberado ? '' : 'disabled'}>${texto}</button>`;
  const bloqueio = perfil => pode(perfil) ? '' : `<p class="cx-aviso-perm">Ação de ${{ engenharia:'Engenharia', compras:'Compras', equipe:'Equipe de lançamento' }[perfil]}.</p>`;
  const historico = lista => `<h4 style="margin-top:16px">Histórico</h4><ul class="cx-hist">${lista.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;

  // Nota enviada no lançamento entra sozinha na fila da engenharia.
  function notas(){
    return D.lancamentos.filter(l => l.status === 'Enviado').map(l => {
      if (!D.fluxo[l.id]){ D.fluxo[l.id] = { etapa:'engenharia', narrativa:'', contrato:'', expansao:'', pedido:'', historico:[`Recebida do lançamento · ${hora()}`] }; D.salvar(); }
      return { ...l, ...D.fluxo[l.id] };
    });
  }

  function trocarArea(nova){
    if (!areasDe(pessoa).includes(nova)) return;
    area = nova;
    document.body.dataset.cxArea = nova;
    document.body.classList.toggle('cx-outra-area', area !== 'lancamento');
    $$('#cxAbas button').forEach(b => { b.classList.toggle('ativa', b.dataset.area === area); b.setAttribute('aria-selected', b.dataset.area === area); });
    $('.topbar h1').textContent = TITULO[area];
    $('#cxArea').hidden = area === 'lancamento';
    desenhar();
  }

  function desenhar(){
    if (!pessoa) return;
    cacheSaldo = null;
    const nA = $('#cxAbas [data-area=aprovacoes] .cx-num'); if (nA) nA.textContent = notas().filter(n => n.etapa === 'engenharia').length;
    const nC = $('#cxAbas [data-area=compras] .cx-num'); if (nC) nC.textContent = reqVisiveis().filter(r => R.statusCompra(r) === 'Pendentes').length;
    if (area === 'aprovacoes') $('#cxArea').innerHTML = telaAprovacoes();
    if (area === 'compras'){ $('#cxArea').innerHTML = telaCompras(); hidratarMiniaturas(); }
    if (area === 'projetos') $('#cxArea').innerHTML = telaProjetos();
    if (area === 'portfolio' && !$('#cxArea .cx-portfolio')) $('#cxArea').innerHTML = telaPortfolio();   // o site do portfólio não é refeito a cada atualização, para não perder o que se está vendo
    if (area === 'portfolioPainel') $('#cxArea').innerHTML = telaPortfolioPainel();
    const nP = $('#cxAbas [data-area=projetos] .cx-num'); if (nP) nP.textContent = D.projetos?.itens.length ?? 0;
    if (area !== 'lancamento') aplicarFiltros();
    barrasTopo();
    atualizarReservas();
  }
  // Barra de rolagem lateral também em cima das tabelas (Gustavo, 11/11): uma cópia sincronizada com a de baixo.
  function barrasTopo(){
    $$('#cxArea .cx-quadro-rolagem, #cxArea .cx-rolagem').forEach(el => {
      if (el.previousElementSibling?.classList.contains('cx-rolagem-topo')) return;
      const topo = document.createElement('div'); topo.className = 'cx-rolagem-topo'; topo.innerHTML = '<div></div>';
      el.before(topo);
      const interno = topo.firstChild, medir = () => { interno.style.width = el.scrollWidth + 'px'; topo.hidden = el.scrollWidth <= el.clientWidth + 1; };
      topo.addEventListener('scroll', () => { if (el.scrollLeft !== topo.scrollLeft) el.scrollLeft = topo.scrollLeft; });
      el.addEventListener('scroll', () => { if (topo.scrollLeft !== el.scrollLeft) topo.scrollLeft = el.scrollLeft; });
      medir();
      if (window.ResizeObserver){ const ro = new ResizeObserver(medir); ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild); }
    });
  }

  const dataHoje = () => new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  const iniciais = nome => esc(String(nome || '—').split(' ').filter(Boolean).slice(0,2).map(n => n[0]).join(''));
  const legendaAba = () => ({engenharia:'Expansão',contrato:'Contratos para vincular',pedido:'Pedidos a lançar',aprovacao:'Conferência de aprovação',escrituracao:'Preparar a escrituração',fora:'Fora da expansão',envios:'Notas encaminhadas',canceladas:'Notas canceladas',todas:'Todas as notas'}[aba]);

  const abasVisiveis = () => pessoa.perfil === 'engenharia' ? ABAS.filter(([k]) => ['engenharia','contrato','fora','todas'].includes(k)) : ABAS;
  // ---- Quadro de notas (como na Monday): cada linha é uma nota, os três campos da engenharia se preenchem na própria linha ----
  const ETAPAS_EDITAVEIS = ['engenharia','contrato','pedido','aprovacao','fora'];
  const podeEditarAnalise = n => ['engenharia','admin'].includes(pessoa.perfil) && ETAPAS_EDITAVEIS.includes(n.etapa);
  const proximaEtapa = f => f.expansao === 'Não' ? 'fora' : f.contrato === 'Sim' ? 'contrato' : 'pedido';
  const celulaTexto = (n, campo, rotulo) => podeEditarAnalise(n)
    ? `<input class="cx-cel" data-celula="${campo}" data-celula-nota="${esc(n.id)}" value="${esc(n[campo] || '')}" placeholder="${rotulo}" aria-label="${rotulo} da NF ${esc(n.nf)}" autocomplete="off">`
    : `<span class="cx-cel-leitura" title="${esc(n[campo] || '')}">${esc(n[campo] || '—')}</span>`;
  const celulaSimNao = (n, campo, rotulo) => podeEditarAnalise(n)
    ? `<select class="cx-cel" data-celula="${campo}" data-celula-nota="${esc(n.id)}" aria-label="${rotulo} da NF ${esc(n.nf)}"><option value=""${n[campo] ? '' : ' selected'}>—</option><option${n[campo] === 'Sim' ? ' selected' : ''}>Sim</option><option${n[campo] === 'Não' ? ' selected' : ''}>Não</option></select>`
    : `<span class="cx-cel-leitura">${esc(n[campo] || '—')}</span>`;
  const botaoAprovarLinha = n => n.etapa === 'engenharia' && podeEditarAnalise(n)
    ? `<button class="cx-btn cx-mini forte" data-aprovar-linha="${esc(n.id)}" ${n.narrativa && n.contrato && n.expansao ? '' : 'disabled'}>Aprovar</button>` : '';
  const podeAgirPedido = () => ['equipe','admin'].includes(pessoa.perfil);
  const celulaPedido = n => n.etapa === 'pedido' && podeAgirPedido()
    ? `<input class="cx-cel" data-celula="pedido" data-celula-nota="${esc(n.id)}" value="${esc(n.pedido || '')}" placeholder="Nº do pedido" aria-label="Número do pedido da NF ${esc(n.nf)}" autocomplete="off">`
    : `<span class="cx-cel-leitura">${esc(n.pedido || '—')}</span>`;
  const botaoLinhaBase = n => botaoAprovarLinha(n) || (n.etapa === 'pedido' && podeAgirPedido() ? `<button class="cx-btn cx-mini forte" data-pedido-linha="${esc(n.id)}">Registrar pedido</button>`
    : n.etapa === 'aprovacao' && podeAgirPedido() ? `<button class="cx-btn cx-mini forte" data-confirmar-linha="${esc(n.id)}">Confirmar aprovado</button>` : '');
  // Saldo do contrato menor que a nota: no lugar do botão de lançar, aparece o bloqueio (e o motivo ao passar o mouse).
  const botaoLinha = n => { const b = ['pedido', 'aprovacao'].includes(n.etapa) && podeAgirPedido() ? bloqueioSaldo(n) : null;
    return b ? `<span class="cx-etq rosa" title="${esc(b.texto)}">Bloqueada: saldo do contrato</span>` : botaoLinhaBase(n); };
  const linhaQuadro = n => `<tr data-linha="${esc(n.id)}" data-texto="${esc(R.texto(n))}" data-unidade="${esc(n.unidade)}" data-status="${esc(n.etapa)}" data-natureza="${esc(n.natureza)}" data-emissao="${esc(String(n.emissao || '').slice(0, 10))}">`
    + `<td class="cx-q-nota"><b>NF ${esc(n.nf)}</b><small title="${esc(n.fornecedor)}">${esc(n.fornecedor)}</small>`
    + `${podeVerVinculo() && (n.vinculo?.notaDe || n.vinculo?.cartaoDe) ? `<small class="cx-vinculo">Nota de <b>${esc(n.vinculo.notaDe || '—')}</b> · No cartão de <b>${esc(n.vinculo.cartaoDe || '—')}</b></small>` : ''}`
    + `<span data-reserva-nota="${esc(n.id)}" class="cx-reserva-etiqueta"></span></td>`
    + `<td>${unidade(n.unidade)}</td>`
    + `<td class="cx-q-narr">${celulaTexto(n, 'narrativa', 'Narrativa')}</td><td>${celulaSimNao(n, 'contrato', 'É contrato?')}</td><td>${celulaSimNao(n, 'expansao', 'Pertence à expansão?')}</td>`
    + `<td class="cx-q-ped">${celulaPedido(n)}</td><td>${esc(n.natureza)}</td><td>${dataBR(n.emissao)}</td><td>${dataBR(n.monday?.data_envio)}</td><td class="cx-q-valor">${dinheiro(n.valor)}</td><td>${dataBR(n.vencimento)}</td><td>${(n.arquivos || []).length}</td>`
    + `<td>${etiqueta(ETAPAS[n.etapa], n.etapa === 'escrituracao' ? 'verde' : n.etapa === 'contrato' ? 'ambar' : ['cancelada', 'devolvida'].includes(n.etapa) ? 'rosa' : '')}${bloqueioSaldo(n) ? `<br>${etiqueta('Saldo do contrato insuficiente', 'rosa')}` : ''}</td>`
    + `<td class="cx-q-acoes">${botaoLinha(n)}<button class="cx-btn cx-mini" data-nota="${esc(n.id)}">Abrir</button></td></tr>`;
  const quadroNotas = lista => `<div class="cx-quadro-rolagem"><table class="cx-quadro"><thead><tr><th>Nota / fornecedor</th><th>Unidade</th><th>Narrativa</th><th>É contrato?</th><th>Pertence à expansão?</th><th>Pedido (Datasul)</th><th>Natureza</th><th>Emissão</th><th>Envio</th><th>Valor</th><th>Vence</th><th>Docs</th><th>Etapa</th><th></th></tr></thead><tbody>${lista.map(linhaQuadro).join('')}</tbody></table></div>`;

  const trilha = dentro => `<aside class="cx-trilha"><div class="cx-kicker">PERCURSO DAS NOTAS</div><div class="cx-etapas" aria-label="Filtrar por etapa">${abasVisiveis().map(([k, nome], i) => `<button class="${k === aba ? 'active' : ''}" data-cxaba="${k}" aria-pressed="${k === aba}"><span class="cx-etapa-indice">${String(i+1).padStart(2,'0')}</span><span class="cx-etapa-nome">${nome}</span><b>${dentro(k).length}</b></button>`).join('')}</div><p class="cx-trilha-nota">${icone('documento')} A jornada começa quando a nota é enviada pelo lançamento.</p></aside>`;
  // ---- Aba Contratos: réplica do quadro Contratos da Monday (18380887328), com as mesmas separações e contas ----
  // Gustavo, 12/11: Globais, Contratos e Faturamento direto ficam juntos como "Contratos"; Aditivos e Finalizados continuam separados.
  // (O tipo de cada contrato continua visível na coluna Contrato e no filtro.)
  const GRUPOS_CONTRATO = ['Contratos','Aditivos','Contratos finalizados','Descontos'];
  const grupoContrato = c => ['Contratos Globais','Contratos','Contrato - Faturamento direto'].includes(c.grupo) ? 'Contratos' : c.grupo;
  const contratosAtivos = () => (D.contratos || []).filter(c => c.grupo !== 'Contratos finalizados' && c.status !== 'Encerrado').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // Campo de contrato: digita o nome para filtrar; o arquivo do contrato aparece ao lado enquanto se passa pelas opções (ver abrirCombo).
  // O valor escolhido fica no campo oculto (mesmos id/atributo que o antigo <select>), então o resto do código não muda.
  const campoContrato = (atributoValor, rotulo, desabilitado = '') => `<div class="cx-combo"><input type="text" class="cx-cel cx-combo-texto" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="${esc(rotulo)}" placeholder="Digite o nome do contrato…" autocomplete="off" ${desabilitado}><input type="hidden" ${atributoValor}></div>`;
  // Miniaturas dos arquivos do contrato (as mesmas da janela do contrato); clicar abre no visor ao lado, para conferir antes de vincular.
  const gradeArquivosContrato = c => { const arqs = arquivosContrato(c); return arqs.length
    ? `<div class="cx-grade">${arqs.map(a => `<div class="cx-item"><button class="cx-arq media" data-arquivo="contrato:${esc(c.id)}|docs|${esc(a.id)}" data-mini="${esc(a.id)}" title="${esc(a.nome)}" aria-label="Abrir ${esc(a.nome)}"><span>${esc(extensao(a.nome))}</span></button><small title="${esc(a.nome)}">${esc(a.nome)}${a.sub ? ' · ' + esc(a.sub) : ''}</small></div>`).join('')}</div>`
    : '<p class="cx-sub">Este contrato não tem arquivos.</p>'; };
  // Ao escolher um contrato na lista, mostra os arquivos dele logo abaixo.
  function mostrarArquivosDoContrato(sel){
    const caixa = sel.id === 'cxContratoSel' ? $('#cxContratoArquivos') : sel.closest('td')?.querySelector('.cx-contrato-arquivos');
    if (!caixa) return;
    const c = (D.contratos || []).find(x => x.id === sel.value);
    // Saldo: se o contrato não cobre a nota, mostra o motivo e trava o botão de vincular (a trava também vale no clique).
    const notaId = sel.id === 'cxContratoSel' ? abertoId : sel.dataset.contratoSel, nota = notas().find(x => x.id === notaId);
    const calc = c ? calcContratos().find(x => x.id === c.id) : null, s = calc && nota ? avaliarSaldo(nota, calc) : null;
    const botaoVincular = sel.id === 'cxContratoSel' ? $('[data-acao=vincular]') : sel.closest('tr')?.querySelector('[data-vincular-contrato]');
    if (botaoVincular){
      if (s && !s.ok){ botaoVincular.disabled = true; botaoVincular.dataset.semSaldo = '1'; }
      else if (botaoVincular.dataset.semSaldo){ botaoVincular.disabled = false; delete botaoVincular.dataset.semSaldo; }
    }
    caixa.innerHTML = c ? `${s && !s.ok ? alertaSaldo(textoSemSaldo(s)) : ''}<p class="cx-sub">Arquivos de ${esc(c.nome)} — clique para abrir ao lado.</p>${gradeArquivosContrato(c)}` : '';
    hidratarMiniaturas();
  }
  document.addEventListener('change', e => { const s = e.target.closest?.('#cxContratoSel, [data-contrato-sel]'); if (s) mostrarArquivosDoContrato(s); });

  // ---- Lista de contratos pesquisável, com o arquivo sempre ao lado (Gustavo, 12/11) ----
  // Digitar filtra pelo nome (sem acento, qualquer parte). Ao passar o mouse ou as setas por uma opção, o primeiro arquivo
  // do contrato abre no visor ao lado, sem tirar o cursor do campo. Enter ou clique escolhe; Esc fecha a lista.
  const listaCombo = document.createElement('div');
  listaCombo.id = 'cxComboLista'; listaCombo.setAttribute('role', 'listbox'); listaCombo.hidden = true;
  document.body.appendChild(listaCombo);   // fora da janela, para não ser cortada pela rolagem da tabela nem da janela
  let combo = null, relogioCombo = null;   // combo = { texto, oculto, itens, ativo }
  const buscaContrato = c => R.normalizar([c.nome, c.unidade, c.referencia, c.cnpj, c.tipologia].join(' '));
  function desenharCombo(){
    const { itens, ativo, nota, calculados } = combo;
    // Cada opção mostra o saldo; em vermelho quando não cobre o valor da nota (vincular fica bloqueado).
    const saldoDe = c => { const calc = calculados.get(c.id); return calc && nota ? avaliarSaldo(nota, calc) : null; };
    listaCombo.innerHTML = itens.length
      ? itens.map((c, i) => { const s = saldoDe(c); return `<div class="cx-combo-op${i === ativo ? ' ativo' : ''}${s && !s.ok ? ' sem-saldo' : ''}" role="option" aria-selected="${i === ativo}" data-i="${i}"><b>${esc(c.nome)}</b><small>${esc(c.unidade || '—')} · ${arquivosContrato(c).length} arq.${s ? ` · saldo ${dinheiro(s.disponivel)}${s.ok ? '' : ' (insuficiente)'}` : ''}</small></div>`; }).join('')
      : '<div class="cx-combo-vazio">Nenhum contrato encontrado.</div>';
    listaCombo.querySelector('.ativo')?.scrollIntoView({ block:'nearest' });
  }
  function abrirArquivoDoContrato(c){
    const arqs = arquivosContrato(c);
    if (arqs.length) abrirArquivo('contrato:' + c.id, 'docs', arqs[0].id, true);
    else if (gaveta?.reqId?.startsWith('contrato:')) fecharGaveta();   // contrato sem arquivo: não deixa o de outro contrato na tela
  }
  function agendarPrevia(){
    clearTimeout(relogioCombo);
    if (!combo || combo.ativo < 0) return;
    relogioCombo = setTimeout(() => { const c = combo?.itens[combo.ativo]; if (c){ abrirArquivoDoContrato(c); setTimeout(posicionarCombo, 120); } }, 220);
  }
  function filtrarCombo(todos){
    const busca = todos ? '' : R.normalizar(combo.texto.value);
    // Acha por nome, unidade, referência ou CNPJ; quem tem o texto no NOME aparece primeiro (a ordem alfabética se mantém dentro de cada grupo).
    const achados = contratosAtivos().filter(c => !busca || buscaContrato(c).includes(busca));
    const noNome = c => busca && R.normalizar(c.nome).includes(busca);
    combo.itens = [...achados.filter(noNome), ...achados.filter(c => !noNome(c))].slice(0, 300);
    combo.ativo = !todos && combo.itens.length ? 0 : -1;   // digitando, o primeiro resultado já mostra o arquivo
    desenharCombo(); agendarPrevia();
  }
  function abrirCombo(texto){
    if (combo?.texto === texto) return;
    const oculto = texto.nextElementSibling, notaId = oculto.id === 'cxContratoSel' ? abertoId : oculto.dataset.contratoSel;
    combo = { texto, oculto, itens:[], ativo:-1, nota:notas().find(x => x.id === notaId), calculados:new Map(calcContratos().map(c => [c.id, c])) };
    filtrarCombo(true);
    posicionarCombo();
    listaCombo.hidden = false; texto.setAttribute('aria-expanded', 'true');
  }
  // A lista fica logo abaixo do campo; reposiciona quando a janela se reorganiza (ex.: o documento abre ao lado).
  function posicionarCombo(){
    if (!combo) return;
    const r = combo.texto.getBoundingClientRect(), largura = Math.max(r.width, 380);
    Object.assign(listaCombo.style, { left:Math.max(8, Math.min(r.left, innerWidth - largura - 8)) + 'px', top:(r.bottom + 2) + 'px', width:largura + 'px', maxHeight:Math.max(160, Math.min(380, innerHeight - r.bottom - 16)) + 'px' });
  }
  window.addEventListener('resize', posicionarCombo);
  function fecharCombo(){
    clearTimeout(relogioCombo);
    if (combo) combo.texto.setAttribute('aria-expanded', 'false');
    listaCombo.hidden = true; combo = null;
  }
  function ativarCombo(i, rolar){
    if (!combo || i === combo.ativo) return;
    combo.ativo = i;
    $$('.cx-combo-op', listaCombo).forEach((el, k) => { el.classList.toggle('ativo', k === i); el.setAttribute('aria-selected', k === i); });
    if (rolar) listaCombo.querySelector('.ativo')?.scrollIntoView({ block:'nearest' });
    agendarPrevia();
  }
  function escolherCombo(i){
    const c = combo?.itens[i]; if (!c) return;
    const { texto, oculto } = combo;
    oculto.value = c.id; texto.value = `${c.nome} · ${c.unidade || '—'}`;
    fecharCombo(); abrirArquivoDoContrato(c);
    oculto.dispatchEvent(new Event('change', { bubbles:true }));   // mostra os arquivos abaixo do campo
  }
  document.addEventListener('focusin', e => { const t = e.target.closest?.('.cx-combo-texto'); if (t && !t.disabled) abrirCombo(t); });
  document.addEventListener('click', e => { const t = e.target.closest?.('.cx-combo-texto'); if (t && !t.disabled) abrirCombo(t); });
  document.addEventListener('focusout', e => { if (e.target.closest?.('.cx-combo-texto')) fecharCombo(); });
  document.addEventListener('input', e => {
    const t = e.target.closest?.('.cx-combo-texto'); if (!t) return;
    const oculto = t.nextElementSibling;
    if (oculto.value){ oculto.value = ''; oculto.dispatchEvent(new Event('change', { bubbles:true })); }   // mudou o texto: a escolha anterior deixa de valer
    if (combo?.texto !== t) abrirCombo(t);
    filtrarCombo(false);
  });
  // Registrado antes dos outros teclados da página: Enter e Esc aqui não pulam de campo nem fecham a janela.
  document.addEventListener('keydown', e => {
    const t = e.target.closest?.('.cx-combo-texto'); if (!t || e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault(); e.stopImmediatePropagation();
      if (combo?.texto !== t) abrirCombo(t);
      if (combo.itens.length) ativarCombo(Math.min(combo.itens.length - 1, Math.max(0, combo.ativo + (e.key === 'ArrowDown' ? 1 : -1))), true);
    } else if (e.key === 'Enter' && combo?.texto === t && combo.ativo >= 0){
      e.preventDefault(); e.stopImmediatePropagation(); escolherCombo(combo.ativo);
    } else if (e.key === 'Escape' && combo){
      e.preventDefault(); e.stopImmediatePropagation(); fecharCombo();
    }
  });
  listaCombo.addEventListener('mousedown', e => { const op = e.target.closest('.cx-combo-op'); e.preventDefault(); if (op) escolherCombo(Number(op.dataset.i)); });   // preventDefault mantém o cursor no campo
  listaCombo.addEventListener('mouseover', e => { const op = e.target.closest('.cx-combo-op'); if (op) ativarCombo(Number(op.dataset.i), false); });
  document.addEventListener('scroll', e => { if (combo && !listaCombo.contains(e.target) && (e.target === document || e.target.contains?.(combo.texto))) fecharCombo(); }, true);
  // Valor total = valor fechado + aditivos; Pago = soma das notas vinculadas (na Monday ou aqui no painel); Saldo = total - pago.
  function calcContratos(){
    const porId = new Map((D.contratos || []).map(c => [c.id, c])), todas = notas(), notaPorId = new Map(todas.map(n => [n.id, n])), doPainel = new Map();
    for (const n of todas) if (n.contratoRef){ if (!doPainel.has(n.contratoRef)) doPainel.set(n.contratoRef, []); doPainel.get(n.contratoRef).push(n.id); }
    return (D.contratos || []).map(c => {
      const ids = [...new Set([...(c.notas || []), ...(doPainel.get(c.id) || [])])];
      const pago = ids.reduce((s, id) => s + Number(notaPorId.get(id)?.valor || 0), 0);
      const aditivo = (c.aditivos || []).reduce((s, id) => s + Number(porId.get(id)?.valorFechado || 0), 0);
      const total = Number(c.valorFechado || 0) + aditivo;
      return { ...c, notasIds: ids, pago, aditivo, total, saldo: total - pago };
    });
  }
  // ---- Saldo do contrato (Gustavo, 12/11): saldo menor que o valor da nota bloqueia o lançamento até corrigir ----
  // Duas travas: (1) ao VINCULAR, o saldo do contrato precisa cobrir a nota; (2) nota já ligada a um contrato cujo saldo ficou negativo
  // não registra pedido no Datasul, não confirma aprovação do pedido e não é enviada para escriturar, até o contrato ou o vínculo ser corrigido.
  const ETAPAS_DE_LANCAMENTO = ['pedido', 'aprovacao', 'escrituracao'];
  let cacheSaldo = null;   // montado uma vez por tela desenhada (desenhar() zera)
  const valorNota = n => Number(n?.valor || 0);
  const centavos = v => Math.round(v * 100);
  function bloqueioSaldo(n){
    if (!n || !ETAPAS_DE_LANCAMENTO.includes(n.etapa)) return null;
    if (!cacheSaldo){ cacheSaldo = new Map(); for (const c of calcContratos()) if (centavos(c.saldo) < 0) for (const id of c.notasIds) cacheSaldo.set(id, c); }
    const c = cacheSaldo.get(n.id);
    return c ? { contrato:c, texto:`Lançamento bloqueado: o saldo do contrato ${c.nome} está negativo (${dinheiro(c.saldo)}). Corrija o contrato (valor fechado ou aditivo) ou o vínculo da nota antes de lançar.` } : null;
  }
  // A nota cabe no contrato? Se ela já está contada no "Pago" (ligada na Monday ou no painel), devolve o valor dela ao saldo antes de comparar.
  function avaliarSaldo(nota, c){
    const disponivel = c.saldo + (c.notasIds.includes(nota.id) ? valorNota(nota) : 0);
    return { contrato:c, disponivel, valor:valorNota(nota), falta:valorNota(nota) - disponivel, ok:centavos(valorNota(nota)) <= centavos(disponivel) };
  }
  const textoSemSaldo = s => `Saldo insuficiente: o contrato ${s.contrato.nome} tem ${dinheiro(s.disponivel)} de saldo e a nota é de ${dinheiro(s.valor)} (faltam ${dinheiro(s.falta)}). Corrija o contrato (valor fechado ou aditivo) ou escolha outro antes de vincular.`;
  const alertaSaldo = texto => `<div class="cx-nota cx-alerta-saldo" role="alert">${esc(texto)}</div>`;
  const avisoBloqueio = n => { const b = bloqueioSaldo(n); return b ? alertaSaldo(b.texto) : ''; };
  const textoContrato = c => R.normalizar([c.nome, c.cnpj, c.referencia, c.unidade, c.tipologia, c.tipo, c.aprovador, c.narrativa].join(' '));
  function telaContratos(lista, dentro){
    const f = filtros.contratos, todos = calcContratos(), tipologiasDe = c => (c.tipologia || '').split(',').map(x => x.trim()).filter(Boolean);
    const visiveis = todos.filter(c => (!f.busca || textoContrato(c).includes(R.normalizar(f.busca))) && (!f.unidade || R.unidadeChave(c.unidade) === R.unidadeChave(f.unidade))
      && (!f.status || c.status === f.status) && (!f.prioridade || c.tipo === f.prioridade) && (!f.natureza || tipologiasDe(c).includes(f.natureza)));
    const aguardando = lista.filter(n => n.etapa === 'contrato');
    const opcoes = (itens, valor) => itens.map(([v, l]) => `<option value="${esc(v)}" ${valor === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const tipologias = [...new Set(todos.flatMap(tipologiasDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const ferramentasC = `<div class="cx-ferramentas"><label class="cx-pesquisa">${icone('busca')}<input class="cx-busca" data-busca aria-label="Buscar contrato" value="${esc(f.busca)}" placeholder="Buscar prestador, CNPJ ou referência…"></label><span class="cx-contagem" aria-live="polite"><b>${visiveis.length}</b> contratos</span></div>`
      + `<div class="cx-filtros"><label>Unidade<select data-cxfilter="unidade">${opcoes([['', 'Todas as unidades'], ...R.opcoesUnidade()], f.unidade)}</select></label>`
      + `<label>Status<select data-cxfilter="status">${opcoes([['', 'Todos'], ['Ativo', 'Ativo'], ['Encerrado', 'Encerrado'], ['Outro', 'Outro']], f.status)}</select></label>`
      + `<label>Contrato<select data-cxfilter="prioridade">${opcoes([['', 'Todos'], ['Contrato Global', 'Contrato Global'], ['Contrato', 'Contrato'], ['Contrato - Faturamento direto', 'Faturamento direto'], ['Aditivo', 'Aditivo']], f.prioridade)}</select></label>`
      + `<label>Tipologia<select data-cxfilter="natureza">${opcoes([['', 'Todas'], ...tipologias.map(t => [t, t])], f.natureza)}</select></label><button class="cx-btn cx-mini" data-limpar-filtros>Limpar filtros</button></div>`;
    const blocoAguardando = aguardando.length ? `<section class="cx-contratos-grupo"><h4>Notas aguardando vínculo de contrato <span>${aguardando.length}</span></h4><div class="cx-quadro-rolagem"><table class="cx-quadro"><thead><tr><th>Nota / fornecedor</th><th>Unidade</th><th>Narrativa</th><th>Valor</th><th>Contrato</th><th></th></tr></thead><tbody>`
      + aguardando.map(n => `<tr data-linha="${esc(n.id)}"><td class="cx-q-nota"><b>NF ${esc(n.nf)}</b><small title="${esc(n.fornecedor)}">${esc(n.fornecedor)}</small></td><td>${unidade(n.unidade)}</td><td><span class="cx-cel-leitura" title="${esc(n.narrativa)}">${esc(n.narrativa || '—')}</span></td><td class="cx-q-valor">${dinheiro(n.valor)}</td>`
        + `<td>${podeEditarAnalise(n) ? `${campoContrato(`data-contrato-sel="${esc(n.id)}"`, `Contrato da NF ${n.nf}`)}<div class="cx-contrato-arquivos"></div>` : '—'}</td>`
        + `<td class="cx-q-acoes">${podeEditarAnalise(n) ? `<button class="cx-btn cx-mini forte" data-vincular-contrato="${esc(n.id)}">Vincular</button>` : ''}${podeDevolver(n) ? `<button class="cx-btn cx-mini" data-devolver-linha="${esc(n.id)}">Devolver ao lançamento</button>` : ''}<button class="cx-btn cx-mini" data-nota="${esc(n.id)}">Abrir</button></td></tr>`).join('')
      + '</tbody></table></div></section>' : '';
    const cabecalho = '<th>Prestador</th><th>Unidade</th><th>Tipologia</th><th>Contrato</th><th>Status</th><th>Valor fechado</th><th>Valor aditivo</th><th>Valor total</th><th>Pago</th><th>Saldo</th><th>Notas</th><th>Arquivos</th><th>Aprovador</th><th>Aceite</th><th>CNPJ</th>';
    const linhaC = c => `<tr><td class="cx-q-nota"><b title="${esc(c.nome)}">${esc(c.nome)}</b><small>${esc(c.referencia || '')}</small></td><td>${unidade(c.unidade)}</td><td>${esc(c.tipologia || '—')}</td><td>${etiqueta(c.tipo || '—')}</td>`
      + `<td>${etiqueta(c.status || '—', c.status === 'Ativo' ? 'verde' : c.status === 'Encerrado' ? 'rosa' : '')}</td><td class="cx-q-valor">${dinheiro(c.valorFechado)}</td><td class="cx-q-valor">${dinheiro(c.aditivo)}</td><td class="cx-q-valor">${dinheiro(c.total)}</td>`
      + `<td class="cx-q-valor">${dinheiro(c.pago)}</td><td class="cx-q-valor ${c.saldo < 0 ? 'cx-negativo' : ''}">${dinheiro(c.saldo)}</td><td><button class="cx-btn cx-mini" data-contrato-notas="${esc(c.id)}" aria-label="Ver as ${c.notasIds.length} notas de ${esc(c.nome)}">${c.notasIds.length}</button></td>`
      + `<td><button class="cx-btn cx-mini" data-contrato-notas="${esc(c.id)}" aria-label="Ver os ${arquivosContrato(c).length} arquivos de ${esc(c.nome)}">${arquivosContrato(c).length}</button></td>`
      + `<td>${esc(c.aprovador || '—')}</td><td>${dataBR(c.aceite)}</td><td>${esc(c.cnpj || '—')}</td></tr>`;
    const grupos = GRUPOS_CONTRATO.map(g => {
      const itens = visiveis.filter(c => grupoContrato(c) === g), fechado = itens.reduce((s, c) => s + c.valorFechado, 0), saldo = itens.reduce((s, c) => s + c.saldo, 0);
      return `<section class="cx-contratos-grupo"><h4>${esc(g)} <span>${itens.length}</span><small>Valor fechado ${dinheiro(fechado)} · Saldo ${dinheiro(saldo)}</small></h4>`
        + (itens.length ? `<div class="cx-quadro-rolagem"><table class="cx-quadro cx-quadro-contratos"><thead><tr>${cabecalho}</tr></thead><tbody>${itens.map(linhaC).join('')}</tbody></table></div>` : '<p class="cx-sub">Nenhum item neste grupo.</p>') + '</section>';
    }).join('');
    return `<div class="cx-mesa">${trilha(dentro)}<section class="cx-fila" aria-label="Contratos"><div class="cx-fila-cabeca"><div><span class="cx-kicker">QUADRO DE CONTRATOS</span><h3>Contratos</h3></div><span class="cx-total-fila">${dinheiro(visiveis.reduce((s, c) => s + c.valorFechado, 0))}<small>valor fechado</small></span></div>${ferramentasC}${blocoAguardando}${grupos}</section></div>`;
  }
  function abrirContratoNotas(id){
    const c = calcContratos().find(x => x.id === id); if (!c) return;
    const porId = new Map(notas().map(n => [n.id, n])), linhas = c.notasIds.map(i => porId.get(i)).filter(Boolean), arqs = arquivosContrato(c);
    abrirDialogo(c.nome, `<div class="cx-fatos"><div><span>Valor total</span>${dinheiro(c.total)}</div><div><span>Pago</span>${dinheiro(c.pago)}</div><div><span>Saldo</span>${dinheiro(c.saldo)}</div><div><span>Status</span>${esc(c.status || '—')}</div></div>`
      + `<h4>Arquivos (${arqs.length})</h4>` + (arqs.length ? `<p class="cx-sub">Os mesmos arquivos do contrato na Monday. Clique para abrir ao lado.</p><div class="cx-grade">${arqs.map(a => `<div class="cx-item"><button class="cx-arq media" data-arquivo="contrato:${esc(c.id)}|docs|${esc(a.id)}" data-mini="${esc(a.id)}" title="${esc(a.nome)}" aria-label="Abrir ${esc(a.nome)}"><span>${esc(extensao(a.nome))}</span></button><small title="${esc(a.nome)}">${esc(a.nome)}${a.sub ? ' · ' + esc(a.sub) : ''}</small></div>`).join('')}</div>` : '<p class="cx-sub">Nenhum arquivo neste contrato.</p>')
      + `<h4>Notas vinculadas (${linhas.length})</h4>` + (linhas.length ? `<table class="cx-tabela"><thead><tr><th>Nota</th><th>Fornecedor</th><th>Valor</th><th>Etapa</th></tr></thead><tbody>${linhas.map(n => `<tr><td>NF ${esc(n.nf)}</td><td>${esc(n.fornecedor)}</td><td>${dinheiro(n.valor)}</td><td>${esc(ETAPAS[n.etapa] || n.etapa)}</td></tr>`).join('')}</tbody></table>` : '<p class="cx-sub">Nenhuma nota vinculada.</p>'));
    hidratarMiniaturas();
  }

  function telaAprovacoes(){
    if (!abasVisiveis().some(([k]) => k === aba)) aba = abasVisiveis()[0][0];
    const lista = notas();
    const dentro = k => k === 'todas' ? lista : k === 'envios' ? lista.filter(n => ['encaminhada','fiscal'].includes(n.etapa)) : k === 'canceladas' ? lista.filter(n => n.etapa === 'cancelada') : lista.filter(n => n.etapa === k);
    if (aba === 'contrato' && D.contratos) return telaContratos(lista, dentro);
    const LIMITE = 300, doFiltro = dentro(aba).filter(n => R.filtrar(n, filtros.aprovacoes, false)), atuais = doFiltro.slice(0, LIMITE);
    return `<header class="cx-editorial"><div class="cx-editorial-texto"><div class="cx-kicker"><span>01 / APROVAÇÕES</span><time>${dataHoje()}</time></div><h2>O próximo passo<br>começa <em>aqui.</em></h2><p>Documentos em ordem. Decisões em movimento.</p><div class="cx-resumo-linear"><span><b>${lista.length}</b> notas no fluxo</span><span><b>${dentro('escrituracao').length}</b> prontas para escriturar</span><span><b>${dentro('envios').length}</b> encaminhadas</span></div></div><aside class="cx-foco"><div class="cx-foco-topo"><span>NA ENGENHARIA</span>${icone('analise')}</div><strong>${String(dentro('engenharia').length).padStart(2,'0')}</strong><p>notas aguardando<br>uma decisão</p><button data-cxaba="engenharia">Ir para a análise ${icone('seta')}</button><div class="cx-foco-orbita" aria-hidden="true"></div></aside></header>
      <div class="cx-mesa">${trilha(dentro)}
      <section class="cx-fila" aria-label="Notas por etapa"><div class="cx-fila-cabeca"><div><h3>${legendaAba()}</h3></div><span class="cx-total-fila">${dinheiro(doFiltro.reduce((s,n) => s + Number(n.valor || 0), 0))}<small>valor nesta etapa</small></span></div>${ferramentas('nota', doFiltro.length)}
      ${atuais.length ? quadroNotas(atuais) : (Object.values(filtros.aprovacoes).some(Boolean) ? '' : vazio('Nenhuma nota nesta fila.'))}
      ${doFiltro.length > LIMITE ? `<p class="cx-sub cx-limite">Mostrando ${LIMITE} de ${doFiltro.length}. Use a busca ou os filtros para encontrar as demais.</p>` : ''}<div class="cx-vazio cx-sem-resultado" ${doFiltro.length || !Object.values(filtros.aprovacoes).some(Boolean) ? 'hidden' : ''}>Nenhuma nota encontrada. Tente outro termo.</div><div class="cx-fila-rodape"><span>DO LANÇAMENTO À ESCRITURAÇÃO</span></div></section></div>`;
  }

  // ---- Quadro de Projetos: réplica do quadro "Portifólio de Projetos" da Monday (18397974281): mesmos grupos, colunas, cores e ordem ----
  const corLegivel = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff'; const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#1b1f27' : '#fff'; };
  const periodoBR = t => { const m = /^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/.exec(t || ''); return m ? `${dataBR(m[1])} – ${dataBR(m[2])}` : (t || '—'); };
  function celulaProjeto(coluna, valor){
    const t = valor?.t || '';
    if (coluna.tipo === 'status') return t ? `<span class="cx-etq" style="background:${esc(coluna.cores?.[t] || '#c4c4c4')};color:${corLegivel(coluna.cores?.[t] || '#c4c4c4')}">${esc(t)}</span>` : '—';
    if (coluna.tipo === 'timeline') return esc(periodoBR(t));
    if (coluna.tipo === 'numbers') { const n = Number(t); return t === '' || isNaN(n) ? '—' : /custo|valor/i.test(coluna.titulo) ? dinheiro(n) : esc(String(n)); }
    return esc(t || '—');
  }
  function telaProjetos(){
    const P = D.projetos;
    if (!P?.quadro) return `<div class="cx-mesa cx-mesa-unica"><section class="cx-fila"><div class="cx-fila-cabeca"><div><span class="cx-kicker">QUADRO DE PROJETOS</span><h3>Projetos</h3></div></div>${vazio('Ainda não há projetos copiados da Monday.')}</section></div>`;
    const f = filtros.projetos, colunas = P.quadro.colunas.filter(c => !['name', 'subtasks'].includes(c.tipo));
    const colUnidade = colunas.find(c => c.titulo === 'Unidade'), colStatus = colunas.find(c => c.tipo === 'status');
    const colPlanejado = colunas.find(c => /custo planejado/i.test(c.titulo)), colRealizado = colunas.find(c => /custo realizado/i.test(c.titulo));
    const textoDe = (i, c) => c ? (i.valores[c.id]?.t || '') : '';
    const soma = (lista, c) => c ? lista.reduce((s, i) => s + (Number(textoDe(i, c)) || 0), 0) : 0;
    const opcoes = (lista, valor) => lista.map(([v, l]) => `<option value="${esc(v)}" ${valor === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const unidadesP = [...new Set(P.itens.map(i => textoDe(i, colUnidade)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const statusP = colStatus ? Object.keys(colStatus.cores || {}) : [];
    const subColunas = P.quadro.subColunas || [];
    const linha = i => `<tr data-texto="${esc(R.normalizar([i.nome, textoDe(i, colUnidade), textoDe(i, colStatus)].join(' ')))}" data-unidade="${esc(textoDe(i, colUnidade))}" data-status="${esc(textoDe(i, colStatus))}">`
      + `<td class="cx-q-nota"><b title="${esc(i.nome)}">${esc(i.nome)}</b>${(i.subitens || []).map(s => `<small>↳ ${esc(s.nome)}${subColunas.filter(c => c.tipo === 'status').map(c => s.valores?.[c.id]?.t ? ' · ' + esc(s.valores[c.id].t) : '').join('')}</small>`).join('')}</td>`
      + colunas.map(c => `<td${c.tipo === 'numbers' ? ' class="cx-q-valor"' : ''}>${celulaProjeto(c, i.valores[c.id])}</td>`).join('') + '</tr>';
    const grupos = P.quadro.grupos.map(g => {
      const itens = P.itens.filter(i => i.grupo_id === g.id).sort((a, b) => a.ordem - b.ordem);
      return `<section class="cx-contratos-grupo"><h4>${esc(g.titulo)} <span>${itens.length}</span>${colPlanejado ? `<small>Custo planejado ${dinheiro(soma(itens, colPlanejado))}${colRealizado ? ` · Realizado ${dinheiro(soma(itens, colRealizado))}` : ''}</small>` : ''}</h4>`
        + (itens.length ? `<div class="cx-quadro-rolagem"><table class="cx-quadro cx-quadro-projetos"><thead><tr><th>Projeto</th>${colunas.map(c => `<th>${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>` : '<p class="cx-sub">Nenhum item neste grupo.</p>') + '</section>';
    }).join('');
    return `<div class="cx-mesa cx-mesa-unica"><section class="cx-fila" aria-label="Quadro de Projetos"><div class="cx-fila-cabeca"><div><span class="cx-kicker">QUADRO DE PROJETOS</span><h3>${esc(P.quadro.nome || 'Portfólio de Projetos')}</h3></div><span class="cx-total-fila">${dinheiro(soma(P.itens, colPlanejado))}<small>custo planejado</small></span></div>`
      + `<div class="cx-ferramentas"><label class="cx-pesquisa">${icone('busca')}<input class="cx-busca" data-busca aria-label="Buscar projeto" value="${esc(f.busca)}" placeholder="Buscar projeto, unidade ou status…"></label><span class="cx-contagem" aria-live="polite"><b data-contagem>${P.itens.length}</b> projetos</span></div>`
      + `<div class="cx-filtros"><label>Unidade<select data-cxfilter="unidade">${opcoes([['', 'Todas as unidades'], ...unidadesP.map(u => [u, u])], f.unidade)}</select></label><label>Status<select data-cxfilter="status">${opcoes([['', 'Todos'], ...statusP.map(s => [s, s])], f.status)}</select></label><button class="cx-btn cx-mini" data-limpar-filtros>Limpar filtros</button></div>`
      + `<p class="cx-sub">Cópia do quadro da Monday, atualizada a cada 5 minutos${P.quadro.espelhadoEm ? ` (última: ${esc(new Date(P.quadro.espelhadoEm).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }))})` : ''}. Visível só para quem tem acesso a Projetos.</p>`
      + `${grupos}<div class="cx-vazio cx-sem-resultado" hidden>Nenhum projeto encontrado. Tente outro termo.</div></section></div>`;
  }
  // Portfólio de Projetos (site do Marcos) dentro do painel. O site tem endereço próprio e não muda por aqui.
  const telaPortfolio = () => `<div class="cx-portfolio"><div class="cx-portfolio-topo"><div><span class="cx-kicker">PORTFÓLIO DE PROJETOS · MONDAY</span><h3>Portfólio de Projetos (Monday)</h3></div><a class="cx-btn cx-mini" href="${esc(PORTFOLIO_URL)}" target="_blank" rel="noopener">Abrir em nova aba</a></div><iframe class="cx-portfolio-quadro" src="${esc(PORTFOLIO_URL)}" title="Portfólio de Projetos (Monday)" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;

  // ---- Portfólio de Projetos no nosso painel (12/11): indicadores ligados aos dados do painel ----
  // Orçamento total = custo planejado dos projetos (aba Projetos).
  // Comprometido = saldo a pagar dos contratos ativos (aba Contratos).
  // Custo realizado = notas lançadas nas unidades que têm projeto. É uma aproximação: ainda não existe vínculo nota ↔ projeto.
  // O histórico antigo do portfólio continua no banco dele e não é alterado por esta tela.
  const codigoDeUnidade = u => { const k = R.unidadeChave(u); if (/^\d{3}$/.test(k)) return k; const n = R.normalizar(u); const f = R.opcoesUnidade().find(([, l]) => { const nome = R.normalizar(String(l).split(' - ').slice(1).join(' - ')); return nome && n.includes(nome); }); return f ? f[0] : null; };
  function telaPortfolioPainel(){
    const P = D.projetos, itens = P?.itens || [], colunas = P?.quadro?.colunas || [];
    if (!P) return `<div class="cx-mesa cx-mesa-unica"><section class="cx-fila">${vazio('Ainda não há projetos copiados da Monday.')}</section></div>`;
    const col = re => colunas.find(c => re.test(c.titulo));
    const cPlan = col(/custo planejado/i), cUn = col(/^unidade$/i);
    const txt = (i, c) => (c && i.valores?.[c.id]?.t) || '';
    const num = (i, c) => Number(txt(i, c)) || 0;
    const orcamento = itens.reduce((s, i) => s + num(i, cPlan), 0);
    const ativos = calcContratos().filter(c => c.grupo !== 'Contratos finalizados' && c.status !== 'Encerrado');
    const comprometido = ativos.reduce((s, c) => s + c.saldo, 0);
    // Por unidade: projetos, orçamento e notas lançadas (realizado).
    const porUnidade = new Map();
    for (const i of itens){ const cod = codigoDeUnidade(txt(i, cUn)); if (!cod) continue; const u = porUnidade.get(cod) || { cod, nome:txt(i, cUn), qtd:0, orc:0 }; u.qtd++; u.orc += num(i, cPlan); porUnidade.set(cod, u); }
    const notasDaUnidade = cod => notas().filter(n => codigoDeUnidade(n.unidade) === cod).reduce((s, n) => s + Number(n.valor || 0), 0);
    const linhas = [...porUnidade.values()].map(u => ({ ...u, real:notasDaUnidade(u.cod) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const realizado = linhas.reduce((s, u) => s + u.real, 0);
    const pct = (r, o) => o ? (r / o * 100).toFixed(1).replace('.', ',') + '%' : '—';
    const colStatus = colunas.find(c => c.tipo === 'status');
    return `<div class="cx-mesa cx-mesa-unica"><section class="cx-fila" aria-label="Portfólio de Projetos no nosso painel">`
      + `<div class="cx-fila-cabeca"><div><span class="cx-kicker">PORTFÓLIO DE PROJETOS · NOSSO PAINEL</span><h3>Portfólio de Projetos (nosso painel)</h3></div></div>`
      + `<div class="cx-kpis">`
      + `<div><span>Orçamento total</span><b>${dinheiro(orcamento)}</b><small>${itens.length} projetos · custo planejado</small></div>`
      + `<div><span>Comprometido</span><b>${dinheiro(comprometido)}</b><small>saldo a pagar de ${ativos.length} contratos ativos</small></div>`
      + `<div><span>Custo realizado</span><b>${dinheiro(realizado)}</b><small>notas lançadas nas unidades dos projetos</small></div>`
      + `<div><span>Realizado / orçamento</span><b>${pct(realizado, orcamento)}</b><small>aproximação até existir o vínculo nota ↔ projeto</small></div>`
      + `</div>`
      + `<p class="cx-sub">Dados do painel (projetos copiados da Monday a cada 5 minutos, contratos e notas ao vivo). O histórico antigo deste portfólio continua guardado no banco dele e não é alterado aqui.</p>`
      + `<h4>Por unidade</h4><div class="cx-quadro-rolagem"><table class="cx-quadro"><thead><tr><th>Unidade</th><th>Projetos</th><th>Orçamento</th><th>Notas lançadas</th><th>Realizado</th></tr></thead><tbody>`
      + (linhas.length ? linhas.map(u => `<tr><td>${unidade(u.nome)}</td><td>${u.qtd}</td><td class="cx-q-valor">${dinheiro(u.orc)}</td><td class="cx-q-valor">${dinheiro(u.real)}</td><td>${pct(u.real, u.orc)}</td></tr>`).join('') : '<tr><td colspan="5">Nenhum projeto com unidade reconhecida.</td></tr>')
      + `</tbody></table></div>`
      + `<h4>Projetos</h4><div class="cx-quadro-rolagem"><table class="cx-quadro"><thead><tr><th>Projeto</th><th>Unidade</th><th>Status</th><th>Custo planejado</th></tr></thead><tbody>`
      + itens.map(i => `<tr><td class="cx-q-nota"><b>${esc(i.nome)}</b></td><td>${esc(txt(i, cUn) || '—')}</td><td>${colStatus ? (() => { const t = txt(i, colStatus); return t ? `<span class="cx-etq" style="background:${esc(colStatus.cores?.[t] || '#c4c4c4')};color:${corLegivel(colStatus.cores?.[t] || '#c4c4c4')}">${esc(t)}</span>` : '—'; })() : '—'}</td><td class="cx-q-valor">${dinheiro(num(i, cPlan))}</td></tr>`).join('')
      + `</tbody></table></div></section></div>`;
  }

  function telaCompras(){
    const visiveis = reqVisiveis();
    const conta = e => visiveis.filter(r => r.etapa === e).length;
    const lista = filtroReq ? visiveis.filter(r => r.etapa === filtroReq) : visiveis;
    const cartoes = ['Aguardando Compras','Em cotação','Aguardando Engenharia','Aprovada'].map((e, i) => `<button class="cx-fase cx-cartao ${filtroReq === e ? 'ativo' : ''}" data-filtro="${e}" aria-pressed="${filtroReq === e}"><span class="cx-fase-topo"><span>0${i+1}</span>${icone(['relogio','compras','analise','check'][i])}</span><span class="cx-fase-corpo"><b>${conta(e)}</b><span>${e}</span></span><span class="cx-fase-linha"></span></button>`).join('');
    const anexo = (r, tipo) => { const l = r.anexos[tipo], resto = l.length - 2; return `<td><div class="cx-anexos">${l.slice(0, 2).map(x => miniatura(r, tipo, x)).join('')}${resto > 0 ? `<button class="cx-mais" data-arquivo="${esc(r.id)}|${tipo}|${esc(l[2].id)}" aria-label="Ver mais ${resto} arquivos">+${resto}</button>` : ''}<button class="cx-btn cx-mini" data-anexar="${esc(r.id)}|${tipo}" title="Anexar" aria-label="Anexar ${ANEXOS[tipo]} em ${esc(r.id)}">+</button></div></td>`; };
    const atributos = r => `data-texto="${esc(R.texto(r))}" data-unidade="${esc(r.unidade)}" data-status="${R.statusCompra(r)}" data-prioridade="${esc(r.prioridade)}"`;
    const corpo = lista.map(r => `<tr ${atributos(r)}><td><b>${esc(r.nome)}</b><small>${esc(r.descricao)}</small><small>${esc(r.id)} ↔ COT-${esc(r.id.replace('REQ-', ''))} · ${esc(r.tipo)}</small></td><td>${diaBR(r.criadaEm)}</td><td>${unidade(r.unidade)}</td><td>${etiqueta(r.prioridade, r.prioridade === 'Urgente' ? 'rosa' : '')}<small>${r.sla} dias · até ${fimSLA(r)}</small></td><td>${dataBR(r.prazoDesejado)}</td><td>${esc(r.solicitante)}</td><td>${esc(r.comprador) || 'A definir'}</td><td>${etiqueta(r.etapa, r.etapa === 'Aprovada' ? 'verde' : '')}</td>${anexo(r, 'rm')}${anexo(r, 'propostas')}${anexo(r, 'certificados')}<td><button class="cx-btn" data-req="${esc(r.id)}">Abrir</button></td></tr>`).join('');
    const fichas = lista.map(r => `<article class="cx-ficha ${r.prioridade === 'Urgente' ? 'urgente' : ''}" ${atributos(r)}><div class="cx-ficha-topo"><span>${esc(r.id)}</span>${etiqueta(r.etapa, r.etapa === 'Aprovada' ? 'verde' : '')}</div><div class="cx-ficha-titulo"><span class="cx-kicker">${unidade(r.unidade)} <span> / </span> ${esc(r.tipo)}</span><h3>${esc(r.nome)}</h3><p class="cx-descricao">${esc(r.descricao)}</p></div><div class="cx-ficha-prazo"><span>${icone('relogio')} SLA atendimento</span>${etiqueta(r.prioridade, r.prioridade === 'Urgente' ? 'rosa' : '')}<b>${r.sla} dias · até ${fimSLA(r)}</b></div><dl class="cx-ficha-dados"><div><dt>Criação da RM</dt><dd>${diaBR(r.criadaEm)}</dd></div><div><dt>Prazo desejado</dt><dd>${dataBR(r.prazoDesejado)}</dd></div></dl><div class="cx-pessoas"><div><span class="cx-avatar">${iniciais(r.solicitante)}</span><span><small>Solicitante</small>${esc(r.solicitante)}</span></div><div><span class="cx-avatar comprador">${iniciais(r.comprador)}</span><span><small>Comprador</small>${esc(r.comprador) || 'A definir'}</span></div></div><div class="cx-ficha-anexos">${[['rm','RM'],['propostas','Propostas'],['certificados','Certificados']].map(([t,l])=>`<section><h4>${l}</h4>${anexo(r,t).replace(/^<td>|<\/td>$/g,'')}</section>`).join('')}</div><div class="cx-ficha-rodape"><span>COT-${esc(r.id.replace('REQ-', ''))}</span><button class="cx-btn cx-abrir" data-req="${esc(r.id)}">Abrir requisição ${icone('seta')}</button></div></article>`).join('');
    return `<header class="cx-editorial cx-editorial-compras"><div class="cx-editorial-texto"><div class="cx-kicker"><span>02 / COMPRAS</span><time>${dataHoje()}</time></div><h2>Da necessidade<br>à <em>realização.</em></h2><p>Requisições e cotações, com cada detalhe à mão.</p></div><div class="cx-compras-convite"><span class="cx-convite-simbolo" aria-hidden="true">↗</span><p>O próximo projeto<br>começa com uma solicitação.</p>${botao('novaReq', icone('mais') + ' Nova requisição', pode('engenharia'))}</div></header>
      <div class="cx-fases" aria-label="Filtrar requisições por etapa">${cartoes}</div>
      <section class="cx-requisicoes" aria-label="Requisições"><div class="cx-colecao-cabeca"><div><span class="cx-kicker">CADERNO DE COMPRAS</span><h3>${filtroReq ? esc(filtroReq) : 'Todas as requisições'} ${filtroReq ? '<button class="cx-link" data-filtro="">Limpar filtro ×</button>' : ''}</h3></div><div class="cx-visoes" aria-label="Apresentação das requisições"><button data-visao="cartoes" aria-pressed="${visaoReq === 'cartoes'}">${icone('grade')} Cartões</button><button data-visao="tabela" aria-pressed="${visaoReq === 'tabela'}">${icone('tabela')} Tabela</button></div></div>${ferramentas('requisição', lista.length)}
      ${lista.length ? visaoReq === 'cartoes' ? `<div class="cx-fichas">${fichas}</div>` : `<div class="cx-rolagem"><table class="cx-tabela larga"><thead><tr><th>Requisição / cotação</th><th>Criação da RM</th><th>Unidade</th><th>SLA atendimento</th><th>Prazo desejado</th><th>Solicitante</th><th>Comprador</th><th>Etapa</th><th>RM</th><th>Propostas</th><th>Certificados</th><th></th></tr></thead><tbody>${corpo}</tbody></table></div>` : vazio('Nenhuma requisição neste indicador.')}
      <div class="cx-vazio cx-sem-resultado" hidden>Nenhuma requisição encontrada. Tente outro termo.</div><div class="cx-fila-rodape"><span>SLA A PARTIR DA CRIAÇÃO DA RM</span><span>10 dias · materiais &nbsp; / &nbsp; 20 dias · serviços &nbsp; / &nbsp; 3 dias · urgentes</span></div></section>`;
  }

  // ---- Anexos: miniaturas pequenas e painel lateral ----
  const ehImagem = a => /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.nome), ehPdf = a => /\.pdf$/i.test(a.nome);
  const extensao = nome => (String(nome).split('.').pop() || 'ARQ').toUpperCase().slice(0, 4);
  const acharAnexo = id => { for (const r of reqVisiveis()) for (const t of Object.keys(r.anexos)) { const a = r.anexos[t].find(x => x.id === id); if (a) return a; } for (const n of D.lancamentos) { const a = (n.arquivos || []).find(x => x.id === id); if (a) return a; } for (const c of D.contratos || []) { const a = arquivosContrato(c).find(x => x.id === id); if (a) return a; } return null; };
  // Arquivos de um contrato = os do contrato + os de cada subitem (aditivos, medições…), na ordem do quadro da Monday.
  const arquivosContrato = c => [...(c.arquivos || []), ...(c.subitens || []).flatMap(s => (s.lista || []).map(a => ({ ...a, sub:s.nome })))];
  // Documentos da nota (vindos do lançamento) ficam em modo leitura: quem confere não apaga a NF original.
  const ROTULO = { ...ANEXOS, docs:'Documentos da nota' };
  const listaDe = (reqId, tipo) => reqId.startsWith('nota:') ? (D.lancamentos.find(n => n.id === reqId.slice(5))?.arquivos || [])
    : reqId.startsWith('contrato:') ? arquivosContrato((D.contratos || []).find(c => c.id === reqId.slice(9)) || {}) : (getReq(reqId)?.anexos[tipo] || []);
  const miniaturaNota = (n, a) => `<button class="cx-arq media" data-arquivo="nota:${esc(n.id)}|docs|${esc(a.id)}" data-mini="${esc(a.id)}" title="${esc(a.nome)}" aria-label="Abrir ${esc(a.nome)}"><span>${esc(extensao(a.nome))}</span></button>`;
  const miniatura = (r, tipo, a, classe = '') => `<button class="cx-arq ${classe}" data-arquivo="${esc(r.id)}|${tipo}|${esc(a.id)}" data-mini="${esc(a.id)}" title="${esc(a.nome)}" aria-label="Abrir ${esc(a.nome)}"><span>${esc(extensao(a.nome))}</span></button>`;

  let leitorPdf = null;
  function carregarLeitorPdf(){
    if (leitorPdf) return leitorPdf;
    const script = src => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
    const base = 'https://unpkg.com/pdfjs-dist@3.11.174/build/';
    leitorPdf = script(base + 'pdf.min.js').then(() => script(base + 'pdf.worker.min.js')).catch(e => { leitorPdf = null; throw e; });
    return leitorPdf;
  }
  async function abrirPdf(blob){
    await carregarLeitorPdf();
    return window.pdfjsLib.getDocument({ data:await blob.arrayBuffer(), isEvalSupported:false }).promise;
  }
  async function desenharPagina(pdf, n, largura){
    const pagina = await pdf.getPage(n), base = pagina.getViewport({ scale:1 }), vista = pagina.getViewport({ scale:largura / base.width });
    const c = document.createElement('canvas'); c.width = vista.width; c.height = vista.height;
    await pagina.render({ canvasContext:c.getContext('2d'), viewport:vista }).promise;
    return c;
  }

  const miniaturas = new Map();
  function miniaturaDe(a){
    if (miniaturas.has(a.id)) return miniaturas.get(a.id);
    const pronta = (async () => {
      const blob = await D.arquivos.ler(a);
      if (!blob) return null;
      if (ehImagem(a)) return URL.createObjectURL(blob);
      if (ehPdf(a)) return (await desenharPagina(await abrirPdf(blob), 1, 120)).toDataURL('image/jpeg', 0.75);
      return null;
    })().catch(() => null);
    miniaturas.set(a.id, pronta);
    return pronta;
  }
  function hidratarMiniaturas(){
    $$('[data-mini]').forEach(async el => {
      const a = acharAnexo(el.dataset.mini); if (!a) return;
      const url = await miniaturaDe(a);
      if (!el.isConnected) return;
      if (!url){ el.dataset.semMini = '1'; return; }
      if (!el.querySelector('img')){ const i = new Image(); i.alt = ''; i.src = url; el.appendChild(i); }
    });
  }

  async function guardarAnexos(r, tipo, arquivos){
    if (D.compras){ for (const f of arquivos) await D.compras.anexar(r.uuid, tipo, f); return; }
    for (const f of arquivos){
      const id = 'arq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      await D.arquivos.guardar(id, f);
      r.anexos[tipo].push({ id, nome:f.name, por:pessoa.nome, em:new Date().toISOString() });
      r.historico.push(assinar(`Anexou em ${ANEXOS[tipo]}: ${f.name}`));
    }
    D.salvar();
  }
  async function anexar(id, tipo, arquivos){
    const r = getReq(id); if (!r || !arquivos.length) return;
    try { await guardarAnexos(r, tipo, arquivos); } catch (e) { return aviso('Não foi possível guardar o arquivo nesta demonstração.'); }
    desenhar();
    if (abertoTipo === 'req' && abertoId === id) abrirReq(id);
    aviso(`${arquivos.length} arquivo(s) anexado(s) em ${ANEXOS[tipo]}.`);
  }

  // O painel lateral não cobre a tela inteira: a lista continua visível ao lado.
  let gaveta = null, vezVisor = 0, urlVisor = null, zoomGav = 1;   // zoomGav: 1 = largura do painel; os botões − e + mudam
  function limparVisor(){ if (urlVisor){ URL.revokeObjectURL(urlVisor); urlVisor = null; } }
  function abrirArquivo(reqId, tipo, id, semFoco){
    const lista = listaDe(reqId, tipo), i = lista.findIndex(x => x.id === id);
    if (i < 0) return fecharGaveta();
    const a = lista[i], g = $('#cxGaveta');
    if (!gaveta) gaveta = { foco:document.activeElement };
    Object.assign(gaveta, { reqId, tipo, id, blob:null });
    limparVisor();
    const vez = ++vezVisor;
    g.innerHTML = `<header class="cx-gav-topo"><div><b title="${esc(a.nome)}">${esc(a.nome)}</b><small>${reqId.startsWith('contrato:') ? 'Arquivos do contrato' + (a.sub ? ' · ' + esc(a.sub) : '') : ROTULO[tipo]} · ${a.monday || a.por === 'Monday' ? 'da Monday' : a.exemplo && tipo === 'docs' ? 'do lançamento' : `anexado por ${esc(a.por)}`} em ${diaBR(a.em)}</small></div><button class="cx-btn" data-gav="fechar" aria-label="Fechar">✕</button></header>
      <div class="cx-gav-acoes"><button class="cx-btn cx-mini" data-gav="anterior" ${i ? '' : 'disabled'} aria-label="Arquivo anterior">‹</button><span class="cx-sub">${i + 1} de ${lista.length}</span><button class="cx-btn cx-mini" data-gav="proximo" ${i < lista.length - 1 ? '' : 'disabled'} aria-label="Próximo arquivo">›</button><span class="cx-zoom"><button class="cx-btn cx-mini" data-gav="zmenos" aria-label="Diminuir zoom">−</button><button class="cx-btn cx-mini" data-gav="zajustar" aria-label="Ajustar à largura">Ajustar</button><button class="cx-btn cx-mini" data-gav="zmais" aria-label="Aumentar zoom">+</button></span><span style="flex:1"></span><span id="cxGavBotoes"><button class="cx-btn cx-mini" data-gav="baixar">Baixar</button>${tipo === 'docs' ? '' : ' <button class="cx-btn cx-mini" data-gav="remover">Remover</button>'}</span></div>
      <div id="cxVisor" class="cx-visor"><p class="cx-sub">Carregando…</p></div>`;
    g.hidden = false;
    document.body.classList.add('cx-gaveta-aberta');
    if (!semFoco) $('[data-gav=fechar]', g).focus();
    mostrarArquivo(a, vez);
  }
  // Ao ampliar, o ponto que você estava vendo continua no lugar (posição guardada em proporção).
  const lerRolagem = () => { const v = $('#cxVisor'); return v ? { x:v.scrollLeft / Math.max(1, v.scrollWidth), y:v.scrollTop / Math.max(1, v.scrollHeight) } : null; };
  const porRolagem = r => { const v = $('#cxVisor'); if (v && r){ v.scrollLeft = r.x * v.scrollWidth; v.scrollTop = r.y * v.scrollHeight; } };
  async function mostrarArquivo(a, vez, manter){
    const visor = () => vez === vezVisor ? $('#cxVisor') : null;
    const semPrevia = texto => { if (visor()) visor().innerHTML = `<div class="cx-vazio">${esc(texto)} Use <b>Baixar</b> para abrir o arquivo.</div>`; };
    try {
      const blob = await D.arquivos.ler(a);
      if (!visor()) return;
      if (!blob){ visor().innerHTML = '<div class="cx-vazio">Arquivo não encontrado nesta demonstração.</div>'; return; }
      gaveta.blob = blob;
      // O CSS limitava o PDF à largura do painel, por isso ampliar não aparecia: aqui a largura vem do zoom e o painel rola.
      if (ehImagem(a)){ urlVisor = URL.createObjectURL(blob); visor().innerHTML = ''; const i = new Image(); i.alt = a.nome; i.src = urlVisor; i.draggable = false; i.style.cssText = `width:${zoomGav * 100}%;max-width:none`; i.onload = () => porRolagem(manter); visor().appendChild(i); return; }
      if (!ehPdf(a)) return semPrevia('Este tipo de arquivo não tem prévia.');
      const pdf = await abrirPdf(blob), largura = Math.min(3600, Math.max(300, ((visor()?.clientWidth || 600) - 48) * (window.devicePixelRatio || 1) * zoomGav));
      if (!visor()) return;
      // Ao reampliar, as páginas são montadas à parte e trocadas de uma vez, para a tela não piscar nem voltar ao topo.
      const destino = manter ? document.createDocumentFragment() : (visor().innerHTML = '', visor());
      for (let n = 1; n <= Math.min(pdf.numPages, 30); n++){
        const c = await desenharPagina(pdf, n, largura);
        if (!visor()) return;
        c.style.cssText = `width:${zoomGav * 100}%;max-width:none;height:auto;display:block;margin:0 auto 12px`;
        destino.appendChild(c);
      }
      if (manter){ visor().replaceChildren(destino); porRolagem(manter); }
      if (pdf.numPages > 30) visor().insertAdjacentHTML('beforeend', '<p class="cx-sub">Mostrando as 30 primeiras páginas.</p>');
    } catch (e) { semPrevia('Não foi possível mostrar este arquivo.'); }
  }
  function fecharGaveta(){
    if (!gaveta) return;
    vezVisor++; limparVisor(); zoomGav = 1;
    const foco = gaveta.foco; gaveta = null;
    const g = $('#cxGaveta'); g.hidden = true; g.innerHTML = '';
    document.body.classList.remove('cx-gaveta-aberta');
    if (foco?.isConnected) foco.focus();
  }
  async function removerArquivo(){
    if (D.compras){
      const { reqId, tipo, id } = gaveta;
      try { await D.compras.removerAnexo(id); } catch (e) { return aviso(e.message); }
      miniaturas.delete(id); desenhar(); if (abertoTipo === 'req' && abertoId === reqId) abrirReq(reqId);
      aviso('Arquivo removido.'); const resta = listaDe(reqId, tipo); return resta[0] ? abrirArquivo(reqId, tipo, resta[0].id) : fecharGaveta();
    }
    const { reqId, tipo, id } = gaveta, r = getReq(reqId); if (!r) return;
    const lista = r.anexos[tipo];
    const i = lista.findIndex(x => x.id === id), [a] = lista.splice(i, 1);
    r.historico.push(assinar(`Removeu de ${ANEXOS[tipo]}: ${a.nome}`)); D.salvar();
    miniaturas.delete(id);
    if (!a.exemplo) await D.arquivos.apagar(id).catch(() => {});
    desenhar();
    if (abertoTipo === 'req' && abertoId === reqId) abrirReq(reqId);
    aviso('Arquivo removido.');
    const seguinte = lista[i] || lista[i - 1];
    if (seguinte) abrirArquivo(reqId, tipo, seguinte.id); else fecharGaveta();
  }
  function acaoGaveta(acao){
    if (!gaveta) return;
    const lista = listaDe(gaveta.reqId, gaveta.tipo), i = lista.findIndex(x => x.id === gaveta.id), botoes = $('#cxGavBotoes');
    if (acao === 'fechar') fecharGaveta();
    else if (['zmais', 'zmenos', 'zajustar'].includes(acao)){
      zoomGav = acao === 'zajustar' ? 1 : Math.min(3, Math.max(0.6, zoomGav * (acao === 'zmais' ? 1.25 : 0.8)));
      mostrarArquivo(lista[i], ++vezVisor, lerRolagem());
    }
    else if (acao === 'anterior' && lista[i - 1]) abrirArquivo(gaveta.reqId, gaveta.tipo, lista[i - 1].id);
    else if (acao === 'proximo' && lista[i + 1]) abrirArquivo(gaveta.reqId, gaveta.tipo, lista[i + 1].id);
    else if (acao === 'baixar'){
      if (!gaveta.blob) return aviso('O arquivo ainda está carregando.');
      const url = URL.createObjectURL(gaveta.blob), l = document.createElement('a');
      l.href = url; l.download = lista[i].nome; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (acao === 'remover' && gaveta.tipo !== 'docs'){
      botoes.innerHTML = '<span class="cx-sub">Remover este arquivo?</span> <button class="cx-btn cx-mini cx-perigo" data-gav="confirmar">Sim, remover</button> <button class="cx-btn cx-mini" data-gav="cancelar">Cancelar</button>';
      $('[data-gav=cancelar]', botoes).focus();
    } else if (acao === 'cancelar'){
      botoes.innerHTML = '<button class="cx-btn cx-mini" data-gav="baixar">Baixar</button> <button class="cx-btn cx-mini" data-gav="remover">Remover</button>';
      $('[data-gav=remover]', botoes).focus();
    } else if (acao === 'confirmar') removerArquivo();
  }

  // Só a Helena recebe. Sai da caixa da escrituração, com o nome de quem agiu no texto e
  // a resposta indo para essa pessoa.
  function avisarHelena(r, tipo, motivo){
    const quem = pessoa.nome;
    const texto = {
      abertura:[`RM aberta: ${r.id}`, `${quem} abriu a RM ${r.id} - ${r.nome}.`],
      aprovacao:[`RM aprovada: ${r.id}`, `${quem} aprovou a RM ${r.id} - ${r.nome}.`],
      recusa:[`RM recusada: ${r.id}`, `${quem} recusou a RM ${r.id} - ${r.nome}. Motivo: ${motivo}`],
      ajuste:[`Ajuste solicitado na RM ${r.id}`, `${quem} pediu ajuste na RM ${r.id} - ${r.nome}. Motivo: ${motivo}`],
    }[tipo];
    r.emails.push({ assunto:texto[0], corpo:texto[1], responderPara:pessoa.email, quando:new Date().toISOString() });
    r.historico.push(assinar('E-mail simulado para Helena: ' + texto[0]));
  }

  function abrirDialogo(titulo, corpo){
    const m = $('#cxModal');
    if (m.hidden) abrirDialogo.foco = document.activeElement;
    m.innerHTML = `<section class="cx-dialogo" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><button class="cx-btn cx-fechar" data-acao="fechar" aria-label="Fechar">✕</button><div class="cx-dialogo-kicker">${area === 'compras' ? 'CADERNO DE COMPRAS' : 'MESA DE ANÁLISE'} <span> / EXPANSÃO</span></div><h3>${esc(titulo)}</h3>${corpo}</section>`;
    m.hidden = false;
    document.body.classList.add('cx-dialogo-aberto');
    $('.cx-fechar', m).focus();
  }
  function fechar(){
    if(ocupado)return;
    if(reservaAtual){reservas?.liberar('nota:'+reservaAtual.id).then(atualizarReservas).catch(()=>{});reservaAtual=null;}
    fecharGaveta();
    const m = $('#cxModal'); m.hidden = true; m.innerHTML = ''; abertoId = abertoTipo = null;
    document.body.classList.remove('cx-dialogo-aberto');
    if (abrirDialogo.foco?.isConnected) abrirDialogo.foco.focus();
  }

  function acaoDaNota(n){
    const eng = pode('engenharia') ? '' : 'disabled', envioFiscal = /pinhal/i.test(n.unidade) || n.natureza === 'Remessa';
    switch (n.etapa){
      case 'engenharia': return `<h4>Análise da engenharia</h4><p class="cx-sub">Confira a nota e preencha os três campos.</p>${bloqueio('engenharia')}
        <label class="cx-campo">Narrativa<textarea id="cxNarrativa" ${eng} placeholder="Descreva a finalidade desta nota">${esc(n.narrativa)}</textarea></label>
        <div class="cx-duas"><label class="cx-campo">É contrato?<select id="cxContrato" ${eng}><option value="">Selecione</option><option>Sim</option><option>Não</option></select></label><label class="cx-campo">Pertence à expansão?<select id="cxExpansao" ${eng}><option value="">Selecione</option><option>Sim</option><option>Não</option></select></label></div>
        ${D.modoValidacao ? '' : '<label class="cx-campo">Motivo da devolução (se necessário)<input id="cxMotivo" ' + eng + ' placeholder="Descreva o ajuste necessário"></label>'}
        <div class="cx-acoes">${botao('aprovarNota', 'Aprovar análise', pode('engenharia'))}${botao('salvarAnalise', 'Salvar preenchimento', pode('engenharia'), false)}${D.modoValidacao ? '' : botao('devolverNota', 'Devolver ao lançamento', pode('engenharia'), false)}</div>`;
      case 'contrato': return D.contratos ? `<h4>Vincular a um contrato</h4><p class="cx-sub">Escolha o contrato do quadro Contratos. A nota segue para A lançar no Datasul.</p>${bloqueio('engenharia')}<label class="cx-campo">Contrato${campoContrato('id="cxContratoSel"', 'Contrato', eng)}</label><div id="cxContratoArquivos" class="cx-contrato-arquivos"></div>${botao('vincular', 'Vincular e liberar para pedido', pode('engenharia'))}${blocoDevolver(n)}` : `<h4>Vínculo de contrato pendente</h4><p class="cx-sub">Quem faz este vínculo ainda precisa ser confirmado.</p>${bloqueio('equipe')}<label class="cx-campo">Referência do contrato<input id="cxRefContrato" placeholder="CT-EX-001"></label>${botao('vincular', 'Vincular e liberar para pedido', pode('equipe'))}`;
      case 'fora': return '<h4>Fora da expansão</h4><p>Nota separada do fluxo comum, com parecer e histórico preservados.</p><div class="cx-nota">Falta definir quem recebe esta nota e como registra o encaminhamento.</div>';
      case 'pedido': return `<h4>Pedido no Datasul</h4><p class="cx-sub">Depois de lançar manualmente no Datasul, registre o número aqui.</p>${bloqueio('equipe')}${avisoBloqueio(n)}<label class="cx-campo">Número do pedido<input id="cxPedido" value="${esc(n.pedido)}" placeholder="Ex.: 131820"></label>${botao('registrar', 'Registrar pedido lançado', pode('equipe') && !bloqueioSaldo(n))}`;
      case 'aprovacao': return `<h4>Aprovação do pedido</h4><p>Pedido <b>${esc(n.pedido)}</b></p><p class="cx-sub">Confira o resultado no Datasul antes de confirmar.</p>${bloqueio('equipe')}${avisoBloqueio(n)}${botao('pedidoOk', 'Confirmar pedido aprovado', pode('equipe') && !bloqueioSaldo(n))}`;
      case 'escrituracao': return `<h4>Prévia para escriturar</h4><p>${etiqueta(envioFiscal ? 'Destino: e-mail ao fiscal' : 'Destino: Power Automate / SharePoint', 'verde')}</p>${bloqueio('equipe')}<label class="cx-campo">Código do emitente Datasul<input id="cxEmitente" value="${esc(n.emitente || '100200')}"></label><div class="cx-nota">Simulação: nenhum e-mail ou arquivo sai daqui. A versão real precisa manter as validações que o botão Enviar tem hoje.</div><div class="cx-acoes">${botao('escriturar', 'Simular envio para escrituração', pode('equipe'))}</div>`;
      default: return `<h4>${n.etapa === 'fiscal' ? 'E-mail ao fiscal simulado' : 'Encaminhamento simulado'}</h4><div class="cx-nota">Nada foi enviado. Encaminhar não significa escriturar: a confirmação depende do retorno da integração.</div>`;
    }
  }

  const engenheiros = () => D.PESSOAS.filter(p => p.perfil === 'engenharia').map(p => p.nome);
  // "Marcos" veio do exemplo do Gustavo. A lista de quem tem cartão ainda precisa ser confirmada.
  const titularesCartao = () => [...engenheiros(), 'Marcos'];
  // Gustavo e Marcos (administração) também veem e preenchem o vínculo.
  const VINCULO_ATIVO = false;   // desligado a pedido do Gustavo; volta depois do básico
  const podeVerVinculo = () => VINCULO_ATIVO && ['engenharia','admin'].includes(pessoa.perfil);
  function blocoValidacao(n){
    const m = n.monday || {};
    return `<h4>Andamento na Monday</h4><p class="cx-sub">Andamento atualizado a cada 2 minutos. Pedido, aprovação do pedido e escrituração continuam sendo feitos na Monday. A análise da engenharia é preenchida aqui no painel e ainda não vai para a Monday.</p><div class="cx-fatos"><div><span>Quadro / grupo</span>${esc(m.board_nome || '—')} · ${esc(m.grupo_nome || '—')}</div><div><span>Status na Monday</span>${esc(m.status || '—')}</div><div><span>Pedido</span>${esc(n.pedido || '—')}</div><div><span>Data de envio</span>${dataBR(m.data_envio)}</div><div><span>É contrato?</span>${esc(n.contrato || '—')}</div><div><span>Pertence à expansão?</span>${esc(n.expansao || '—')}</div></div>${m.atualizado ? `<p class="cx-sub">Última alteração na Monday: ${esc(new Date(m.atualizado).toLocaleString('pt-BR'))}.</p>` : ''}${n.etapa === 'escrituracao' && ['equipe','admin'].includes(pessoa.perfil) ? blocoDiretor(n) : ''}${podeEscriturar(n) ? `<div class="cx-bloco-eng"><h4>Enviar para escriturar</h4>${avisoBloqueio(n)}<p class="cx-sub">Mesmo envio do botão Enviar da Monday. Destino: ${/pinhal/i.test(n.unidade) || n.natureza === 'Remessa' ? 'e-mail ao fiscal da unidade' : 'fluxo do SharePoint'}. A nota também é marcada como enviada na Monday.</p><div class="cx-acoes" id="cxEscriturarAcoes">${botao('escriturarMonday', 'Enviar para escriturar', !bloqueioSaldo(n))}</div></div>` : ''}`;
  }
  const podeEscriturar = n => n.etapa === 'escrituracao' && !!D.escriturar && ['equipe','admin'].includes(pessoa.perfil);
  // Aprovação Diretor: print do e-mail de liberação do Diretor. Só do dia 1 ao 10 e para nota com vencimento já passado (regra do Gustavo).
  const motivoDiretor = n => { if (new Date().getDate() > 10) return 'Disponível só do dia 1 ao 10 do mês.'; if (!n.vencimento) return 'Nota sem vencimento cadastrado.'; const v = new Date(String(n.vencimento).slice(0, 10) + 'T00:00:00'), hoje = new Date(); hoje.setHours(0, 0, 0, 0); return v < hoje ? '' : `Esta nota vence em ${dataBR(n.vencimento)}, ainda não vencida.`; };
  const podeDiretor = n => !motivoDiretor(n);
  const blocoDiretor = n => { const lista = D.fluxo[n.id]?.diretor || [], ok = podeDiretor(n), motivo = motivoDiretor(n); return `<div class="cx-bloco-eng"><h4>Aprovação Diretor</h4><p class="cx-sub">Print do e-mail de liberação do Diretor. Disponível do dia 1 ao 10 do mês, para nota com vencimento já passado.${ok ? '' : ' ' + esc(motivo)}</p>${lista.map(x => `<p class="cx-sub">${esc(x.nome)} · ${esc(x.por)} · ${dataBR(x.em)}</p>`).join('')}<div class="cx-acoes"><button class="cx-btn" data-acao="aprovacaoDiretor" ${ok ? '' : 'disabled'}>Aprovação Diretor</button></div></div>`; };
  // Guarda o print na nota. Ainda NÃO vai ao SharePoint: o envio lê só os arquivos do item da Monday (ver pendência).
  function anexarDiretor(id, arquivo){
    const n = notas().find(x => x.id === id);
    if (!arquivo || !n) return;
    if (!podeDiretor(n)) return aviso('Aprovação Diretor só do dia 1 ao 10, para nota com vencimento já passado.');
    if (!/^image\//.test(arquivo.type)) return aviso('Envie um print (imagem).');
    const aid = 'rub-' + Date.now();
    D.arquivos.guardar(aid, arquivo).then(async () => {
      const f = D.fluxo[id]; f.diretor = [...(f.diretor || []), { id: aid, nome: arquivo.name, por: pessoa.nome, em: new Date().toISOString() }];
      f.historico.push(assinar('Aprovação Diretor anexada: ' + arquivo.name)); D.salvar(); desenhar(); abrirNota(id);
      aviso('Aprovação Diretor guardada na nota.');
    }).catch(() => aviso('Anexo do Diretor ainda não está ligado ao banco nesta versão.'));
  }
  async function acaoValidacao(acao){
    const caixa = $('#cxEscriturarAcoes'), id = abertoId;
    if (acao === 'salvarVinculo') return salvarVinculoValidacao();
    if (acao === 'aprovacaoDiretor'){
      const seletor = document.createElement('input'); seletor.type = 'file'; seletor.accept = 'image/*';
      seletor.onchange = () => anexarDiretor(id, seletor.files[0]);
      return seletor.click();
    }
    if (['escriturarMonday', 'confirmarEscrituracao'].includes(acao) && bloqueadaPorSaldo(id)) return;   // saldo do contrato negativo: não envia
    if (acao === 'escriturarMonday' && caixa){
      caixa.innerHTML = '<span class="cx-sub">Confirmar o envio desta nota para escriturar?</span> ' + botao('confirmarEscrituracao', 'Sim, enviar') + ' ' + botao('cancelarEscrituracao', 'Cancelar', true, false);
      return $('[data-acao=cancelarEscrituracao]').focus();
    }
    if (acao === 'cancelarEscrituracao' && caixa){ caixa.innerHTML = botao('escriturarMonday', 'Enviar para escriturar'); return; }
    if (acao === 'confirmarEscrituracao' && caixa){
      const b = $('[data-acao=confirmarEscrituracao]'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await D.escriturar(id);
        D.fluxo[id].historico.push(assinar('Envio para escriturar pedido pelo painel'));
        caixa.innerHTML = '<span class="cx-sub">Envio pedido. A nota passa para Encaminhadas quando a Monday registrar o envio.</span>';
        return aviso(r.mensagem || 'Envio pedido.');
      } catch (e) { caixa.innerHTML = botao('escriturarMonday', 'Enviar para escriturar'); return aviso(e.message); }
    }
    if (D.analise && acao === 'registrar') return registrarPedido(id, $('#cxPedido').value.trim());
    if (D.analise && acao === 'pedidoOk') return confirmarPedido(id);
    if (D.analise && acao === 'vincular') return vincularContrato(id, $('#cxContratoSel').value);
    if (D.analise && ['salvarAnalise','aprovarNota','corrigirAnalise'].includes(acao)){
      try {
        if (acao === 'corrigirAnalise'){
          const narrativa = $('#cxCorrNarrativa').value.trim(), contrato = $('#cxCorrContrato').value;
          if (!narrativa || !contrato) return aviso('Preencha Narrativa e Contrato.');
          await fila; await gravarCampos(id, { narrativa, contrato }); desenhar(); abrirNota(id); return aviso('Correção salva.');
        }
        const campos = { narrativa:$('#cxNarrativa').value.trim(), contrato:$('#cxContrato').value, expansao:$('#cxExpansao').value };
        if (acao === 'aprovarNota' && (!campos.narrativa || !campos.contrato || !campos.expansao)) return aviso('Preencha Narrativa, Contrato e Pertence à expansão para aprovar.');
        await fila; await gravarCampos(id, campos);
        if (acao === 'aprovarNota') return aprovarAnalise(id);
        desenhar(); abrirNota(id); return aviso('Preenchimento salvo.');
      } catch (e) { return aviso(e.message); }
    }
    return aviso('Durante a validação, as decisões continuam na Monday.');
  }
  async function salvarVinculoValidacao(){
    const id = abertoId, n = notas().find(x => x.id === id), notaDe = $('#cxNotaDe').value, cartaoDe = $('#cxCartaoDe').value;
    if (!podeVerVinculo()) return aviso('Vínculo disponível só para a engenharia.');
    if (!R.podeEditarVinculo(n)) return aviso('Nota já enviada à escrituração.');
    if (!notaDe && !cartaoDe) return aviso('Escolha de quem é a nota ou em qual cartão foi paga.');
    try { D.fluxo[id].vinculo = await D.salvarVinculo(id, { notaDe, cartaoDe }); desenhar(); abrirNota(id); aviso('Vínculo salvo.'); }
    catch (e) { aviso(e.message); }
  }
  function blocoCorrecao(n){
    if (!R.podeCorrigirAnalise(pessoa, n)) return '';
    return `<div class="cx-bloco-eng"><h4>Corrigir análise</h4><p class="cx-sub">Permitido até antes de escriturar. A correção fica no histórico.</p><label class="cx-campo">Narrativa<textarea id="cxCorrNarrativa">${esc(n.narrativa)}</textarea></label><label class="cx-campo">É contrato?<select id="cxCorrContrato"><option value="">Selecione</option><option>Sim</option><option>Não</option></select></label>${botao('corrigirAnalise', 'Salvar correção', true, false)}</div>`;
  }
  // Na homologação a análise da engenharia (3 campos) é preenchida no painel; o resto segue a Monday.
  const blocoAnaliseValidacao = n => {
    if (!D.analise) return blocoValidacao(n);
    let b = '';
    if (n.etapa === 'engenharia' && podeEditarAnalise(n)) b = acaoDaNota(n);
    else if (['pedido','aprovacao'].includes(n.etapa) && podeAgirPedido()) b = acaoDaNota(n) + (podeEditarAnalise(n) ? blocoCorrecao(n) : '');
    else if (n.etapa === 'contrato' && podeEditarAnalise(n)) b = acaoDaNota(n) + blocoCorrecao(n);
    else if (podeEditarAnalise(n)) b = blocoCorrecao(n);
    return b + blocoValidacao(n);
  };
  function blocoVinculo(n){
    if (!podeVerVinculo()) return '';
    const editavel = R.podeEditarVinculo(n), v = n.vinculo || {}, opcoes = lista => '<option value="">—</option>' + lista.map(x => `<option>${esc(x)}</option>`).join('');
    return `<div class="cx-bloco-eng"><h4>Vínculo entre engenheiros</h4><p class="cx-sub">Visível só para a engenharia.${v.por ? ` Atualizado por ${esc(v.por)} em ${diaBR(v.em)}.` : ''}</p><div class="cx-duas"><label class="cx-campo">Nota de<select id="cxNotaDe" ${editavel ? '' : 'disabled'}>${opcoes(engenheiros())}</select></label><label class="cx-campo">No cartão de<select id="cxCartaoDe" ${editavel ? '' : 'disabled'}>${opcoes(titularesCartao())}</select></label></div>${editavel ? botao('salvarVinculo', 'Salvar vínculo', true, false) : '<p class="cx-sub">Nota já enviada à escrituração: vínculo só para consulta.</p>'}</div>`;
  }

  function abrirNota(id){
    const n = notas().find(x => x.id === id);
    if (!n){ fechar(); aviso('Esta nota saiu da sua fila.'); return; }
    abertoId = id; abertoTipo = 'nota';
    abrirDialogo(`NF ${n.nf} · ${n.fornecedor}`, `<div class="cx-duas"><section class="cx-caixa">${etiqueta(ETAPAS[n.etapa])}<div class="cx-fatos"><div><span>Unidade</span>${esc(R.nomeUnidade(n.unidade))}</div><div><span>Valor</span>${dinheiro(n.valor)}</div><div><span>Natureza</span>${esc(n.natureza)}</div><div><span>Vencimento</span>${dataBR(n.vencimento)}</div><div><span>Pagamento</span>${esc(n.pagamento)}</div><div><span>CNPJ</span>${esc(n.cnpj_fornecedor)}</div></div><p class="cx-sub">Documentos da nota (do lançamento e da Monday). Clique para abrir ao lado.</p><div class="cx-grade">${(n.arquivos || []).map(x => `<div class="cx-item">${miniaturaNota(n, x)}<small title="${esc(x.nome)}">${esc(x.nome)}</small></div>`).join('') || '<span class="cx-sub">Sem documentos</span>'}</div>${n.narrativa ? `<p><b>Narrativa</b><br>${esc(n.narrativa)}</p>` : ''}${historico(n.historico)}</section><section class="cx-caixa">${D.modoValidacao ? blocoAnaliseValidacao(n) : acaoDaNota(n) + blocoCorrecao(n)}${blocoVinculo(n)}</section></div>`);
    if ($('#cxContrato')) $('#cxContrato').value = n.contrato || '';
    if ($('#cxExpansao')) $('#cxExpansao').value = n.expansao || '';
    if ($('#cxCorrContrato')) $('#cxCorrContrato').value = n.contrato || '';
    if ($('#cxNotaDe')) $('#cxNotaDe').value = n.vinculo?.notaDe || '';
    if ($('#cxCartaoDe')) $('#cxCartaoDe').value = n.vinculo?.cartaoDe || '';
    if (!D.modoValidacao) $('.cx-dialogo h3').insertAdjacentHTML('afterend','<div id="cxReservaAtual" class="cx-reserva-banner" role="status">Reservando a nota…</div>');
    reservarNota(id);
    hidratarMiniaturas();
    // Assim que a nota abre, a NF já aparece ampliada ao lado dos campos (Gustavo, 11/11). O foco fica nos campos.
    const primeiro = (n.arquivos || [])[0];
    if (primeiro) abrirArquivo('nota:' + id, 'docs', primeiro.id, true);
  }

  async function moverNota(id, etapa, texto, mudanca){
    if(!await alterarNota(id,({fluxo:f})=>{Object.assign(f,mudanca,{etapa});f.historico.push(assinar(texto));}))return;
    desenhar(); abrirNota(id); aviso(texto);
  }

  async function devolverNota(id){
    const motivo = $('#cxMotivo').value.trim();
    if (!motivo) return aviso('Informe o motivo da devolução.');
    if(!await alterarNota(id,({nota,fluxo:f})=>{f.etapa='engenharia';f.historico.push(assinar('Devolvida ao lançamento: '+motivo));Object.assign(nota,{status:'Pendente',requer_revisao:true,enviado_por_email:null});}))return;
    await D.cliente.from('lancamentos').update({ status:'Pendente', requer_revisao:true, enviado_por_email:null }).eq('id', id);
    fechar(); desenhar(); aviso('Nota devolvida: ela saiu daqui e voltou para a fila do lançamento.');
  }

  function acoesDaNota(acao){
    if (acao === 'devolverContrato') return devolverParaLancamento(abertoId, $('#cxMotivoDevolucao')?.value);
    if (D.modoValidacao) return acaoValidacao(acao);
    if(ocupado || !reservas?.validar('nota:'+abertoId))return aviso('A nota não está reservada para você.');
    const engenharia=['aprovarNota','devolverNota','salvarAnalise','corrigirAnalise','salvarVinculo','vincular'].includes(acao);
    if(acao==='salvarVinculo' && !podeVerVinculo())return aviso('Vínculo disponível só para a engenharia.');
    if(!pode(engenharia?'engenharia':'equipe'))return aviso('Ação indisponível para seu perfil.');
    const id = abertoId;
    if(acao === 'salvarAnalise'){
      const narrativa=$('#cxNarrativa').value.trim(),contrato=$('#cxContrato').value,expansao=$('#cxExpansao').value;
      return moverNota(id,D.fluxo[id].etapa,'Preenchimento da análise salvo',{narrativa,contrato,expansao});
    } else if (acao === 'corrigirAnalise'){
      const n = notas().find(x => x.id === id), narrativa = $('#cxCorrNarrativa').value.trim(), contrato = $('#cxCorrContrato').value;
      if (!R.podeCorrigirAnalise(pessoa, n)) return aviso('Esta nota já foi para a escrituração.');
      if (!narrativa || !contrato) return aviso('Preencha Narrativa e Contrato.');
      // Antes do pedido, mudar "É contrato?" refaz o mesmo desvio da aprovação. Depois, só registra.
      const etapa = ['pedido','contrato'].includes(n.etapa) ? (contrato === 'Sim' ? 'contrato' : 'pedido') : n.etapa;
      moverNota(id, etapa, 'Análise corrigida pela engenharia' + (etapa !== n.etapa ? ' · nova etapa: ' + ETAPAS[etapa] : ''), { narrativa, contrato });
    } else if (acao === 'salvarVinculo'){
      const n = notas().find(x => x.id === id), notaDe = $('#cxNotaDe').value, cartaoDe = $('#cxCartaoDe').value;
      if (!R.podeEditarVinculo(n)) return aviso('Nota já enviada à escrituração.');
      if (!notaDe && !cartaoDe) return aviso('Escolha de quem é a nota ou em qual cartão foi paga.');
      // Fora do histórico geral: a equipe de lançamento não vê o vínculo.
      alterarNota(id, ({ fluxo:f }) => { f.vinculo = { notaDe, cartaoDe, por:pessoa.nome, em:new Date().toISOString() }; }).then(ok => { if (ok){ desenhar(); abrirNota(id); aviso('Vínculo salvo.'); } });
    } else if (acao === 'aprovarNota'){
      const narrativa = $('#cxNarrativa').value.trim(), contrato = $('#cxContrato').value, expansao = $('#cxExpansao').value;
      if (!narrativa || !contrato || !expansao) return aviso('Preencha Narrativa, Contrato e Pertence à expansão para aprovar.');
      moverNota(id, expansao === 'Não' ? 'fora' : contrato === 'Sim' ? 'contrato' : 'pedido', 'Análise aprovada', { narrativa, contrato, expansao });
    } else if (acao === 'devolverNota') devolverNota(id);
    else if (acao === 'vincular'){
      if (D.contratos) return vincularContrato(id, $('#cxContratoSel').value);
      const contratoRef = $('#cxRefContrato').value.trim();
      if (!contratoRef) return aviso('Informe a referência do contrato.');
      moverNota(id, 'pedido', 'Contrato vinculado: ' + contratoRef, { contratoRef });
    } else if (acao === 'registrar'){
      const pedido = $('#cxPedido').value.trim();
      if (!pedido) return aviso('Informe o número do pedido lançado no Datasul.');
      moverNota(id, 'aprovacao', 'Pedido registrado: ' + pedido, { pedido });
    } else if (acao === 'pedidoOk') moverNota(id, 'escrituracao', 'Equipe confirmou a aprovação do pedido', {});
    else if (acao === 'escriturar'){
      const n = notas().find(x => x.id === id), emitente = $('#cxEmitente').value.trim();
      if (!/^\d{1,9}$/.test(emitente)) return aviso('Informe o código do emitente com até nove dígitos. Não use o CNPJ.');
      moverNota(id, /pinhal/i.test(n.unidade) || n.natureza === 'Remessa' ? 'fiscal' : 'encaminhada', 'Envio para escrituração simulado', { emitente });
    }
  }

  function abrirReq(id){
    const r = getReq(id); if (!r) { aviso('Esta requisição não está disponível para o seu perfil.'); return; }
    abertoId = id; abertoTipo = 'req';
    let acao = '<h4>Requisição aprovada</h4><div class="cx-nota">Entrega, situação da NF e finalização ainda precisam ser validadas com a operação.</div>';
    if (r.etapa === 'Aguardando Compras') acao = `<h4>Iniciar negociação</h4>${bloqueio('compras')}<label class="cx-campo">Comprador<input id="cxComprador" value="${pode('compras') ? 'Helena' : ''}" ${pode('compras') ? '' : 'disabled'}></label>${botao('atribuir', 'Atribuir e iniciar cotação', pode('compras'))}`;
    if (r.etapa === 'Em cotação') acao = `<h4>Negociação e propostas</h4><p class="cx-sub">Confira e anexe as propostas antes de concluir a negociação.</p>${bloqueio('compras')}${botao('negociado', 'Concluir negociação', pode('compras'))}`;
    if (r.etapa === 'Recusada') acao = `<h4>Requisição recusada</h4><div class="cx-nota">Motivo: ${esc(r.motivoRecusa || '—')}</div>`;
    if (r.etapa === 'Aguardando Engenharia'){
      const decide = R.podeDecidirReq(pessoa, r), trava = decide ? '' : 'disabled';
      acao = `<h4>Decisão da engenharia</h4><p class="cx-sub">Prazo encontrado na Monday: 3 dias. Aprovação de terceiros é uma decisão separada.</p>${decide ? '' : '<p class="cx-aviso-perm">Decisão de quem abriu a requisição.</p>'}<label class="cx-campo">Aprovação de terceiros<select id="cxTerceiros" ${trava}><option>Não solicitada</option><option>Pendente</option><option>Aprovado</option><option>Reprovado</option></select></label><label class="cx-campo">Motivo (obrigatório para ajuste ou recusa)<input id="cxMotivoReq" ${trava}></label><div class="cx-acoes">${botao('aprovarReq', 'Aprovar requisição', decide)}${botao('ajustarReq', 'Solicitar ajuste', decide, false)}${botao('recusarReq', 'Recusar requisição', decide, false)}</div>`;
    }
    const blocoAnexos = Object.keys(ANEXOS).map(t => `<div class="cx-bloco-anexo"><b>${ANEXOS[t]}</b> <button class="cx-btn cx-mini" data-anexar="${esc(r.id)}|${t}">Anexar</button><div class="cx-grade">${r.anexos[t].map(x => `<div class="cx-item">${miniatura(r, t, x, 'media')}<small title="${esc(x.nome)}">${esc(x.nome)}</small></div>`).join('') || '<span class="cx-sub">Nenhum arquivo</span>'}</div></div>`).join('');
    const blocoEmails = r.emails.length ? `<h4 style="margin-top:16px">${D.compras ? 'Avisos por e-mail' : 'E-mails à Helena (simulados)'}</h4>${r.emails.map(m => `<div class="cx-email"><b>${esc(m.assunto)}</b><div>${esc(m.corpo)}</div><small>De: ${REMETENTE} · Para: ${esc(m.para || DESTINO_COMPRAS)} · Responder para: ${esc(m.responderPara)}${m.erro ? ' · <b>erro no envio</b>' : m.enviado === false ? ' · enviando…' : ''}</small></div>`).join('')}` : '';
    abrirDialogo(r.nome, `<div class="cx-duas"><section class="cx-caixa">${etiqueta(r.etapa)}<div class="cx-fatos"><div><span>Identificação</span>${esc(r.id)}</div><div><span>Criação da RM</span>${diaBR(r.criadaEm)}</div><div><span>Unidade</span>${esc(r.unidade)}</div><div><span>Tipo / prioridade</span>${esc(r.tipo)} / ${esc(r.prioridade)}</div><div><span>SLA atendimento</span>${r.sla} dias · até ${fimSLA(r)}</div><div><span>Prazo desejado</span>${dataBR(r.prazoDesejado)}</div><div><span>Solicitante</span>${esc(r.solicitante)}</div><div><span>Comprador</span>${esc(r.comprador) || 'A definir'}</div><div><span>Terceiros</span>${esc(r.terceiros)}</div></div>${historico(r.historico)}</section><section class="cx-caixa">${acao}<h4 style="margin-top:16px">Anexos</h4>${blocoAnexos}${blocoEmails}</section></div>`);
    hidratarMiniaturas();
    if ($('#cxTerceiros')) $('#cxTerceiros').value = r.terceiros;
  }

  function moverReq(id, etapa, texto, mudanca, email, motivo){
    const r = getReq(id); if (!r) return;
    Object.assign(r, mudanca, { etapa }); r.historico.push(assinar(texto));
    if (email) avisarHelena(r, email, motivo);
    D.salvar(); desenhar(); abrirReq(id); aviso(email ? `${texto} · e-mail simulado para Helena` : texto);
  }

  async function acoesDaReq(acao){
    const id = abertoId;
    if (D.compras){
      const mapa = { atribuir:'atribuir', negociado:'negociado', aprovarReq:'aprovar', ajustarReq:'ajustar', recusarReq:'recusar' };
      if (!mapa[acao]) return;
      const motivo = $('#cxMotivoReq')?.value.trim() || null;
      if (['ajustarReq','recusarReq'].includes(acao) && !motivo) return aviso(acao === 'recusarReq' ? 'Informe o motivo da recusa.' : 'Informe o motivo do ajuste.');
      try { await D.compras.mover(getReq(id).uuid, mapa[acao], { comprador:$('#cxComprador')?.value.trim() || null, terceiros:$('#cxTerceiros')?.value || null, motivo }); }
      catch (e) { return aviso(e.message); }
      desenhar(); abrirReq(id); return aviso('Requisição atualizada.');
    }
    if (['aprovarReq','ajustarReq','recusarReq'].includes(acao) && !R.podeDecidirReq(pessoa, getReq(id))) return aviso('Só quem abriu a requisição decide.');
    if (acao === 'atribuir'){
      const comprador = $('#cxComprador').value.trim();
      if (!comprador) return aviso('Informe quem será responsável pela cotação.');
      moverReq(id, 'Em cotação', 'Comprador atribuído; negociação iniciada', { comprador });
    } else if (acao === 'negociado') moverReq(id, 'Aguardando Engenharia', 'Negociação concluída; prazo de aprovação: 3 dias', {});
    else if (acao === 'aprovarReq'){
      const terceiros = $('#cxTerceiros').value;
      if (['Pendente','Reprovado'].includes(terceiros)) return aviso('Resolva a aprovação de terceiros antes de concluir.');
      moverReq(id, 'Aprovada', 'Engenharia aprovou a requisição', { terceiros }, 'aprovacao');
    } else if (acao === 'ajustarReq'){
      const motivo = $('#cxMotivoReq').value.trim();
      if (!motivo) return aviso('Informe o motivo do ajuste.');
      moverReq(id, 'Em cotação', 'Ajuste solicitado: ' + motivo, { terceiros:$('#cxTerceiros').value }, 'ajuste', motivo);
    } else if (acao === 'recusarReq'){
      const motivo = $('#cxMotivoReq').value.trim();
      if (!motivo) return aviso('Informe o motivo da recusa.');
      moverReq(id, 'Recusada', 'Requisição recusada: ' + motivo, { terceiros:$('#cxTerceiros').value, motivoRecusa:motivo }, 'recusa', motivo);
    }
  }

  function novaReq(){
    if (!pode('engenharia')) return;
    abrirDialogo('Nova requisição', `<section class="cx-caixa"><label class="cx-campo">Nome da solicitação<input id="cxReqNome" placeholder="Ex.: Materiais para a plataforma"></label><label class="cx-campo">Descrição do item ou serviço<textarea id="cxReqDescricao" placeholder="Descreva o que precisa ser comprado ou executado"></textarea></label><div class="cx-duas"><label class="cx-campo">Tipo<select id="cxReqTipo"><option>Material</option><option>Serviço</option><option>Equipamento</option></select></label><label class="cx-campo">Tipo de prioridade<select id="cxReqPrioridade"><option>Padrão</option><option>Urgente</option></select></label></div><div class="cx-duas"><label class="cx-campo">Unidade<input id="cxReqUnidade" value="ARARAQUARA"></label><label class="cx-campo">Prazo desejado<input id="cxReqPrazo" type="date"></label></div><label class="cx-campo">Arquivo da RM (opcional)<input id="cxReqArquivo" type="file" multiple></label>${botao('criarReq', 'Criar requisição e cotação')}</section>`);
  }
  async function criarReq(){
    const nome = $('#cxReqNome').value.trim(); if (!nome) return aviso('Informe o nome da solicitação.');
    const tipo = $('#cxReqTipo').value, prioridade = $('#cxReqPrioridade').value;
    if (D.compras){
      try { await D.compras.criar({ nome, descricao:$('#cxReqDescricao').value.trim(), unidade:$('#cxReqUnidade').value.trim(), tipo, prioridade, prazo:$('#cxReqPrazo').value || null, arquivos:[...$('#cxReqArquivo').files] }); }
      catch (e) { return aviso(e.message); }
      fechar(); desenhar(); return aviso('Requisição criada. O aviso por e-mail sai pelo servidor.');
    }
    const nova = { id:'REQ-EX-' + crypto.randomUUID().slice(0,8).toUpperCase(), nome, descricao:$('#cxReqDescricao').value.trim(), unidade:$('#cxReqUnidade').value.trim() || '—', tipo, prioridade, sla:prioridade === 'Urgente' ? 3 : tipo === 'Serviço' ? 20 : 10, etapa:'Aguardando Compras', comprador:'', solicitante:pessoa.nome, solicitanteEmail:pessoa.email, terceiros:'Não solicitada', criadaEm:new Date().toISOString(), prazoDesejado:$('#cxReqPrazo').value, anexos:{ rm:[], propostas:[], certificados:[] }, emails:[], historico:[assinar('Requisição criada; cotação vinculada')] };
    const arquivos = [...$('#cxReqArquivo').files];
    avisarHelena(nova, 'abertura');
    D.requisicoes.push(nova);
    await guardarAnexos(nova, 'rm', arquivos);
    D.salvar(); fechar(); desenhar(); aviso('Requisição criada · e-mail simulado para Helena');
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'cxModal') return fechar();
    if (e.target.closest('[data-limpar-filtros]')) { filtros[chaveFiltro()] = filtroVazio(); filtroReq = null; return desenhar(); }
    const alvo = e.target.closest('[data-area],[data-cxaba],[data-nota],[data-req],[data-acao],[data-filtro],[data-anexar],[data-arquivo],[data-gav],[data-visao]');
    if (!alvo) return;
    if (alvo.dataset.visao){
      const busca = $('[data-busca]')?.value || '';
      visaoReq = alvo.dataset.visao; desenhar();
      const campo = $('[data-busca]'); campo.value = busca; campo.dispatchEvent(new Event('input', { bubbles:true }));
      $(`[data-visao=${visaoReq}]`).focus(); return;
    }
    if (alvo.dataset.gav) return acaoGaveta(alvo.dataset.gav);
    if (alvo.dataset.arquivo){ const [id, tipo, arq] = alvo.dataset.arquivo.split('|'); return abrirArquivo(id, tipo, arq); }
    if (alvo.dataset.filtro !== undefined){
      // Clicar de novo no mesmo cartão volta para a lista completa.
      filtroReq = alvo.dataset.filtro && alvo.dataset.filtro !== filtroReq ? alvo.dataset.filtro : null;
      return desenhar();
    }
    if (alvo.dataset.anexar){
      const [id, tipo] = alvo.dataset.anexar.split('|');
      anexoAlvo = { id, tipo }; $('#cxArquivo').value = ''; return $('#cxArquivo').click();
    }
    if (alvo.dataset.area) return trocarArea(alvo.dataset.area);
    if (alvo.dataset.cxaba){ aba = alvo.dataset.cxaba; return desenhar(); }
    if (alvo.dataset.nota) return abrirNota(alvo.dataset.nota);
    if (alvo.dataset.req) return abrirReq(alvo.dataset.req);
    const a = alvo.dataset.acao;
    if (a === 'liberarNota'){ fechar(); return aviso('Nota liberada para outras pessoas.'); }
    if (a === 'fechar') fechar();
    else if (a === 'novaReq') novaReq();
    else if (a === 'criarReq') criarReq();
    else if (abertoTipo === 'nota') acoesDaNota(a);
    else if (abertoTipo === 'req') acoesDaReq(a);
  });
  document.addEventListener('input', e => {
    if (!e.target.matches('[data-busca]')) return;
    filtros[chaveFiltro()].busca = e.target.value;
    filtrou(e.target);
  });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-cxfilter]')) return;
    filtros[chaveFiltro()][e.target.dataset.cxfilter] = e.target.value;
    filtrou(e.target);
  });
  document.addEventListener('keydown', e => {
    const m = $('#cxModal');
    if (gaveta && e.key === 'Escape') return fecharGaveta();
    if (m.hidden && !gaveta) return;
    if (e.key === 'Escape') return fechar();
    if (e.key !== 'Tab') return;
    const seletorFoco = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)';
    const focaveis = [...(m.hidden ? [] : $$(seletorFoco, m)), ...(gaveta ? $$(seletorFoco, $('#cxGaveta')) : [])].filter(e => e.getClientRects().length), prim = focaveis[0], ult = focaveis.at(-1);
    if (e.shiftKey && document.activeElement === prim){ e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult){ e.preventDefault(); prim.focus(); }
  });
  // ---- Quadro: gravar ao sair de cada campo, aprovar pela linha e Enter para o próximo campo ----
  // Cada gravação espera a anterior, para a versão da nota ficar sempre em dia.
  let fila = Promise.resolve();
  async function gravarCampos(id, campos){
    const f = D.fluxo[id];
    if (D.analise){
      const r = await D.analise.salvar(id, campos, f.versao ?? null);
      Object.assign(f, { narrativa:r.narrativa, contrato:r.contrato, expansao:r.expansao, etapa:r.etapa, historico:r.historico, versao:r.versao });
      return;
    }
    Object.assign(f, campos); D.salvar();
  }
  function atualizarLinha(tr){
    if (!tr) return;
    const f = D.fluxo[tr.dataset.linha], b = tr.querySelector('[data-aprovar-linha]');
    if (b) b.disabled = !(f.narrativa && f.contrato && f.expansao);
    const nA = $('#cxAbas [data-area=aprovacoes] .cx-num'); if (nA) nA.textContent = notas().filter(n => n.etapa === 'engenharia').length;
  }
  function salvarCelula(el){
    const id = el.dataset.celulaNota, campo = el.dataset.celula, valor = el.value.trim(), f = D.fluxo[id];
    if (campo === 'pedido' || !f || valor === (f[campo] || '')) return;   // o pedido só é gravado ao registrar
    const antes = f.etapa;
    el.classList.add('salvando');
    fila = fila.then(async () => {
      try {
        await gravarCampos(id, { [campo]: valor });
        el.classList.remove('salvando'); el.classList.add('salvo'); setTimeout(() => el.classList.remove('salvo'), 1200);
        if (f.etapa !== antes) desenhar(); else atualizarLinha(el.closest('tr'));
      } catch (e) { el.classList.remove('salvando'); el.value = f[campo] || ''; aviso(e.message); }
    });
  }
  async function aprovarAnalise(id){
    await fila;
    const f = D.fluxo[id];
    if (!f.narrativa || !f.contrato || !f.expansao) return aviso('Preencha Narrativa, Contrato e Pertence à expansão para aprovar.');
    try {
      if (D.analise){ const r = await D.analise.aprovar(id, f.versao ?? null); Object.assign(f, { narrativa:r.narrativa, contrato:r.contrato, expansao:r.expansao, etapa:r.etapa, historico:r.historico, versao:r.versao }); }
      else { f.etapa = proximaEtapa(f); f.historico.push(assinar('Análise aprovada')); D.salvar(); }
    } catch (e) { return aviso(e.message); }
    fechar(); desenhar(); aviso('Análise aprovada. A nota foi para: ' + ETAPAS[f.etapa] + '.');
  }
    // ---- Processo completo: contrato -> pedido no Datasul -> aprovação do pedido -> escrituração ----
  const aplicarAnalise = (f, r) => Object.assign(f, { narrativa:r.narrativa, contrato:r.contrato, expansao:r.expansao, pedido:r.pedido ?? f.pedido, contratoRef:r.contratoRef ?? f.contratoRef, etapa:r.etapa, historico:r.historico, versao:r.versao });
  async function avancar(id, texto, remoto, local){
    await fila;
    const f = D.fluxo[id];
    try {
      if (D.analise) aplicarAnalise(f, await remoto(f));
      else { local(f); f.historico.push(assinar(texto)); D.salvar(); }
    } catch (e) { return aviso(e.message); }
    fechar(); desenhar(); aviso(texto + '. A nota foi para: ' + ETAPAS[f.etapa] + '.');
  }
  // ---- Devolver ao lançamento (Gustavo, 12/11): a nota volta ao painel de lançamento como Pendente, com o motivo ----
  // Só quem tem análise (engenharia/admin), só para nota que veio do lançamento do painel (id sem "M" de Monday) e só antes do pedido no Datasul.
  const podeDevolver = n => !!n && ['contrato', 'engenharia', 'fora'].includes(n.etapa) && !String(n.id).startsWith('M') && ['engenharia', 'admin'].includes(pessoa.perfil);
  const blocoDevolver = n => !podeDevolver(n) ? '' : `<div class="cx-bloco-eng"><h4>Devolver ao lançamento</h4><p class="cx-sub">Se esta nota está errada ou incompleta, devolva para o lançamento corrigir. Ela volta como Pendente, com o seu motivo. Na Monday nada é alterado, e ela volta para cá quando for reenviada.</p><label class="cx-campo">Motivo da devolução<textarea id="cxMotivoDevolucao" placeholder="Descreva o que precisa ser corrigido"></textarea></label>${botao('devolverContrato', 'Devolver ao lançamento', true, false)}</div>`;
  function abrirDevolucao(id){
    const n = notas().find(x => x.id === id); if (!n) return;
    abertoId = id; abertoTipo = 'nota';
    abrirDialogo(`Devolver ao lançamento · NF ${n.nf}`, `<p>${esc(n.fornecedor)} · ${dinheiro(n.valor)}</p><p class="cx-sub">A nota volta para o painel de lançamento como Pendente, com o sinal de revisão e o seu motivo. Na Monday nada é alterado, e ela volta para cá quando o lançamento reenviar.</p><label class="cx-campo">Motivo da devolução<textarea id="cxMotivoDevolucao" placeholder="Descreva o que precisa ser corrigido"></textarea></label><div class="cx-acoes">${botao('devolverContrato', 'Devolver ao lançamento', true)}${botao('fechar', 'Cancelar', true, false)}</div>`);
    $('#cxMotivoDevolucao')?.focus();
  }
  async function devolverParaLancamento(id, motivo){
    motivo = String(motivo || '').trim();
    if (!motivo) return aviso('Informe o motivo da devolução.');
    const n = notas().find(x => x.id === id);
    if (!podeDevolver(n)) return aviso('Esta nota não pode ser devolvida por aqui.');
    await fila;
    const f = D.fluxo[id];
    try {
      if (D.analise?.devolver) aplicarAnalise(f, await D.analise.devolver(id, motivo, f.versao ?? null));
      else {   // demonstração: mesmo efeito, só na cópia local
        f.etapa = 'devolvida'; f.historico.push(assinar('Devolvida ao lançamento: ' + motivo));
        const original = D.lancamentos.find(x => x.id === id); if (original) Object.assign(original, { status:'Pendente', requer_revisao:true, enviado_por_email:null });
        await D.cliente.from('lancamentos').update({ status:'Pendente', requer_revisao:true, enviado_por_email:null }).eq('id', id);
        D.salvar();
      }
    } catch (e) { return aviso(e.message); }
    fechar(); desenhar(); aviso('Nota devolvida ao lançamento. Ela volta para cá quando o lançamento reenviar.');
  }
  // Confere o saldo na hora (zera o cache) e, se estiver negativo, avisa e impede a ação.
  const bloqueadaPorSaldo = id => { cacheSaldo = null; const b = bloqueioSaldo(notas().find(x => x.id === id)); if (b) aviso(b.texto); return !!b; };
  const registrarPedido = (id, pedido) => !pedido ? aviso('Informe o número do pedido lançado no Datasul.')
    : bloqueadaPorSaldo(id) ? null
    : avancar(id, 'Pedido registrado', f => D.analise.registrarPedido(id, pedido, f.versao ?? null), f => { f.pedido = pedido; f.etapa = 'aprovacao'; });
  const confirmarPedido = id => bloqueadaPorSaldo(id) ? null
    : avancar(id, 'Pedido aprovado', f => D.analise.confirmarPedido(id, f.versao ?? null), f => { f.etapa = 'escrituracao'; });
  function vincularContrato(id, contratoId){
    if (!contratoId) return aviso('Escolha o contrato.');
    const nota = notas().find(x => x.id === id), c = calcContratos().find(x => x.id === contratoId);
    if (nota && c){ const s = avaliarSaldo(nota, c); if (!s.ok) return aviso(textoSemSaldo(s)); }
    return avancar(id, 'Contrato vinculado', f => D.analise.vincularContrato(id, contratoId, f.versao ?? null), f => { f.contratoRef = contratoId; f.etapa = 'pedido'; });
  }
  document.addEventListener('click', e => {
    const p = e.target.closest?.('[data-pedido-linha]');
    if (p){ const id = p.dataset.pedidoLinha; return registrarPedido(id, $(`tr[data-linha="${id}"] [data-celula=pedido]`)?.value.trim() || ''); }
    const c = e.target.closest?.('[data-confirmar-linha]'); if (c) return confirmarPedido(c.dataset.confirmarLinha);
    const v = e.target.closest?.('[data-vincular-contrato]');
    if (v){ const id = v.dataset.vincularContrato; return vincularContrato(id, $(`[data-contrato-sel="${id}"]`)?.value || ''); }
    const n = e.target.closest?.('[data-contrato-notas]'); if (n) abrirContratoNotas(n.dataset.contratoNotas);
    const d = e.target.closest?.('[data-devolver-linha]'); if (d) abrirDevolucao(d.dataset.devolverLinha);
  });
  document.addEventListener('change', e => { const c = e.target.closest?.('[data-celula]'); if (c) salvarCelula(c); });
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-aprovar-linha]'); if (b) aprovarAnalise(b.dataset.aprovarLinha); });
  // Enter passa para o próximo campo SEM sair da tela atual: no quadro, vai de campo em campo da mesma aba;
  // numa janela de formulário, vai de campo em campo da própria janela. Nunca troca de aba nem de área.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const el = e.target;
    if (el.matches?.('[data-celula]')){
      e.preventDefault();
      const campos = $$('#cxArea [data-celula]').filter(c => !c.disabled && c.offsetParent !== null);
      const prox = campos[campos.indexOf(el) + 1];
      if (prox){ prox.focus(); prox.select?.(); } else el.blur();
      return;
    }
    const janela = el.closest?.('.cx-dialogo');
    if (!janela || !el.matches('input:not([type=file]):not([type=checkbox]):not([type=hidden]), select, textarea')) return;
    if (el.tagName === 'TEXTAREA' && e.shiftKey) return;   // Shift+Enter continua quebrando a linha
    const campos = $$('input:not([type=file]):not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])', janela).filter(c => c.offsetParent !== null);
    const prox = campos[campos.indexOf(el) + 1];
    if (prox){ e.preventDefault(); prox.focus(); }
  });
  const lateral = document.createElement('aside');
  lateral.id = 'cxGaveta'; lateral.hidden = true; lateral.setAttribute('aria-label', 'Visualizar arquivo');
  document.body.appendChild(lateral);
  // Clicar e arrastar move o documento ampliado em qualquer direção (o scroll continua subindo e descendo).
  let arrasto = null;
  lateral.addEventListener('pointerdown', e => {
    const v = e.target.closest('#cxVisor'); if (!v || e.button !== 0) return;
    const r = v.getBoundingClientRect(); if (e.clientX > r.left + v.clientWidth || e.clientY > r.top + v.clientHeight) return;   // clique na barra de rolagem não conta
    arrasto = { v, x:e.clientX, y:e.clientY, esq:v.scrollLeft, topo:v.scrollTop };
    try { v.setPointerCapture(e.pointerId); } catch (_) { /* sem captura, o arrasto continua dentro do painel */ }
    v.classList.add('arrastando'); e.preventDefault();
  });
  lateral.addEventListener('pointermove', e => { if (arrasto){ arrasto.v.scrollLeft = arrasto.esq - (e.clientX - arrasto.x); arrasto.v.scrollTop = arrasto.topo - (e.clientY - arrasto.y); } });
  const fimArrasto = () => { if (arrasto){ arrasto.v.classList.remove('arrastando'); arrasto = null; } };
  lateral.addEventListener('pointerup', fimArrasto); lateral.addEventListener('pointercancel', fimArrasto);
  // Ctrl + scroll (ou pinça no touchpad) dá o mesmo zoom dos botões + e −.
  let relogioZoom = null;
  lateral.addEventListener('wheel', e => {
    if (!e.ctrlKey || !gaveta || !e.target.closest('#cxVisor')) return;
    e.preventDefault();
    zoomGav = Math.min(3, Math.max(0.6, zoomGav * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    $$('#cxVisor canvas, #cxVisor img').forEach(c => { c.style.width = (zoomGav * 100) + '%'; });
    clearTimeout(relogioZoom);
    relogioZoom = setTimeout(() => { if (!gaveta) return; const a = listaDe(gaveta.reqId, gaveta.tipo).find(x => x.id === gaveta.id); if (a) mostrarArquivo(a, ++vezVisor, lerRolagem()); }, 250);
  }, { passive:false });
  const seletor = document.createElement('input');
  seletor.type = 'file'; seletor.multiple = true; seletor.id = 'cxArquivo'; seletor.hidden = true;
  seletor.onchange = () => { if (anexoAlvo) anexar(anexoAlvo.id, anexoAlvo.tipo, [...seletor.files]); };
  document.body.appendChild(seletor);
  const NAV_CHAVE = 'cx_nav_fechada';
  function aplicarNav(){
    const fechada = localStorage.getItem(NAV_CHAVE) === '1';
    document.body.classList.toggle('cx-nav-fechada', fechada);
    const b = $('#cxNavAlternar');
    if (b){ b.textContent = fechada ? '☰ Menu' : '‹ Recolher'; b.setAttribute('aria-expanded', String(!fechada)); b.title = fechada ? 'Mostrar o menu' : 'Recolher o menu e usar a tela inteira'; }
  }
  function alternarNav(){ localStorage.setItem(NAV_CHAVE, localStorage.getItem(NAV_CHAVE) === '1' ? '0' : '1'); aplicarNav(); }
  function entrar(pessoaAtual){
    if (!pessoaAtual || !ACESSO[pessoaAtual.perfil]) throw new Error('Perfil da Expansão inválido.');
    pessoa = pessoaAtual;
    reservas = D.criarReservas ? D.criarReservas(pessoa) : window.ExpansaoReservas.criar({usuario:pessoa,storage:localStorage,token:crypto.randomUUID(),executar:(chave,fn)=>navigator.locks ? navigator.locks.request(chave,fn) : Promise.reject(Error('Este navegador não oferece reserva segura. Abra a prévia em um navegador atualizado.'))});
    if(!$('#cxReservas')){const el=document.createElement('div');el.id='cxReservas';el.className='cx-colaboracao';el.setAttribute('aria-live','polite');$('#cxAbas').after(el);}
    document.body.classList.add('cx-experiencia');
    const permitidas = areasDe(pessoa);
    const nomes = { lancamento:'Lançamento de notas', aprovacoes:'Aprovações', compras:'Compras', projetos:'Projetos', portfolio:'Portfólio (Monday)', portfolioPainel:'Portfólio (nosso painel)' };
    $('#cxAbas').innerHTML = `<div class="cx-marca"><span class="cx-marca-simbolo" aria-hidden="true"><i></i><i></i><i></i></span><span>expansão<small>EMPRESA EXEMPLO</small></span></div><div class="cx-nav-rotulo">ÁREA DE TRABALHO</div><div class="cx-nav-links">${permitidas.map(a => `<button role="tab" data-area="${a}">${icone({lancamento:'documento',aprovacoes:'analise',compras:'compras',projetos:'tabela',portfolio:'grade',portfolioPainel:'grade'}[a])}<span>${nomes[a]}</span>${['lancamento', 'portfolio', 'portfolioPainel'].includes(a) ? '' : ' <span class="cx-num">0</span>'}</button>`).join('')}</div><div class="cx-nav-nota"><span class="cx-nav-traco"></span><p>Mais clareza.<br>Mais movimento.</p><small>Gestão da expansão</small></div><div class="cx-nav-pessoa"><span class="cx-avatar">${iniciais(pessoa.nome)}</span><div><b>${esc(pessoa.nome)}</b><small>${{admin:'Administração',equipe:'Equipe de lançamento',engenharia:'Engenharia',compras:'Compras'}[pessoa.perfil]}</small></div><span class="cx-presenca" title="Sessão ativa"></span></div>`;
    $('#cxAbas').hidden = false;
    // Botão para recolher o menu e deixar a tela quase toda para o painel (Gustavo, 12/11). Lembra a escolha.
    if (!$('#cxNavAlternar')){ const b = document.createElement('button'); b.id = 'cxNavAlternar'; b.type = 'button'; b.setAttribute('aria-controls', 'cxAbas'); b.addEventListener('click', alternarNav); document.body.appendChild(b); }
    aplicarNav();
    aba = pessoa.perfil === 'equipe' ? 'pedido' : 'engenharia';
    trocarArea(permitidas[0]);
    sincronizarNotas();
  }
  window.addEventListener('storage',e=>{if(e.key==='expansao_colaboracao_v1')sincronizarNotas();});
  setInterval(async()=>{try{if(reservaAtual && reservas?.validar('nota:'+reservaAtual.id))await reservas.renovar('nota:'+reservaAtual.id);sincronizarNotas();}catch(e){aviso(e.message);}},10000);
  window.addEventListener('pagehide',()=>{if(reservaAtual)reservas?.liberar('nota:'+reservaAtual.id).catch(()=>{});});
  D.aoMudar(desenhar);
  window.ExpansaoUI = Object.freeze({ entrar, atualizar:desenhar });
})();
