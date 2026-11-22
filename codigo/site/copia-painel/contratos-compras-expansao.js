//@@ projetos
  // Projetos e Portfólio (Gustavo, 14/11): Projetos para a administração, a equipe de lançamento e os engenheiros; Portfólio para quem está na lista de
  // acesso (Marcos e Gustavo) e para os engenheiros, estes só para ver. D.projetosPorPerfil liga a regra por perfil (demonstração); no banco real
  // continua valendo a lista de acesso até as permissões serem separadas.
  const EMAIL_MARCOS = 'marcos.prado@holding.exemplo';
  const verProjetos = p => !!D.projetosAcesso || (!!D.projetosPorPerfil && ['admin', 'equipe', 'engenharia'].includes(p.perfil));
  // No banco real o Portfólio tem permissão própria (portfolioAcesso/portfolioEdita); na demonstração vale a lista + engenheiros.
  const verPortfolio = p => D.portfolioAcesso !== undefined ? !!D.portfolioAcesso : (!!D.projetosAcesso || (!!D.projetosPorPerfil && p.perfil === 'engenharia'));
  const podeMexerPortfolio = p => D.portfolioEdita !== undefined ? !!D.portfolioEdita : !!D.projetosAcesso;   // Marcos e Gustavo. Engenheiros só veem.
  // 19/11/2026 (Gustavo): sem a aba "Portfólio (Monday)" (site que lia a Monday). Fica o Portfólio do nosso sistema.
  const areasDe = p => [...ACESSO[p.perfil], ...(verProjetos(p) ? ['projetos'] : []), ...(verPortfolio(p) ? ['portfolioNosso'] : [])];
