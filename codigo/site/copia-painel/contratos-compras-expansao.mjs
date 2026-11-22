// Mudanças só do painel de Expansão (Gustavo, 14/11/2026): Contratos (só o Marcos cria e altera; aditivo exige contrato),
// Compras (status em grupos, como Contratos) e acesso a Projetos e Portfólio (engenheiros só veem o Portfólio).
// Como cartoes-aprovacoes.mjs, aplica trocas de texto e para com erro se a marca mudar. Não é usado pela Engenharia.
import { readFileSync } from 'node:fs';

const trechos = (() => {
  const texto = readFileSync(new URL('./contratos-compras-expansao.js', import.meta.url), 'utf8');
  const mapa = {};
  for (const parte of texto.split(/^\/\/@@ /m).slice(1)) { const i = parte.indexOf('\n'); mapa[parte.slice(0, i).trim()] = parte.slice(i + 1); }
  return mapa;
})();

function aplicar(js, de, para, vezes = 1) {
  const n = js.split(de).length - 1;
  if (n !== vezes) throw Error(`Marca de Contratos/Compras mudou (${n}x, esperava ${vezes}): ${de.slice(0, 80)}`);
  return js.split(de).join(para);
}

export function comContratosEComprasExpansao(js) {
  // --- Projetos e Portfólio ---
  js = aplicar(js, "  const areasDe = p => [...ACESSO[p.perfil], ...(D.projetosAcesso ? ['projetos', 'portfolio', 'portfolioNosso'] : [])];\n", trechos.projetos);
  js = aplicar(js, 'src="${esc(PORTFOLIO_NOSSO_URL)}" title="Portfólio de Projetos (nosso sistema)"', 'src="${esc(PORTFOLIO_NOSSO_URL)}${podeMexerPortfolio(pessoa) ? \'\' : \'?leitura=1\'}" title="Portfólio de Projetos (nosso sistema)"');
  js = aplicar(js, 'href="${esc(PORTFOLIO_NOSSO_URL)}" target="_blank"', 'href="${esc(PORTFOLIO_NOSSO_URL)}${podeMexerPortfolio(pessoa) ? \'\' : \'?leitura=1\'}" target="_blank"');
  // --- Contratos ---
  js = aplicar(js, '  function abrirContratoNotas(id){', trechos.contratos + '  function abrirContratoNotas(id){');
  js = aplicar(js, '<div><span class="cx-kicker">QUADRO DE CONTRATOS</span><h3>Contratos</h3></div><span class="cx-total-fila">',
    '<div><span class="cx-kicker">QUADRO DE CONTRATOS</span><h3>Contratos</h3></div><div class="cx-visoes cx-acoes-contratos" title="${podeMexerContratos() ? \'\' : \'Só os engenheiros da Expansão, o Marcos e o Gustavo criam contratos e aditivos\'}"><button class="cx-btn forte" data-novo-contrato ${podeMexerContratos() ? \'\' : \'disabled\'}>+ Novo contrato</button><button class="cx-btn" data-novo-aditivo ${podeMexerContratos() ? \'\' : \'disabled\'}>+ Novo aditivo</button></div><span class="cx-total-fila">');
  js = aplicar(js, '</div>${ferramentasC}${blocoAguardando}', '</div>${podeMexerContratos() ? \'\' : \'<p class="cx-sub">Somente visualização para você: os botões <b>+ Novo contrato</b> e <b>+ Novo aditivo</b> são dos engenheiros da Expansão, do Marcos e do Gustavo.</p>\'}${ferramentasC}${blocoAguardando}');
  js = aplicar(js, "<td class=\"cx-q-nota\"><b title=\"${esc(c.nome)}\">${esc(c.nome)}</b><small>${esc(c.referencia || '')}</small></td>",
    "<td class=\"cx-q-nota\"><b title=\"${esc(c.nome)}\">${esc(c.nome)}</b><small>${esc(c.referencia || '')}${c.tipo === 'Aditivo' && paiDeAditivo(c) ? ' · aditivo de ' + esc(paiDeAditivo(c).nome) : ''}</small></td>");
  // --- Anexos em contratos e aditivos (14/11): "+" na coluna Arquivos e bloco "Anexar documentos" na janela do contrato (só o Marcos) ---
  js = aplicar(js, '<td><button class="cx-btn cx-mini" data-contrato-notas="${esc(c.id)}" aria-label="Ver os ${arquivosContrato(c).length} arquivos de ${esc(c.nome)}">${arquivosContrato(c).length}</button></td>',
    '<td><button class="cx-btn cx-mini" data-contrato-notas="${esc(c.id)}" aria-label="Ver os ${arquivosContrato(c).length} arquivos de ${esc(c.nome)}">${arquivosContrato(c).length}</button>${podeMexerContratos() ? `<button class="cx-btn cx-mini cx-anexar-linha" data-anexar-contrato="${esc(c.id)}" title="Anexar documentos" aria-label="Anexar documentos em ${esc(c.nome)}">+</button>` : \'\'}</td>');
  js = aplicar(js, '  function abrirContratoNotas(id){\n    const c = calcContratos().find(x => x.id === id); if (!c) return;',
    '  function abrirContratoNotas(id){\n    const c = calcContratos().find(x => x.id === id); if (!c) return;\n    abertoContrato = id;');
  js = aplicar(js, '+ `<h4>Arquivos (${arqs.length})</h4>`',
    '+ (podeMexerContratos() ? `<div class="cx-bloco-eng"><h4>Anexar documentos</h4><p class="cx-sub">Contrato, proposta, medição, aditivo assinado… Até 50 MB por arquivo.</p><div class="cx-acoes"><button class="cx-btn forte" data-anexar-contrato="${esc(c.id)}">+ Anexar documentos</button></div></div>` : \'\') + `<h4>Arquivos (${arqs.length})</h4>`');
  js = aplicar(js, 'Os mesmos arquivos do contrato na Monday. Clique para abrir ao lado.', 'Arquivos do contrato (os vindos da Monday e os anexados no painel). Clique para abrir ao lado.');
  // --- Setinha de recolher/expandir nos grupos (Contratos, Projetos, Compras) ---
  js = aplicar(js, '    barrasTopo();\n    atualizarReservas();\n  }', '    barrasTopo();\n    setasGrupos();\n    atualizarReservas();\n  }');
  // --- Contrato criado no painel: topo do grupo, etiqueta "Criado no painel" e destaque logo depois de criar (14/11) ---
  js = aplicar(js, '    const linhaC = c => `<tr>', '    const linhaC = c => `<tr data-contrato-linha="${esc(c.id)}" class="${c.origem === \'painel\' ? \'cx-contrato-novo\' : \'\'}">');
  js = aplicar(js, 'const itens = visiveis.filter(c => grupoContrato(c) === g), fechado', 'const itens = visiveis.filter(c => grupoContrato(c) === g).sort((a, b) => String(b.criadoEm || \'\').localeCompare(String(a.criadoEm || \'\'))), fechado');
  // --- Busca por palavras em Contratos e na lista de vincular contrato (14/11) ---
  js = aplicar(js, '(!f.busca || textoContrato(c).includes(R.normalizar(f.busca)))', '(!f.busca || R.contem(textoContrato(c), f.busca))');
  js = aplicar(js, 'const todosDoFiltro = contratosAtivos().filter(naoAditivo).filter(c => !busca || buscaContrato(c).includes(busca));', 'const todosDoFiltro = contratosAtivos().filter(naoAditivo).filter(c => !busca || R.contem(buscaContrato(c), busca));');
  js = aplicar(js, 'const noNome = c => busca && R.normalizar(c.nome).includes(busca);', 'const noNome = c => busca && R.contem(c.nome, busca);');
  js = aplicar(js, "l.dataset.texto.includes(R.normalizar(f.busca))", "R.contem(l.dataset.texto, f.busca)");
  // --- Editar: coluna com o botão em cada linha e botão na janela do contrato ---
  js = aplicar(js, "<th>Aceite</th><th>CNPJ</th>';", "<th>Aceite</th><th>CNPJ</th><th></th>';");
  js = aplicar(js, "<td>${esc(c.cnpj || '—')}</td></tr>`;", "<td>${esc(c.cnpj || '—')}</td><td class=\"cx-q-acoes\"><button class=\"cx-btn cx-mini\" data-editar-contrato=\"${esc(c.id)}\">Editar</button></td></tr>`;");
  js = aplicar(js, "    abrirDialogo(c.nome, `<div class=\"cx-fatos\">", "    abrirDialogo(c.nome, `<div class=\"cx-acoes\"><button class=\"cx-btn forte\" data-editar-contrato=\"${esc(c.id)}\">Editar ${c.tipo === 'Aditivo' || c.grupo === 'Aditivos' ? 'aditivo' : 'contrato'}</button></div><div class=\"cx-fatos\">");
  // --- Arquivos juntos: o contrato mostra também os dos aditivos; o aditivo mostra também os do contrato (14/11) ---
  js = aplicar(js, "  const arquivosContrato = c => [...(c.arquivos || []), ...(c.subitens || []).flatMap(s => (s.lista || []).map(a => ({ ...a, sub:s.nome })))];",
    "  const arquivosProprios = c => [...(c.arquivos || []), ...(c.subitens || []).flatMap(s => (s.lista || []).map(a => ({ ...a, sub:s.nome })))];\n"
    + "  const contratoPorId = id => (D.contratos || []).find(x => x.id === id);\n"
    + "  const paiDoAditivo = c => (D.contratos || []).find(x => (x.aditivos || []).includes(c.id));\n"
    + "  const arquivosContrato = c => { const base = contratoPorId(c.id) || c, pai = paiDoAditivo(base);\n"
    + "    return [...arquivosProprios(base),\n"
    + "      ...(base.aditivos || []).map(contratoPorId).filter(Boolean).flatMap(a => arquivosProprios(a).map(f => ({ ...f, dono:'Aditivo', donoNome:a.nome }))),\n"
    + "      ...(pai ? arquivosProprios(pai).map(f => ({ ...f, dono:'Contrato', donoNome:pai.nome })) : [])].map(f => f.dono ? f : { ...f, dono:(base.tipo === 'Aditivo' || base.grupo === 'Aditivos') ? 'Aditivo' : 'Contrato', donoNome:base.nome }); };");
  // --- Contratos sem Aprovador (Gustavo, 14/11) ---
  js = aplicar(js, '<th>Aprovador</th>', '');
  js = aplicar(js, "<td>${esc(c.aprovador || '—')}</td>", '');
  // --- Janela do contrato: arquivos separados por contrato e por aditivo ---
  { const ini = js.indexOf('(arqs.length ? `<p class="cx-sub">Arquivos do contrato'), marca = ": '<p class=\"cx-sub\">Nenhum arquivo neste contrato.</p>')", fim = js.indexOf(marca, ini);
    if (ini < 0 || fim < 0) throw Error('Janela de arquivos do contrato mudou.');
    js = js.slice(0, ini) + '(arqs.length ? gradeArquivosSegregada(c, arqs) ' + js.slice(fim); }
  // --- Compras: indicadores do procedimento e grupo "Aguardando fechamento" ---
  js = aplicar(js, '<section class="cx-requisicoes" aria-label="Requisições">', '${painelIndicadoresCompras(visiveis)}<section class="cx-requisicoes" aria-label="Requisições">');
  js = aplicar(js, "const cartoes = ['Aguardando Compras','Em cotação','Aguardando Engenharia','Aprovada'].map(", "const cartoes = ['Aguardando Compras','Em cotação','Aguardando Engenharia','Aguardando fechamento','Aguardando entrega','Entrega concluída'].map(");
  js = aplicar(js, "icone(['relogio','compras','analise','check'][i])", "icone(['relogio','compras','analise','relogio','envio','check'][i])");
  js = aplicar(js, "moverReq(id, 'Aprovada', 'Engenharia aprovou a requisição', { terceiros }, 'aprovacao');", "moverReq(id, 'Aguardando fechamento', 'Engenharia aprovou a requisição; aguardando fechamento', { terceiros }, 'aprovacao');");
  // --- Compras: botões de passo (fechamento e entrega com data) na janela da requisição, na linha e no cartão ---
  js = aplicar(js, "    if (r.etapa === 'Recusada') acao = ", "    if (r.etapa === 'Aguardando fechamento') acao = `<h4>Fechamento do pedido</h4><p class=\"cx-sub\">Compras confirma o pedido com o fornecedor (meta do procedimento: até 24 h após a aprovação).</p>${bloqueio('compras')}${botao('fecharReq', 'Fechamento concluído → Aguardando entrega', pode('compras'))}`;\n"
    + "    if (['Aguardando entrega', 'Aprovada'].includes(r.etapa)) acao = `<h4>Entrega</h4><p class=\"cx-sub\">Informe a data em que foi entregue. Sem a data, a requisição não passa para Entrega concluída.</p>${podeEntregarReq(r) ? '' : '<p class=\"cx-aviso-perm\">Registro de Compras, da administração ou de quem abriu a requisição.</p>'}<label class=\"cx-campo\">Data da entrega<input type=\"date\" id=\"cxDataEntrega\" max=\"${new Date().toISOString().slice(0, 10)}\" ${podeEntregarReq(r) ? '' : 'disabled'}></label>${botao('entregarReq', 'Registrar entrega → Entrega concluída', podeEntregarReq(r))}`;\n"
    + "    if (r.etapa === 'Entrega concluída') acao = `<h4>Entrega concluída</h4><div class=\"cx-nota\">Entregue em ${dataBR(r.dataEntrega)}${r.prazoDesejado ? ` · prazo desejado ${dataBR(r.prazoDesejado)}` : ''}.</div>`;\n"
    + "    if (r.etapa === 'Recusada') acao = ");
  js = aplicar(js, "      const mapa = { atribuir:'atribuir', negociado:'negociado', aprovarReq:'aprovar', ajustarReq:'ajustar', recusarReq:'recusar' };", "      const mapa = { atribuir:'atribuir', negociado:'negociado', aprovarReq:'aprovar', ajustarReq:'ajustar', recusarReq:'recusar', fecharReq:'fechar', entregarReq:'entregar' };\n      if (acao === 'entregarReq' && !$('#cxDataEntrega')?.value) return aviso('Informe a data da entrega.');");
  js = aplicar(js, "terceiros:$('#cxTerceiros')?.value || null, motivo }); }", "terceiros:$('#cxTerceiros')?.value || null, motivo, data:$('#cxDataEntrega')?.value || null }); }");
  js = aplicar(js, "    } else if (acao === 'recusarReq'){", "    } else if (acao === 'fecharReq') moverReq(id, 'Aguardando entrega', 'Fechamento concluído; aguardando entrega', {});\n    else if (acao === 'entregarReq'){\n      const d = $('#cxDataEntrega').value;\n      if (!d) return aviso('Informe a data da entrega.');\n      moverReq(id, 'Entrega concluída', 'Entrega concluída em ' + dataBR(d), { dataEntrega:d });\n    } else if (acao === 'recusarReq'){");
  js = aplicar(js, '<td><button class="cx-btn" data-req="${esc(r.id)}">Abrir</button></td></tr>`', '<td>${botaoPassoReq(r)}<button class="cx-btn" data-req="${esc(r.id)}">Abrir</button></td></tr>`');
  js = aplicar(js, '<button class="cx-btn cx-abrir" data-req="${esc(r.id)}">Abrir requisição ${icone(\'seta\')}</button>', '${botaoPassoReq(r)}<button class="cx-btn cx-abrir" data-req="${esc(r.id)}">Abrir requisição ${icone(\'seta\')}</button>');
  js = aplicar(js, '  function abrirReq(id){', "  const podeEntregarReq = r => pode('compras') || R.podeDecidirReq(pessoa, r);\n  const PASSO_REQ = { 'Aguardando fechamento':'Concluir fechamento →', 'Aguardando entrega':'Registrar entrega →', 'Aprovada':'Registrar entrega →' };\n  const botaoPassoReq = r => PASSO_REQ[r.etapa] && (r.etapa === 'Aguardando fechamento' ? pode('compras') : podeEntregarReq(r)) ? `<button class=\"cx-btn cx-mini forte cx-req-passo\" data-req=\"${esc(r.id)}\">${PASSO_REQ[r.etapa]}</button>` : '';\n  function abrirReq(id){");
  // --- Projetos e Atividades (14/11): mesma tela, com criar, editar e exportar planilha ---
  js = aplicar(js, '  function telaProjetos(){\n    const P = D.projetos;', '  function telaProjetos(P = D.projetos, chave = \'projetos\'){');
  js = aplicar(js, 'const f = filtros.projetos,', 'const f = filtros[chave] || (filtros[chave] = filtroVazio()),');
  js = aplicar(js, "    if (area === 'projetos') $('#cxArea').innerHTML = telaProjetos();", "    if (area === 'projetos') $('#cxArea').innerHTML = telaProjetos();\n    if (area === 'atividades') $('#cxArea').innerHTML = telaProjetos(D.atividades, 'atividades');\n    { const nAt = $('#cxAbas [data-area=atividades] .cx-num'); if (nAt) nAt.textContent = D.atividades?.itens.length ?? 0; }");
  js = aplicar(js, "projetos:'Quadro de Projetos', ", "projetos:'Quadro de Projetos', atividades:'Atividades', ");
  js = aplicar(js, "projetos:'Projetos', portfolio:'Portfólio (Monday)'", "projetos:'Projetos', atividades:'Atividades', portfolio:'Portfólio (Monday)'");
  js = aplicar(js, "projetos:'tabela',portfolio:'grade'", "projetos:'tabela',atividades:'tabela',portfolio:'grade'");
  js = aplicar(js, '<span class="cx-kicker">QUADRO DE PROJETOS</span><h3>${esc(P.quadro.nome || \'Portfólio de Projetos\')}</h3></div>', '<span class="cx-kicker">${chave === \'atividades\' ? \'QUADRO DE ATIVIDADES\' : \'QUADRO DE PROJETOS\'}</span><h3>${esc(P.quadro.nome || \'Portfólio de Projetos\')}</h3></div>${acoesQuadro(chave)}');
  js = aplicar(js, "<thead><tr><th>Projeto</th>${colunas.map(c => `<th>${esc(c.titulo)}</th>`).join('')}</tr></thead>", "<thead><tr><th>${chave === 'atividades' ? 'Atividade' : 'Projeto'}</th>${colunas.map(c => `<th>${esc(c.titulo)}</th>`).join('')}<th></th></tr></thead>");
  js = aplicar(js, "${celulaProjeto(c, i.valores[c.id])}</td>`).join('') + '</tr>';", "${celulaProjeto(c, i.valores[c.id])}</td>`).join('') + `<td class=\"cx-q-acoes\"><button class=\"cx-btn cx-mini\" data-quadro-editar=\"${chave}|${esc(i.item_id)}\">Editar</button></td></tr>`;");
  // --- Compras em grupos ---
  js = aplicar(js, '    const corpo = lista.map(r => ', '    const corpoDe = itens => itens.map(r => ');
  js = aplicar(js, '    const fichas = lista.map(r => ', '    const fichasDe = itens => itens.map(r => ');
  js = aplicar(js, "<td>${esc(r.comprador) || 'A definir'}</td><td>${etiqueta(r.etapa, r.etapa === 'Aprovada' ? 'verde' : '')}</td>${anexo(r, 'rm')}", "<td>${esc(r.comprador) || 'A definir'}</td>${anexo(r, 'rm')}");
  js = aplicar(js, "<div class=\"cx-ficha-topo\"><span>${esc(r.id)}</span>${etiqueta(r.etapa, r.etapa === 'Aprovada' ? 'verde' : '')}</div><div class=\"cx-ficha-titulo\"><span class=\"cx-kicker\">${unidade(r.unidade)} <span> / </span> ${esc(r.tipo)}</span>",
    "<div class=\"cx-ficha-topo\"><span>${esc(r.id)}</span></div><div class=\"cx-ficha-titulo\"><span class=\"cx-kicker\">${unidade(r.unidade)} <span> / </span> ${esc(r.tipo)}</span>");
  js = aplicar(js, '    return `<header class="cx-editorial cx-editorial-compras">', trechos.compras + '    return `<header class="cx-editorial cx-editorial-compras">');
  const ini = js.indexOf("${lista.length ? visaoReq === 'cartoes' ?"), marcaFim = "vazio('Nenhuma requisição neste indicador.')}", fim = js.indexOf(marcaFim, ini);
  if (ini < 0 || fim < 0) throw Error('Lista de requisições de Compras mudou.');
  js = js.slice(0, ini) + "${lista.length ? gruposCompra : vazio('Nenhuma requisição neste indicador.')}" + js.slice(fim + marcaFim.length);
  return js;
}

