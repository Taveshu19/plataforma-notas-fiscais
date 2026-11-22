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
    const s = new Set();
    for (const c of D.contratos || []){ const t = String(c.tipologia || '').trim(); if (!t) continue; s.add(t); t.split(',').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x)); }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  const opcaoTipologia = (atual = '') => '<option value="">Selecione a tipologia</option>' + [...(atual && !listaTipologias().includes(atual) ? [atual] : []), ...listaTipologias()].map(t => `<option${t === atual ? ' selected' : ''}>${esc(t)}</option>`).join('');

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
    const cartao = (titulo, valor, meta, detalhe, ok) => `<div class="cx-ind ${ok === true ? 'ok' : ok === false ? 'alerta' : ''}"><span>${titulo}</span><b>${valor}</b><small>${meta}</small><small>${detalhe}</small></div>`;
    const dentroCot = cot.filter(x => x.dias <= 7).length, dentroApr = apr.filter(x => x.dias <= 3).length;
    return `<section class="cx-contratos-grupo cx-indicadores-compras"><h4>Indicadores do procedimento de Compras <span>${lista.length}</span><small>Procedimento Técnico · Engenharia de Expansão · 12/11/2025</small></h4>
      <div class="cx-inds">
        ${cartao('Prazo médio de cotação', fmtDias(media(cot.map(x => x.dias))), 'Meta: até 7 dias úteis', `${dentroCot} de ${cot.length} no prazo (${pct(dentroCot, cot.length)}) · ${cotAbertas.filter(d => d > 7).length} em aberto atrasada(s)`, cot.length ? dentroCot === cot.length && !cotAbertas.some(d => d > 7) : null)}
        ${cartao('Mínimo de 3 cotações', pct(tres, cot.length), 'Meta: 3 propostas por requisição', `${tres} de ${cot.length} chegaram à engenharia com 3 ou mais propostas anexadas`, cot.length ? tres === cot.length : null)}
        ${cartao('Prazo médio de aprovação', fmtDias(media(apr.map(x => x.dias))), 'Meta: até 3 dias úteis', `${dentroApr} de ${apr.length} no prazo (${pct(dentroApr, apr.length)}) · ${aprAbertas.filter(d => d > 3).length} aguardando a engenharia há mais de 3 dias úteis`, apr.length ? dentroApr === apr.length && !aprAbertas.some(d => d > 3) : null)}
        ${cartao('Confirmação do pedido', fechamento.length ? `${fechamento.length} aguardando` : '—', 'Meta: até 24 h após a aprovação', `${fechamento.filter(h => h > 24).length} há mais de 24 h em "Aguardando fechamento"`, fechamento.length ? !fechamento.some(h => h > 24) : null)}
        ${cartao('Cumprimento do prazo de entrega', '—', 'Entrega no prazo combinado', 'Ainda sem registro de entrega no painel', null)}
        ${cartao('Não conformidades', '—', 'Percentual de compras com não conformidade', 'Ainda sem registro de recebimento/não conformidade no painel', null)}
      </div></section>`;
  }
  if (!document.getElementById('cxIndicadoresEstilo')){ const st = document.createElement('style'); st.id = 'cxIndicadoresEstilo';
    st.textContent = '.cx-inds{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:10px 0 26px}'
      + '.cx-ind{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--cx-border);border-left:3px solid var(--cx-border);border-radius:3px;background:var(--cx-card)}'
      + '.cx-ind.ok{border-left-color:#1f9d55}.cx-ind.alerta{border-left-color:var(--cx-red)}'
      + '.cx-ind>span{font-size:10px;color:var(--cx-muted);text-transform:uppercase;letter-spacing:.06em}.cx-ind b{font:500 22px var(--cx-serif,serif)}.cx-ind small{font-size:11px;color:var(--cx-muted);line-height:1.45}'
      + '.cx-fases{grid-template-columns:repeat(5,minmax(0,1fr))}'
      + '.cx-arq-dono{margin:10px 0 14px}.cx-arq-dono h5{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;font-size:12px}.cx-arq-dono h5 small{color:var(--cx-muted);font-weight:400}'
      // Campos sem o contorno branco ao clicar (Gustavo, 14/11): o campo continua com a mesma aparência quando recebe o foco.
      + 'body.cx-experiencia :is(input,select,textarea):is(:focus,:focus-visible){outline:none!important;box-shadow:none!important}'
      + 'body.cx-experiencia .cx-campo :is(input,select,textarea):focus{border-color:var(--cx-border)!important}'
      + 'body.cx-experiencia :is(.cx-busca,.cx-grupo-busca,#cxAdBusca,.cx-filtros select,.cx-filtros input):focus{border-color:var(--cx-border)!important}';
    document.head.appendChild(st); }