//@@ contratos
  // ---- Criar contrato e aditivo (Gustavo, 14/11): só o Marcos mexe em Contratos; os demais só consultam. Aditivo exige um contrato. ----
  // 19/11/2026 (Gustavo, pedido do Rafael): os engenheiros da Expansão também criam contratos e aditivos e anexam documentos.
  // Alterar: Marcos e Gustavo em todos; o engenheiro só nos que ele criou. Excluir: só Marcos e Gustavo. O banco confere as mesmas regras.
  const ehAdmContratos = () => [EMAIL_MARCOS, 'gustavo@empresa.exemplo'].includes(String(pessoa?.email || '').toLowerCase());
  const podeMexerContratos = () => !!D.criarContrato && (ehAdmContratos() || pessoa?.perfil === 'engenharia');
  const podeEditarContrato = c => !!D.criarContrato && (ehAdmContratos() || (pessoa?.perfil === 'engenharia' && !!c && String(c.criadoPor || '').toLowerCase() === String(pessoa?.email || '').toLowerCase()));
  const TIPOS_CONTRATO = ['Contrato Global', 'Contrato', 'Contrato - Faturamento direto'];
  const GRUPO_DO_TIPO = { 'Contrato Global':'Contratos Globais', 'Contrato':'Contratos', 'Contrato - Faturamento direto':'Contrato - Faturamento direto' };
  const paiDeAditivo = c => (D.contratos || []).find(x => (x.aditivos || []).includes(c.id));
  const numeroBR = v => { const s = String(v ?? '').trim(); if (!s) return NaN; return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); };
  // Documentos: escolhidos no formulário e enviados logo depois de criar (contrato ou aditivo). Também dá para anexar depois (botão "+" na linha).
  // ---- Unidades completas (Gustavo, 14/11): todas as bases Holding, em ordem de código, mais qualquer unidade que já exista nos contratos ----
  const UNIDADES_HOLDING = [['001','SOROCABA'],['002','AMERICANA'],['003','ILHÉUS'],['004','CAMPINA GRANDE'],['005','LONDRINA'],['006','PELOTAS'],['007','ANÁPOLIS'],['008','CONTAGEM'],['009','NITERÓI'],['010','CASCAVEL'],['011','MARÍLIA'],['012','JOINVILLE'],['013','MONTES CLAROS'],['014','PALMAS'],['015','IPATINGA'],['016','FEIRA DE SANTANA'],['017','BLUMENAU'],['018','MARINGÁ'],['019','PINHAL'],['020','ARARAQUARA'],['021','GUARAPARI'],['022','ITATIBA'],['099','CORPORATIVO'],['201','FILIAL B AMERICANA'],['202','FILIAL B ANÁPOLIS'],['203','FILIAL B CAMPINA GRANDE'],['701','COMÉRCIO']];
  function listaUnidades(){
    const mapa = new Map(UNIDADES_HOLDING.map(([c, n]) => [c, `${c} - ${n}`]));
    for (const c of D.contratos || []){ const k = R.unidadeChave(c.unidade); if (k && !mapa.has(k)) mapa.set(k, String(c.unidade).trim()); }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric:true })).map(([, l]) => l);
  }
  const opcaoUnidade = (atual = '') => '<option value="">Selecione a unidade</option>' + listaUnidades().map(l => `<option${atual && R.unidadeChave(l) === R.unidadeChave(atual) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  // Tipologia em lista (Gustavo, 14/11): as tipologias que já existem nos contratos.
  function listaTipologias(){
    const s = new Set(['Civil', 'Mecânica', 'Elétrica']);
    for (const c of D.contratos || []){ const t = String(c.tipologia || '').trim(); if (!t) continue; s.add(t); t.split(',').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x)); }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  const opcaoTipologia = (atual = '') => '<option value="">Selecione a tipologia</option>' + [...(atual && !listaTipologias().includes(atual) ? [atual] : []), ...listaTipologias()].map(t => `<option${t === atual ? ' selected' : ''}>${esc(t)}</option>`).join('') + '<option value="__nova">+ Adicionar outra tipologia…</option>';
  const campoTipologia = (id, atual = '', dis = '') => `<label class="cx-campo">Tipologia<select id="${id}" data-tipologia ${dis}>${opcaoTipologia(atual)}</select><input id="${id}Nova" class="cx-tip-nova" placeholder="Digite a nova tipologia" autocomplete="off" hidden ${dis}></label>`;
  const tipologiaEscolhida = id => { const s = $('#' + id); return s.value === '__nova' ? ($('#' + id + 'Nova').value.trim()) : s.value; };
  document.addEventListener('change', e => { const s = e.target.closest?.('[data-tipologia]'); if (!s) return; const n = $('#' + s.id + 'Nova'); n.hidden = s.value !== '__nova'; if (!n.hidden) n.focus(); });

  // ---- Arquivos do contrato separados por dono: o contrato e cada aditivo, cada um com o seu título (Gustavo, 14/11) ----
  function gradeArquivosSegregada(c, arqs){
    const grupos = new Map();
    for (const a of arqs){ const k = (a.dono || 'Contrato') + '|' + (a.donoNome || c.nome); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(a); }
    const ordem = [...grupos.keys()].sort((x, y) => (x.startsWith('Contrato|') ? 0 : 1) - (y.startsWith('Contrato|') ? 0 : 1));
    return '<p class="cx-sub">Os arquivos do contrato e os de cada aditivo aparecem separados. Clique para abrir ao lado.</p>' + ordem.map(k => {
      const [dono, nome] = k.split('|'), lista = grupos.get(k);
      return `<div class="cx-arq-dono"><h5><span class="cx-etq ${dono === 'Contrato' ? 'verde' : 'ambar'}">${dono === 'Contrato' ? 'CONTRATO' : 'ADITIVO'}</span> ${esc(nome)} <small>${lista.length} arquivo(s)</small></h5><div class="cx-grade">${lista.map(a => `<div class="cx-item"><button class="cx-arq media" data-arquivo="contrato:${esc(c.id)}|docs|${esc(a.id)}" data-mini="${esc(a.id)}" title="${esc(a.nome)}" aria-label="Abrir ${esc(a.nome)} (${dono.toLowerCase()})"><span>${esc(extensao(a.nome))}</span></button><small title="${esc(a.nome)}">${esc(a.nome)}${a.sub ? ' · ' + esc(a.sub) : ''}</small></div>`).join('')}</div></div>`;
    }).join('');
  }

  // ---- Indicadores de Compras (Procedimento Técnico de Compras, Engenharia de Expansão, 12/11/2025, item 9) ----
  // SLA: cotação em 7 dias úteis com no mínimo 3 cotações; aprovação da engenharia em 3 dias úteis; pedido confirmado em 24 h após aprovar.
  // Os tempos vêm do histórico de cada requisição. Dias úteis = segunda a sexta (feriados não descontados).
  const UM_DIA = 864e5;
  function diasUteis(de, ate){
    let t = new Date(de).getTime(); const fim = new Date(ate).getTime(); let n = 0;
    if (!(fim > t)) return 0;
    while (t < fim){ const passo = Math.min(UM_DIA - (t % UM_DIA), fim - t), dia = new Date(t).getUTCDay(); if (dia !== 0 && dia !== 6) n += passo / UM_DIA; t += passo; }
    return n;
  }
  const evento = (r, re) => (r.eventos || []).find(e => re.test(e.texto));
  const media = l => l.length ? l.reduce((s, v) => s + v, 0) / l.length : null;
  const fmtDias = v => v == null ? '—' : v < 1 ? `${Math.round(v * 24)} h úteis` : `${v.toFixed(1).replace('.', ',')} dias úteis`;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  function painelIndicadoresCompras(lista){
    const agora = new Date();
    const cot = lista.map(r => ({ r, fim:evento(r, /^Negociação concluída/) })).filter(x => x.fim).map(x => ({ ...x, dias:diasUteis(x.r.criadaEm, x.fim.em) }));
    const cotAbertas = lista.filter(r => ['Aguardando Compras', 'Em cotação'].includes(r.etapa)).map(r => diasUteis(r.criadaEm, agora));
    const tres = cot.filter(x => (x.r.anexos?.propostas || []).length >= 3).length;
    const apr = cot.map(x => ({ ...x, dec:(x.r.eventos || []).find(e => /^(Engenharia aprovou|Requisição recusada|Ajuste solicitado)/.test(e.texto) && e.em >= x.fim.em) })).filter(x => x.dec).map(x => ({ ...x, dias:diasUteis(x.fim.em, x.dec.em) }));
    const aprAbertas = cot.filter(x => x.r.etapa === 'Aguardando Engenharia').map(x => diasUteis(x.fim.em, agora));
    const fechamento = lista.filter(r => r.etapa === 'Aguardando fechamento').map(r => { const a = evento(r, /^Engenharia aprovou/); return a ? (agora - new Date(a.em)) / 36e5 : null; }).filter(v => v != null);
    const fechados = lista.map(r => ({ a:evento(r, /^Engenharia aprovou/), f:evento(r, /^Fechamento concluído/) })).filter(x => x.a && x.f).map(x => (new Date(x.f.em) - new Date(x.a.em)) / 36e5);
    const entregues = lista.filter(r => r.etapa === 'Entrega concluída' && r.dataEntrega), noPrazo = entregues.filter(r => r.prazoDesejado && String(r.dataEntrega).slice(0, 10) <= String(r.prazoDesejado).slice(0, 10)).length;
    const entregaAtrasada = lista.filter(r => r.etapa === 'Aguardando entrega' && r.prazoDesejado && String(r.prazoDesejado).slice(0, 10) < agora.toISOString().slice(0, 10)).length;
    const cartao = (titulo, valor, meta, detalhe, ok) => `<div class="cx-ind ${ok === true ? 'ok' : ok === false ? 'alerta' : ''}"><span>${titulo}</span><b>${valor}</b><small>${meta}</small><small>${detalhe}</small></div>`;
    const dentroCot = cot.filter(x => x.dias <= 7).length, dentroApr = apr.filter(x => x.dias <= 3).length;
    return `<section class="cx-contratos-grupo cx-indicadores-compras"><h4>Indicadores do procedimento de Compras <span>${lista.length}</span><small>Procedimento Técnico · Engenharia de Expansão · 12/11/2025</small></h4>
      <div class="cx-inds">
        ${cartao('Prazo médio de cotação', fmtDias(media(cot.map(x => x.dias))), 'Meta: até 7 dias úteis', `${dentroCot} de ${cot.length} no prazo (${pct(dentroCot, cot.length)}) · ${cotAbertas.filter(d => d > 7).length} em aberto atrasada(s)`, cot.length ? dentroCot === cot.length && !cotAbertas.some(d => d > 7) : null)}
        ${cartao('Mínimo de 3 cotações', pct(tres, cot.length), 'Meta: 3 propostas por requisição', `${tres} de ${cot.length} chegaram à engenharia com 3 ou mais propostas anexadas`, cot.length ? tres === cot.length : null)}
        ${cartao('Prazo médio de aprovação', fmtDias(media(apr.map(x => x.dias))), 'Meta: até 3 dias úteis', `${dentroApr} de ${apr.length} no prazo (${pct(dentroApr, apr.length)}) · ${aprAbertas.filter(d => d > 3).length} aguardando a engenharia há mais de 3 dias úteis`, apr.length ? dentroApr === apr.length && !aprAbertas.some(d => d > 3) : null)}
        ${cartao('Confirmação do pedido', fechados.length ? `${Math.round(media(fechados))} h em média` : '—', 'Meta: até 24 h após a aprovação', `${fechados.filter(h => h <= 24).length} de ${fechados.length} no prazo (${pct(fechados.filter(h => h <= 24).length, fechados.length)}) · ${fechamento.filter(h => h > 24).length} aguardando fechamento há mais de 24 h`, fechados.length || fechamento.length ? !fechados.some(h => h > 24) && !fechamento.some(h => h > 24) : null)}
        ${cartao('Cumprimento do prazo de entrega', pct(noPrazo, entregues.length), 'Entrega até o prazo desejado da RM', `${noPrazo} de ${entregues.length} entregues no prazo · ${entregaAtrasada} aguardando entrega com o prazo vencido`, entregues.length || entregaAtrasada ? noPrazo === entregues.length && !entregaAtrasada : null)}
        ${cartao('Não conformidades', '—', 'Percentual de compras com não conformidade', 'Ainda sem registro de recebimento/não conformidade no painel', null)}
      </div></section>`;
  }
  if (!document.getElementById('cxIndicadoresEstilo')){ const st = document.createElement('style'); st.id = 'cxIndicadoresEstilo';
    st.textContent = '.cx-inds{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:10px 0 26px}'
      + '.cx-ind{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--cx-border);border-left:3px solid var(--cx-border);border-radius:3px;background:var(--cx-card)}'
      + '.cx-ind.ok{border-left-color:#1f9d55}.cx-ind.alerta{border-left-color:var(--cx-red)}'
      + '.cx-ind>span{font-size:10px;color:var(--cx-muted);text-transform:uppercase;letter-spacing:.06em}.cx-ind b{font:500 22px var(--cx-serif,serif)}.cx-ind small{font-size:11px;color:var(--cx-muted);line-height:1.45}'
      + '.cx-fases{grid-template-columns:repeat(6,minmax(0,1fr))}.cx-tip-nova{display:block;width:100%;box-sizing:border-box;margin-top:6px}.cx-req-passo{margin-right:6px}'
      + '.cx-arq-dono{margin:10px 0 14px}.cx-arq-dono h5{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;font-size:12px}.cx-arq-dono h5 small{color:var(--cx-muted);font-weight:400}'
      // Campos sem o contorno branco ao clicar (Gustavo, 14/11): o campo continua com a mesma aparência quando recebe o foco.
      + 'body.cx-experiencia :is(input,select,textarea):is(:focus,:focus-visible){outline:none!important;box-shadow:none!important}'
      + 'body.cx-experiencia .cx-campo :is(input,select,textarea):focus{border-color:var(--cx-border)!important}'
      + 'body.cx-experiencia :is(.cx-busca,.cx-grupo-busca,#cxAdBusca,.cx-filtros select,.cx-filtros input):focus{border-color:var(--cx-border)!important}';
    document.head.appendChild(st); }
  const campoArquivos = id => `<label class="cx-campo">Documentos (contrato, proposta, planilha…)<input type="file" id="${id}" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.zip"><small class="cx-sub">Opcional. Até 50 MB por arquivo.</small></label>`;
  async function anexarAoContrato(id, arquivos){
    if (!arquivos.length) return 0;
    if (!D.anexarContrato) throw Error('Anexo de contrato indisponível nesta versão.');
    let feitos = 0;
    for (const f of arquivos){
      if (f.size > 52428800) throw Error(`${f.name} passa de 50 MB.`);
      aviso(`Enviando ${f.name}…`);
      await D.anexarContrato(id, f, false); feitos++;
    }
    if (D.recarregarContratos) await D.recarregarContratos();
    return feitos;
  }
  // Depois de criar: limpa a busca de Contratos, abre o grupo e rola até a linha nova, destacada.
  function destacarContrato(id){
    filtros.contratos = filtroVazio(); aba = 'contrato'; desenhar();
    const tr = $(`#cxArea tr[data-contrato-linha="${CSS.escape(id)}"]`); if (!tr) return;
    const sec = tr.closest('.cx-contratos-grupo'), h = sec?.querySelector(':scope > h4');
    if (sec?.classList.contains('cx-recolhido') && h){ recolhidos.delete(chaveGrupo(h)); try { localStorage.setItem(GRUPOS_CHAVE, JSON.stringify([...recolhidos])); } catch (_) {} setasGrupos(); }
    tr.classList.add('cx-contrato-piscar'); tr.scrollIntoView({ block:'center', behavior:'smooth' });
    setTimeout(() => tr.classList.remove('cx-contrato-piscar'), 4000);
  }
  function abrirNovoContrato(){
    abrirDialogo('Novo contrato', `<p class="cx-sub">Cria o contrato no painel. Só o Marcos cria e altera contratos e aditivos.</p>
      <label class="cx-campo">Prestador (nome do contrato)<input id="cxCtNome" autocomplete="off" placeholder="Nome do prestador"></label>
      <div class="cx-duas"><label class="cx-campo">Tipo<select id="cxCtTipo">${TIPOS_CONTRATO.map(t => `<option>${esc(t)}</option>`).join('')}</select></label><label class="cx-campo">Unidade<select id="cxCtUnidade">${opcaoUnidade()}</select></label></div>
      <div class="cx-duas"><label class="cx-campo">Valor fechado (R$)<input id="cxCtValor" inputmode="decimal" autocomplete="off" placeholder="0,00"></label><label class="cx-campo">Aceite<input type="date" id="cxCtAceite"></label></div>
      <div class="cx-duas"><label class="cx-campo">CNPJ<input id="cxCtCnpj" autocomplete="off"></label><label class="cx-campo">Referência<input id="cxCtRef" autocomplete="off"></label></div>
      ${campoTipologia('cxCtTip')}
      ${campoArquivos('cxCtArquivos')}
      <div class="cx-acoes"><button class="cx-btn forte" data-salvar-contrato="contrato">Criar contrato</button></div>`);
    $('#cxCtNome').focus();
  }
  // Lista do aditivo (Gustavo, 14/11): cada contrato com o máximo de informação (valores, aditivos, saldo, CNPJ, referência…), com busca.
  const textoContratoBusca = c => R.normalizar([c.nome, c.cnpj, c.referencia, c.unidade, R.nomeUnidade(c.unidade), c.tipologia, c.tipo, c.aprovador, c.status].join(' '));
  const opcaoPai = c => `<button type="button" class="cx-ad-op" role="option" aria-selected="false" data-ad-pai="${esc(c.id)}" data-texto="${esc(textoContratoBusca(c))}">
      <span class="cx-ad-linha1"><b>${esc(c.nome)}</b>${etiqueta(c.tipo || '—')}${etiqueta(c.status || '—', c.status === 'Ativo' ? 'verde' : '')}</span>
      <small>${esc(R.nomeUnidade(c.unidade))} · Ref. ${esc(c.referencia || '—')} · CNPJ ${esc(c.cnpj || '—')} · Tipologia ${esc(c.tipologia || '—')} · Aceite ${dataBR(c.aceite)}</small>
      <span class="cx-ad-valores"><span>Valor fechado <b>${dinheiro(c.valorFechado)}</b></span><span>Aditivos <b>${dinheiro(c.aditivo)}</b> (${(c.aditivos || []).length})</span><span>Valor total <b>${dinheiro(c.total)}</b></span><span>Pago <b>${dinheiro(c.pago)}</b></span><span>Saldo <b class="${c.saldo < 0 ? 'cx-negativo' : ''}">${dinheiro(c.saldo)}</b></span><span>Notas <b>${c.notasIds.length}</b></span><span>Arquivos <b>${arquivosContrato(c).length}</b></span></span>
    </button>`;
  function abrirNovoAditivo(){
    abrirDialogo('Novo aditivo', `<p class="cx-sub">Todo aditivo precisa estar vinculado a um contrato. O valor do aditivo soma ao valor total do contrato.</p>
      <div class="cx-campo">Contrato do aditivo (obrigatório)
${seletorPai()}
      </div>
      <label class="cx-campo">Descrição do aditivo<input id="cxAdNome" autocomplete="off" placeholder="Ex.: ADITIVO 2"></label>
      <div class="cx-duas"><label class="cx-campo">Valor do aditivo (R$)<input id="cxAdValor" inputmode="decimal" autocomplete="off" placeholder="0,00"></label><label class="cx-campo">Aceite<input type="date" id="cxAdAceite"></label></div>
      ${campoArquivos('cxAdArquivos')}
      <div class="cx-acoes"><button class="cx-btn forte" data-salvar-contrato="aditivo">Criar aditivo</button></div>`);
    ligarBuscaPai(); $('#cxAdBusca').focus();
  }
  const seletorPai = (escolhido = '') => `<input id="cxAdBusca" type="search" autocomplete="off" placeholder="Buscar por prestador, CNPJ, referência, unidade, tipologia… (várias palavras)" aria-controls="cxAdLista">
        <div id="cxAdLista" class="cx-ad-lista" role="listbox" aria-label="Contratos">${paisPossiveis().map(opcaoPai).join('') || '<p class="cx-sub">Nenhum contrato ativo.</p>'}</div>
        <p id="cxAdNada" class="cx-sub" hidden>Nenhum contrato encontrado.</p>
        <input type="hidden" id="cxAdPai" value="${esc(escolhido || '')}">
        <div id="cxAdEscolhido" class="cx-ad-escolhido" role="status">Nenhum contrato escolhido.</div>`;
  function ligarBuscaPai(){
    $('#cxAdBusca').addEventListener('input', e => {
      let n = 0;
      $$('#cxAdLista [data-ad-pai]').forEach(op => { const ok = R.contem(op.dataset.texto, e.target.value); op.hidden = !ok; if (ok) n++; });
      $('#cxAdNada').hidden = n > 0;
    });
  }
  function escolherPai(op, editando = false){
    $$('#cxAdLista [data-ad-pai]').forEach(x => x.setAttribute('aria-selected', String(x === op)));
    $('#cxAdPai').value = op.dataset.adPai;
    const c = calcContratos().find(x => x.id === op.dataset.adPai);
    $('#cxAdEscolhido').innerHTML = c ? `Escolhido: <b>${esc(c.nome)}</b> · total ${dinheiro(c.total)} · saldo ${dinheiro(c.saldo)} · ${(c.aditivos || []).length} aditivo(s). ${editando ? '' : `Este será o aditivo ${(c.aditivos || []).length + 1}.`}` : '';
    if (!editando && $('#cxAdNome')) $('#cxAdNome').placeholder = 'Ex.: ADITIVO ' + ((c?.aditivos || []).length + 1);
  }
  document.addEventListener('click', e => { const op = e.target.closest?.('#cxAdLista [data-ad-pai]'); if (op) escolherPai(op); });
  // ---- Editar contrato e aditivo (Gustavo, 14/11): botão "Editar" em cada linha e na janela do contrato. Só o Marcos salva. ----
  // Aditivo: dá para trocar o contrato ao qual ele pertence (continua obrigatório). Status "Encerrado" leva o contrato para "Contratos finalizados".
  const paisPossiveis = () => calcContratos().filter(c => c.tipo !== 'Aditivo' && c.grupo !== 'Aditivos' && c.grupo !== 'Contratos finalizados' && c.status !== 'Encerrado').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ehAditivo = c => c.tipo === 'Aditivo' || c.grupo === 'Aditivos';
  const opcoesCom = (lista, atual) => [...(atual && !lista.includes(atual) ? [atual] : []), ...lista].map(v => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
  function abrirEditarContrato(id){
    const c = (D.contratos || []).find(x => x.id === id); if (!c) return aviso('Contrato não encontrado.');
    const pode = podeEditarContrato(c), dis = pode ? '' : 'disabled';
    const v = campo => esc(c[campo] || '');
    const comum = `<div class="cx-duas"><label class="cx-campo">${ehAditivo(c) ? 'Valor do aditivo' : 'Valor fechado'} (R$)<input id="cxEdValor" inputmode="decimal" autocomplete="off" value="${esc(String(c.valorFechado ?? '').replace('.', ','))}" ${dis}></label><label class="cx-campo">Aceite<input type="date" id="cxEdAceite" value="${esc(String(c.aceite || '').slice(0, 10))}" ${dis}></label></div>
      <div class="cx-duas"><label class="cx-campo">Status<select id="cxEdStatus" ${dis}>${opcoesCom(['Ativo', 'Encerrado'], c.status || 'Ativo')}</select></label><label class="cx-campo">Unidade<select id="cxEdUnidade" ${dis}>${opcaoUnidade(c.unidade)}</select></label></div>
      <div class="cx-duas"><label class="cx-campo">CNPJ<input id="cxEdCnpj" autocomplete="off" value="${v('cnpj')}" ${dis}></label><label class="cx-campo">Referência<input id="cxEdRef" autocomplete="off" value="${v('referencia')}" ${dis}></label></div>
      ${campoTipologia('cxEdTip', c.tipologia || '', dis)}`;
    const pai = ehAditivo(c) ? paiDeAditivo(c) : null;
    const corpo = ehAditivo(c)
      ? `<label class="cx-campo">Nome do aditivo<input id="cxEdNome" autocomplete="off" value="${v('nome')}" ${dis}></label>
         <div class="cx-campo">Contrato do aditivo (obrigatório)${seletorPai(pai?.id)}</div>${comum}`
      : `<label class="cx-campo">Prestador (nome do contrato)<input id="cxEdNome" autocomplete="off" value="${v('nome')}" ${dis}></label>
         <label class="cx-campo">Tipo<select id="cxEdTipo" ${dis}>${opcoesCom(TIPOS_CONTRATO, TIPOS_CONTRATO.includes(c.tipo) ? c.tipo : 'Contrato')}</select></label>${comum}`;
    abrirDialogo((ehAditivo(c) ? 'Editar aditivo · ' : 'Editar contrato · ') + c.nome, `${pode ? '' : '<p class="cx-sub">Somente visualização: você altera só os contratos que criou. Os demais: Marcos ou Gustavo.</p>'}${corpo}
      <div class="cx-acoes"><button class="cx-btn forte" data-salvar-edicao="${esc(c.id)}" ${dis}>Salvar alterações</button><button class="cx-btn" data-anexar-contrato="${esc(c.id)}" ${podeMexerContratos() ? '' : 'disabled'}>+ Anexar documentos</button>${ehAdmContratos() && D.excluirContrato ? `<button class="cx-btn" data-excluir-contrato="${esc(c.id)}" style="color:#e05a5a;margin-left:auto">Excluir ${ehAditivo(c) ? 'aditivo' : 'contrato'}</button>` : ''}</div>`);
    if (ehAditivo(c)){ ligarBuscaPai(); const op = pai && $(`#cxAdLista [data-ad-pai="${CSS.escape(pai.id)}"]`); if (op){ escolherPai(op, true); op.scrollIntoView({ block:'nearest' }); } }
  }
  document.addEventListener('click', async e => {
    const ed = e.target.closest?.('[data-editar-contrato]'); if (ed) return abrirEditarContrato(ed.dataset.editarContrato);
    const ex = e.target.closest?.('[data-excluir-contrato]');
    if (ex){ ex.outerHTML = `<span class="cx-sub" style="margin-left:auto">Excluir de vez? Fica uma cópia guardada.</span> <button class="cx-btn cx-perigo" data-excluir-sim="${ex.dataset.excluirContrato}">Sim, excluir</button>`; return; }
    const exs = e.target.closest?.('[data-excluir-sim]');
    if (exs){ exs.disabled = true; try { const nome = await D.excluirContrato(exs.dataset.excluirSim); fechar(); aviso('Excluído: ' + nome); } catch (erro) { exs.disabled = false; aviso(erro.message); } return; }
    const b = e.target.closest?.('[data-salvar-edicao]'); if (!b) return;
    const id = b.dataset.salvarEdicao, c = (D.contratos || []).find(x => x.id === id); if (!c) return;
    if (!podeEditarContrato(c)) return aviso('Você altera só os contratos e aditivos que criou. Os demais: Marcos ou Gustavo.');
    const dados = { nome:$('#cxEdNome').value.trim().toUpperCase(), tipo:ehAditivo(c) ? 'Aditivo' : $('#cxEdTipo').value, unidade:$('#cxEdUnidade').value, valorFechado:numeroBR($('#cxEdValor').value),
      status:$('#cxEdStatus').value, aceite:$('#cxEdAceite').value || '', cnpj:$('#cxEdCnpj').value.trim(), referencia:$('#cxEdRef').value.trim(), tipologia:tipologiaEscolhida('cxEdTip'), aprovador:c.aprovador || '',
      contratoPai:ehAditivo(c) ? $('#cxAdPai').value : null };
    if (!dados.nome) return aviso('Informe o nome.');
    if (!dados.unidade) return aviso('Escolha a unidade.');
    if (!(dados.valorFechado >= 0)) return aviso('Informe o valor.');
    if (ehAditivo(c) && !dados.contratoPai) return aviso('Escolha o contrato: todo aditivo precisa estar vinculado a um contrato.');
    b.disabled = true;
    try { await D.editarContrato(id, dados); fechar(); destacarContrato(id); aviso('Alterações salvas.'); }
    catch (erro) { b.disabled = false; aviso(erro.message); }
  });
  if (!document.getElementById('cxAditivoEstilo')){ const st = document.createElement('style'); st.id = 'cxAditivoEstilo';
    st.textContent = '.cx-ad-lista{max-height:330px;overflow:auto;margin-top:6px;border:1px solid var(--cx-border);border-radius:3px;background:var(--cx-card)}'
      + '.cx-ad-op{display:block;width:100%;box-sizing:border-box;text-align:left;padding:11px 13px;border:0;border-bottom:1px solid var(--cx-border);background:var(--cx-card);color:var(--cx-text);font:inherit;font-weight:400;cursor:pointer}'
      + '.cx-ad-op:hover{background:var(--cx-subtle)}.cx-ad-op[aria-selected=true]{background:var(--cx-blue-soft);box-shadow:inset 3px 0 var(--cx-blue)}.cx-ad-op[hidden]{display:none}'
      + '.cx-ad-linha1{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cx-ad-linha1 b{font-size:13px;margin-right:4px}'
      + '.cx-ad-op small{display:block;margin-top:4px;color:var(--cx-muted);font-size:11px;line-height:1.5}'
      + '.cx-ad-valores{display:flex;flex-wrap:wrap;gap:3px 16px;margin-top:6px;font-size:11px;color:var(--cx-muted)}.cx-ad-valores b{color:var(--cx-text);font-family:var(--cx-mono);font-weight:500}'
      + '.cx-ad-escolhido{margin-top:8px;padding:8px 10px;border-radius:3px;background:var(--cx-subtle);font-size:12px;font-weight:400}'
      + '.cx-anexar-linha{margin-left:4px}'
      + '.cx-contrato-novo td{background:var(--cx-blue-soft)}.cx-contrato-novo .cx-q-nota b::after{content:"CRIADO NO PAINEL";display:inline-block;margin-left:8px;padding:1px 5px;border-radius:2px;background:var(--cx-blue);color:#fff;font:600 8px var(--cx-mono);letter-spacing:.05em;vertical-align:middle}'
      + '@keyframes cxPiscar{0%,100%{box-shadow:none}50%{box-shadow:inset 0 0 0 2px var(--cx-blue)}}.cx-contrato-piscar td{animation:cxPiscar 1s ease 3}';
    document.head.appendChild(st); }
  document.addEventListener('click', async e => {
    const b = e.target.closest?.('[data-novo-contrato],[data-novo-aditivo],[data-salvar-contrato]');
    if (!b) return;
    if (!podeMexerContratos()) return aviso('Só os engenheiros da Expansão, o Marcos e o Gustavo criam contratos e aditivos.');
    if (b.hasAttribute('data-novo-contrato')) return abrirNovoContrato();
    if (b.hasAttribute('data-novo-aditivo')) return abrirNovoAditivo();
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      if (b.dataset.salvarContrato === 'contrato'){
        const nome = $('#cxCtNome').value.trim().toUpperCase(), tipo = $('#cxCtTipo').value, unidadeSel = $('#cxCtUnidade').value, valor = numeroBR($('#cxCtValor').value), arquivos = [...$('#cxCtArquivos').files];
        if (!nome) return aviso('Informe o prestador.');
        if (!unidadeSel) return aviso('Escolha a unidade.');
        if (!(valor >= 0)) return aviso('Informe o valor fechado.');
        b.disabled = true;
        const novo = await D.criarContrato({ nome, grupo:GRUPO_DO_TIPO[tipo], unidade:unidadeSel, tipologia:tipologiaEscolhida('cxCtTip'), tipo, status:'Ativo', aprovador:'', referencia:$('#cxCtRef').value.trim(), narrativa:'', valorFechado:valor, aceite:$('#cxCtAceite').value || '', cnpj:$('#cxCtCnpj').value.trim(), inclusao:hoje, aditivos:[], notas:[], subitens:[], arquivos:[] });
        let anexos = 0, falhou = '';
        try { anexos = await anexarAoContrato(novo.id, arquivos); } catch (erro) { falhou = erro.message; }
        fechar(); destacarContrato(novo.id); return aviso(falhou ? `Contrato criado, mas o anexo falhou: ${falhou} Anexe pelo botão "+" na linha do contrato.` : `Contrato criado${anexos ? ` com ${anexos} documento(s)` : ''}: está no topo do grupo ${GRUPO_DO_TIPO[tipo] === 'Contrato - Faturamento direto' || GRUPO_DO_TIPO[tipo] === 'Contratos Globais' ? 'Contratos' : 'Contratos'}, destacado.`);
      }
      const paiId = $('#cxAdPai').value, pai = (D.contratos || []).find(c => c.id === paiId), valor = numeroBR($('#cxAdValor').value), arquivos = [...$('#cxAdArquivos').files];
      if (!pai) return aviso('Escolha o contrato na lista: todo aditivo precisa estar vinculado a um contrato.');
      if (!(valor >= 0)) return aviso('Informe o valor do aditivo.');
      const descricao = $('#cxAdNome').value.trim().toUpperCase() || 'ADITIVO ' + ((pai.aditivos || []).length + 1);
      b.disabled = true;
      const novo = await D.criarAditivo(paiId, { nome:`${pai.nome} - ${descricao}`, descricao, grupo:'Aditivos', unidade:pai.unidade, tipologia:pai.tipologia || '', tipo:'Aditivo', status:'Ativo', aprovador:pai.aprovador || '', referencia:'', narrativa:'', valorFechado:valor, aceite:$('#cxAdAceite').value || '', cnpj:pai.cnpj || '', inclusao:hoje, aditivos:[], notas:[], subitens:[], arquivos:[] }, descricao);
      let anexos = 0, falhou = '';
      try { anexos = await anexarAoContrato(novo.id, arquivos); } catch (erro) { falhou = erro.message; }
      fechar(); destacarContrato(novo.id); aviso(falhou ? `Aditivo criado e vinculado a ${pai.nome}, mas o anexo falhou: ${falhou}` : `Aditivo criado e vinculado a ${pai.nome}${anexos ? ` com ${anexos} documento(s)` : ''}.`);
    } catch (erro) { b.disabled = false; aviso(erro.message); }
  });
  // Anexar depois: botão "+" na coluna Arquivos da linha (contrato ou aditivo) e bloco na janela do contrato. Só o Marcos.
  function escolherArquivosPara(id){
    const sel = document.createElement('input'); sel.type = 'file'; sel.multiple = true; sel.accept = '.pdf,image/*,.doc,.docx,.xls,.xlsx,.zip';
    sel.onchange = async () => {
      const lista = [...sel.files]; if (!lista.length) return;
      try { const n = await anexarAoContrato(id, lista); desenhar(); if (!$('#cxModal').hidden && abertoContrato === id) abrirContratoNotas(id); aviso(`${n} documento(s) anexado(s).`); }
      catch (erro) { aviso(erro.message); }
    };
    sel.click();
  }
  let abertoContrato = null;
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-anexar-contrato]'); if (!b) return;
    if (!podeMexerContratos()) return aviso('Só os engenheiros da Expansão, o Marcos e o Gustavo anexam documentos em contratos.');
    escolherArquivosPara(b.dataset.anexarContrato);
  });
  // ---- Setinha de recolher/expandir em todos os grupos, como na Monday (Gustavo, 14/11): › recolhido, ⌄ aberto. A escolha fica lembrada. ----
  const GRUPOS_CHAVE = 'cx_grupos_recolhidos';
  let recolhidos; try { recolhidos = new Set(JSON.parse(localStorage.getItem(GRUPOS_CHAVE) || '[]')); } catch (_) { recolhidos = new Set(); }
  if (!document.getElementById('cxGruposEstilo')){ const st = document.createElement('style'); st.id = 'cxGruposEstilo';
    st.textContent = '.cx-oculto-grupo{display:none!important}.cx-grupo-busca{margin-left:auto;min-width:220px;max-width:320px;padding:6px 9px;border:1px solid var(--cx-border);border-radius:3px;background:var(--cx-card);color:var(--cx-text);font:400 12px var(--sans,sans-serif)}.cx-contratos-grupo>h4{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cx-contratos-grupo.cx-recolhido>:not(h4){display:none!important}.cx-contratos-grupo>h4{cursor:pointer}.cx-grupo-seta{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:6px;padding:0;border:0;border-radius:3px;background:transparent;color:var(--cx-blue);cursor:pointer;vertical-align:middle;transition:transform .15s}.cx-grupo-seta svg{width:14px;height:14px}.cx-contratos-grupo:not(.cx-recolhido)>h4 .cx-grupo-seta{transform:rotate(90deg)}.cx-grupo-seta:hover{background:var(--cx-blue-soft)}';
    document.head.appendChild(st); }
  const chaveGrupo = h => [area, area === 'aprovacoes' ? aba : '', h.dataset.grupoNome].join('|');
  const buscasGrupo = new Map();
  function filtrarGrupo(s){
    const h = s.querySelector(':scope > h4'), campo = h?.querySelector('.cx-grupo-busca'); if (!campo) return;
    const t = R.normalizar(campo.value); let n = 0;
    s.querySelectorAll('tbody tr, .cx-ficha').forEach(l => { const ok = !t || R.contem(l.textContent, campo.value); l.classList.toggle('cx-oculto-grupo', !ok); if (ok) n++; });
    let vazio = s.querySelector(':scope > .cx-grupo-vazio');
    if (t && !n){ if (!vazio){ vazio = document.createElement('p'); vazio.className = 'cx-sub cx-grupo-vazio'; s.appendChild(vazio); } vazio.textContent = 'Nada encontrado neste grupo.'; } else vazio?.remove();
  }
  document.addEventListener('input', e => { const c = e.target.closest?.('#cxArea .cx-grupo-busca'); if (!c) return; const s = c.closest('.cx-contratos-grupo'); buscasGrupo.set(chaveGrupo(s.querySelector(':scope > h4')), c.value); filtrarGrupo(s); });
  function setasGrupos(){
    $$('#cxArea .cx-contratos-grupo').forEach(s => {
      const h = s.querySelector(':scope > h4'); if (!h) return;
      if (!h.dataset.grupoNome){
        h.dataset.grupoNome = (h.firstChild?.textContent || '').trim();
        h.insertAdjacentHTML('afterbegin', '<button type="button" class="cx-grupo-seta" data-grupo-seta><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>');
      }
      if (area === 'aprovacoes' && !h.querySelector('.cx-grupo-busca')){
        h.insertAdjacentHTML('beforeend', `<input type="search" class="cx-grupo-busca" placeholder="Pesquisar neste grupo…" aria-label="Pesquisar no grupo ${esc(h.dataset.grupoNome)}" autocomplete="off">`);
        const campo = h.querySelector('.cx-grupo-busca'); campo.value = buscasGrupo.get(chaveGrupo(h)) || '';
      }
      filtrarGrupo(s);
      const fechado = recolhidos.has(chaveGrupo(h)), b = h.querySelector('[data-grupo-seta]');
      s.classList.toggle('cx-recolhido', fechado);
      b.setAttribute('aria-expanded', String(!fechado)); b.setAttribute('aria-label', (fechado ? 'Expandir ' : 'Recolher ') + h.dataset.grupoNome);
    });
  }
  document.addEventListener('click', e => {
    const h = e.target.closest?.('#cxArea .cx-contratos-grupo > h4'); if (!h || !h.dataset.grupoNome) return;
    if (e.target.closest('button,a,input,select') && !e.target.closest('[data-grupo-seta]')) return;
    const k = chaveGrupo(h); if (recolhidos.has(k)) recolhidos.delete(k); else recolhidos.add(k);
    try { localStorage.setItem(GRUPOS_CHAVE, JSON.stringify([...recolhidos])); } catch (_) { /* sem lembrança da escolha */ }
    setasGrupos();
  });
  // ---- Projetos e Atividades: criar, editar e exportar planilha (Gustavo, 14/11). Só quem mexe no Portfólio (Marcos e Gustavo) salva. ----
  const dadosQuadro = chave => chave === 'atividades' ? D.atividades : D.projetos;
  const NOME_ITEM = { projetos:'projeto', atividades:'atividade' }, CRIADO = { projetos:'Projeto criado.', atividades:'Atividade criada.' };
  const acoesQuadro = chave => { const pode = podeMexerPortfolio(pessoa);
    return `<div class="cx-visoes cx-acoes-contratos"><button class="cx-btn forte" data-quadro-novo="${chave}" ${pode ? '' : 'disabled'} title="${pode ? '' : 'Só o Marcos e o Gustavo criam e editam'}">+ Nov${chave === 'atividades' ? 'a' : 'o'} ${NOME_ITEM[chave]}</button><button class="cx-btn" data-quadro-exportar="${chave}">Exportar planilha</button></div>`; };
  const COLUNAS_EDITAVEIS = ['text', 'numbers', 'status', 'color', 'date', 'timeline', 'people', 'long_text', 'dropdown', 'email', 'phone', 'link'];
  function campoColuna(c, v){
    const id = 'cxQc_' + c.id, val = String(v ?? '');
    if (['status', 'color'].includes(c.tipo)) return `<label class="cx-campo">${esc(c.titulo)}<select id="${id}"><option value="">—</option>${[...(val && !Object.keys(c.cores || {}).includes(val) ? [val] : []), ...Object.keys(c.cores || {})].map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (c.tipo === 'numbers') return `<label class="cx-campo">${esc(c.titulo)}<input id="${id}" inputmode="decimal" value="${esc(val)}" autocomplete="off"></label>`;
    if (c.tipo === 'date') return `<label class="cx-campo">${esc(c.titulo)}<input type="date" id="${id}" value="${esc(val.slice(0, 10))}"></label>`;
    if (c.tipo === 'timeline'){ const [a, b] = val.split(' - '); return `<div class="cx-campo">${esc(c.titulo)}<div class="cx-duas"><label class="cx-campo">Início<input type="date" id="${id}_ini" value="${esc((a || '').slice(0, 10))}"></label><label class="cx-campo">Fim<input type="date" id="${id}_fim" value="${esc((b || '').slice(0, 10))}"></label></div></div>`; }
    return `<label class="cx-campo">${esc(c.titulo)}<input id="${id}" value="${esc(val)}" autocomplete="off"></label>`;
  }
  function valorCampo(c){
    if (c.tipo === 'timeline'){ const a = $('#cxQc_' + c.id + '_ini').value, b = $('#cxQc_' + c.id + '_fim').value; return a || b ? `${a || b} - ${b || a}` : ''; }
    let v = ($('#cxQc_' + c.id)?.value || '').trim();
    if (c.tipo === 'numbers' && v){ const n = numeroBR(v); if (!isNaN(n)) v = String(n); }
    return v;
  }
  function abrirItemQuadro(chave, id){
    const P = dadosQuadro(chave); if (!P?.quadro) return aviso('Quadro ainda não carregado.');
    const item = id ? P.itens.find(i => i.item_id === id) : null, pode = podeMexerPortfolio(pessoa);
    const cols = P.quadro.colunas.filter(c => COLUNAS_EDITAVEIS.includes(c.tipo)), grupoAtual = item?.grupo_id || P.quadro.grupos[0]?.id;
    abrirDialogo((item ? 'Editar ' : (chave === 'atividades' ? 'Nova ' : 'Novo ')) + NOME_ITEM[chave] + (item ? ' · ' + item.nome : ''), `${pode ? '' : '<p class="cx-sub">Somente visualização: só o Marcos e o Gustavo criam e editam.</p>'}
      <label class="cx-campo">Nome<input id="cxQcNome" value="${esc(item?.nome || '')}" autocomplete="off"></label>
      <label class="cx-campo">Grupo<select id="cxQcGrupo">${P.quadro.grupos.map(g => `<option value="${esc(g.id)}"${grupoAtual === g.id ? ' selected' : ''}>${esc(g.titulo)}</option>`).join('')}</select></label>
      <div class="cx-campos-quadro">${cols.map(c => campoColuna(c, item?.valores?.[c.id]?.t)).join('')}</div>
      <div class="cx-acoes"><button class="cx-btn forte" data-quadro-salvar="${chave}|${esc(id || '')}" ${pode ? '' : 'disabled'}>${item ? 'Salvar alterações' : 'Criar ' + NOME_ITEM[chave]}</button></div>`);
    if (!pode) $$('#cxModal input, #cxModal select').forEach(el => { el.disabled = true; });
    $('#cxQcNome').focus();
  }
  function exportarQuadro(chave){
    const P = dadosQuadro(chave); if (!P?.quadro) return aviso('Nada para exportar.');
    const cols = P.quadro.colunas.filter(c => !['name', 'subtasks'].includes(c.tipo)), grupoNome = new Map(P.quadro.grupos.map(g => [g.id, g.titulo]));
    const ordem = new Map(P.quadro.grupos.map((g, i) => [g.id, i]));
    const itens = [...P.itens].sort((a, b) => (ordem.get(a.grupo_id) ?? 99) - (ordem.get(b.grupo_id) ?? 99) || a.ordem - b.ordem);
    const linhas = itens.map(i => Object.assign({ Grupo:grupoNome.get(i.grupo_id) || i.grupo_nome || '', Nome:i.nome }, Object.fromEntries(cols.map(c => { const t = i.valores?.[c.id]?.t ?? ''; return [c.titulo, c.tipo === 'numbers' && t !== '' && !isNaN(Number(t)) ? Number(t) : t]; }))));
    const nome = `${String(P.quadro.nome || chave).replace(/[\\/:*?"<>|]+/g, '').trim()} - ${new Date().toISOString().slice(0, 10)}`;
    if (window.XLSX){ const ws = XLSX.utils.json_to_sheet(linhas), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, String(P.quadro.nome || chave).slice(0, 31)); XLSX.writeFile(wb, nome + '.xlsx'); }
    else {
      const cab = Object.keys(linhas[0] || { Grupo:'', Nome:'' }), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const blob = new Blob(['﻿' + [cab.map(q).join(';'), ...linhas.map(l => cab.map(k => q(l[k])).join(';'))].join('\n')], { type:'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    aviso(`Planilha exportada: ${linhas.length} linha(s).`);
  }
  document.addEventListener('click', async e => {
    const novo = e.target.closest?.('[data-quadro-novo]'); if (novo) return abrirItemQuadro(novo.dataset.quadroNovo, null);
    const ed = e.target.closest?.('[data-quadro-editar]'); if (ed){ const [ch, id] = ed.dataset.quadroEditar.split('|'); return abrirItemQuadro(ch, id); }
    const ex = e.target.closest?.('[data-quadro-exportar]'); if (ex) return exportarQuadro(ex.dataset.quadroExportar);
    const sv = e.target.closest?.('[data-quadro-salvar]'); if (!sv) return;
    if (!podeMexerPortfolio(pessoa)) return aviso('Só o Marcos e o Gustavo criam e editam.');
    const [chave, id] = sv.dataset.quadroSalvar.split('|'), P = dadosQuadro(chave);
    const nome = $('#cxQcNome').value.trim(); if (!nome) return aviso('Informe o nome.');
    const valores = {}; for (const c of P.quadro.colunas.filter(c => COLUNAS_EDITAVEIS.includes(c.tipo))) valores[c.id] = { t:valorCampo(c) };
    sv.disabled = true;
    try { await D.salvarItemQuadro(chave, id || null, { grupo:$('#cxQcGrupo').value, nome, valores }); fechar(); desenhar(); aviso(id ? 'Alterações salvas.' : CRIADO[chave]); }
    catch (erro) { sv.disabled = false; aviso(erro.message); }
  });
  if (!document.getElementById('cxQuadrosEstilo')){ const st = document.createElement('style'); st.id = 'cxQuadrosEstilo';
    st.textContent = '.cx-campos-quadro{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.cx-campos-quadro .cx-campo{margin:10px 0}@media(max-width:700px){.cx-campos-quadro{grid-template-columns:1fr}}';
    document.head.appendChild(st); }
//@@ compras
    // Status em grupos, como em Contratos (Gustavo, 14/11): cada etapa da requisição é um grupo, em vez de uma coluna.
    const GRUPOS_COMPRA = ['Aguardando Compras', 'Em cotação', 'Aguardando Engenharia', 'Aguardando fechamento', 'Aguardando entrega', 'Entrega concluída', 'Recusada'];
    const grupoCompra = r => /^recusad/i.test(r.etapa) ? 'Recusada' : r.etapa === 'Aprovada' ? 'Aguardando entrega' : r.etapa;
    const cabecalhoReq = '<thead><tr><th>Requisição / cotação</th><th>Criação da RM</th><th>Unidade</th><th>SLA atendimento</th><th>Prazo desejado</th><th>Solicitante</th><th>Comprador</th><th>RM</th><th>Propostas</th><th>Certificados</th><th></th></tr></thead>';
    const gruposDeCompra = [...GRUPOS_COMPRA, ...new Set(lista.map(grupoCompra).filter(g => !GRUPOS_COMPRA.includes(g)))];
    const gruposCompra = gruposDeCompra.map(g => {
      const itens = lista.filter(r => grupoCompra(r) === g);
      return `<section class="cx-contratos-grupo"><h4>${esc(g)} <span>${itens.length}</span></h4>` + (itens.length
        ? (visaoReq === 'cartoes' ? `<div class="cx-fichas">${fichasDe(itens)}</div>` : `<div class="cx-rolagem"><table class="cx-tabela larga">${cabecalhoReq}<tbody>${corpoDe(itens)}</tbody></table></div>`)
        : '<p class="cx-sub">Nenhuma requisição neste grupo.</p>') + '</section>';
    }).join('');