// Banco da demonstração: contratos que se pode criar e, só na demonstração, Projetos/Portfólio liberados por perfil.
export function comBancoDemoExpansao(js) {
  js = aplicar(js, 'get contratos(){ return CONTRATOS_DEMO; },', `get contratos(){ return banco.contratos || (banco.contratos = JSON.parse(JSON.stringify(CONTRATOS_DEMO))); },
    criarContrato(dados){ const c = { ...dados, id:'C-' + Date.now().toString(36), origem:'painel', criadoEm:new Date().toISOString() }; this.contratos.push(c); salvar(); return c; },
    criarAditivo(paiId, dados, _descricao){
      const pai = this.contratos.find(x => x.id === paiId);
      if (!pai) throw Error('Todo aditivo precisa estar vinculado a um contrato existente.');
      const a = { ...dados, id:'C-' + Date.now().toString(36), origem:'painel', criadoEm:new Date().toISOString() }; this.contratos.push(a); (pai.aditivos ||= []).push(a.id); salvar(); return a;
    },
    get projetosPorPerfil(){ return true; },
    get atividades(){ return this._atividades ||= { quadro:{ nome:'Atividades', espelhadoEm:new Date().toISOString(), grupos:[{ id:'group_title', titulo:'Obras/Facilities' }, { id:'group_mkzzh988', titulo:'Projetos/ Licenciamento' }],
      colunas:[{ id:'name', titulo:'Name', tipo:'name' }, { id:'text_mkzz5846', titulo:'Local', tipo:'text' }, { id:'text_mkzzcnhq', titulo:'Departamento', tipo:'text' }, { id:'text_mm0abhnh', titulo:'Responsável', tipo:'text' },
        { id:'status', titulo:'Andamento do projeto', tipo:'status', cores:{ 'Cancelado':'#df2f4a', 'Concluído':'#00c875', 'Em Andamento':'#007eb5', 'Não Iniciado':'#9d50dd' } }, { id:'numeric_mkzzyep1', titulo:'Custo Estimado', tipo:'numbers' }, { id:'timerange_mkzz599t', titulo:'Cronograma Planejado', tipo:'timeline' }], subColunas:[] },
      itens:[{ item_id:'A-1', grupo_id:'group_title', ordem:0, nome:'Pintura da portaria', valores:{ text_mkzz5846:{ t:'Sorocaba' }, status:{ t:'Em Andamento' }, numeric_mkzzyep1:{ t:'12000' } }, subitens:[] },
        { item_id:'A-2', grupo_id:'group_mkzzh988', ordem:1, nome:'Licença ambiental Bauru', valores:{ text_mkzz5846:{ t:'Araraquara' }, status:{ t:'Não Iniciado' } }, subitens:[] }] }; },
    salvarItemQuadro(chave, id, d){
      const P = chave === 'atividades' ? this.atividades : PROJETOS_DEMO;
      const g = P.quadro.grupos.find(x => x.id === d.grupo); if (!g) throw Error('Escolha o grupo.');
      if (id){ const i = P.itens.find(x => x.item_id === id); Object.assign(i, { nome:d.nome, grupo_id:d.grupo, valores:{ ...i.valores, ...d.valores } }); }
      else P.itens.push({ item_id:'P-' + Date.now().toString(36), grupo_id:d.grupo, ordem:P.itens.length, nome:d.nome, valores:d.valores, subitens:[] });
    },
    editarContrato(id, d){
      const c = this.contratos.find(x => x.id === id); if (!c) throw Error('Contrato não encontrado.');
      const aditivo = c.tipo === 'Aditivo' || c.grupo === 'Aditivos';
      if (aditivo){
        const novoPai = this.contratos.find(x => x.id === d.contratoPai); if (!novoPai) throw Error('Todo aditivo precisa estar vinculado a um contrato.');
        for (const x of this.contratos) if ((x.aditivos || []).includes(id) && x.id !== novoPai.id) x.aditivos = x.aditivos.filter(a => a !== id);
        if (!(novoPai.aditivos ||= []).includes(id)) novoPai.aditivos.push(id);
      } else {
        c.tipo = d.tipo;
        c.grupo = d.status === 'Encerrado' ? 'Contratos finalizados' : ({ 'Contrato Global':'Contratos Globais', 'Contrato':'Contratos', 'Contrato - Faturamento direto':'Contrato - Faturamento direto' })[d.tipo];
      }
      Object.assign(c, { nome:d.nome, unidade:d.unidade, valorFechado:d.valorFechado, status:d.status, aceite:d.aceite, cnpj:d.cnpj, referencia:d.referencia, tipologia:d.tipologia, aprovador:d.aprovador });
      salvar();
    },
    async anexarContrato(contratoId, arquivo){
      const c = this.contratos.find(x => x.id === contratoId); if (!c) throw Error('Contrato não encontrado.');
      const id = 'ctr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await this.arquivos.guardar(id, arquivo);
      (c.arquivos ||= []).push({ id, nome:arquivo.name, por:'Marcos', em:new Date().toISOString() }); salvar();
    },`);
  js = aplicar(js, 'get projetos(){ return this.projetosAcesso ? PROJETOS_DEMO : null; },', 'get projetos(){ return PROJETOS_DEMO; },');
  // Pessoas da demonstração (matriz de acessos de 14/11): Otávio (administração) e Bruno Alves (lançamento); o engenheiro vira "Bruno N.".
  js = aplicar(js, "nome:'Bruno', perfil:'engenharia'", "nome:'Bruno N.', perfil:'engenharia'");
  js = aplicar(js, "    { email:'marina.costa@empresa.exemplo',", "    { email:'otavio.reis@holding.exemplo', nome:'Otávio', perfil:'admin', rotulo:'Administração · vê tudo' },\n    { email:'bruno.alves@empresa.exemplo', nome:'Bruno A.', perfil:'equipe', rotulo:'Equipe de lançamento' },\n    { email:'marina.costa@empresa.exemplo',");
  return js;
}
