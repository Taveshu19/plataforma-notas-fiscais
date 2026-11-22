  // ---- Editar contrato e aditivo (Gustavo, 14/11): botão "Editar" em cada linha e na janela do contrato. Só o Marcos salva. ----
  // Aditivo: dá para trocar o contrato ao qual ele pertence (continua obrigatório). Status "Encerrado" leva o contrato para "Contratos finalizados".
  const paisPossiveis = () => calcContratos().filter(c => c.tipo !== 'Aditivo' && c.grupo !== 'Aditivos' && c.grupo !== 'Contratos finalizados' && c.status !== 'Encerrado').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ehAditivo = c => c.tipo === 'Aditivo' || c.grupo === 'Aditivos';
  const opcoesCom = (lista, atual) => [...(atual && !lista.includes(atual) ? [atual] : []), ...lista].map(v => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
  function abrirEditarContrato(id){
    const c = (D.contratos || []).find(x => x.id === id); if (!c) return aviso('Contrato não encontrado.');
    const pode = podeMexerContratos(), dis = pode ? '' : 'disabled', unidades = R.opcoesUnidade().map(([, l]) => l);
    const v = campo => esc(c[campo] || '');
    const comum = `<div class="cx-duas"><label class="cx-campo">${ehAditivo(c) ? 'Valor do aditivo' : 'Valor fechado'} (R$)<input id="cxEdValor" inputmode="decimal" autocomplete="off" value="${esc(String(c.valorFechado ?? '').replace('.', ','))}" ${dis}></label><label class="cx-campo">Aceite<input type="date" id="cxEdAceite" value="${esc(String(c.aceite || '').slice(0, 10))}" ${dis}></label></div>
      <div class="cx-duas"><label class="cx-campo">Status<select id="cxEdStatus" ${dis}>${opcoesCom(['Ativo', 'Encerrado'], c.status || 'Ativo')}</select></label><label class="cx-campo">Unidade<select id="cxEdUnidade" ${dis}>${opcoesCom(unidades, c.unidade || '')}</select></label></div>
      <div class="cx-duas"><label class="cx-campo">CNPJ<input id="cxEdCnpj" autocomplete="off" value="${v('cnpj')}" ${dis}></label><label class="cx-campo">Referência<input id="cxEdRef" autocomplete="off" value="${v('referencia')}" ${dis}></label></div>
      <div class="cx-duas"><label class="cx-campo">Tipologia<input id="cxEdTip" autocomplete="off" value="${v('tipologia')}" ${dis}></label><label class="cx-campo">Aprovador<input id="cxEdAprov" autocomplete="off" value="${v('aprovador')}" ${dis}></label></div>`;
    const pai = ehAditivo(c) ? paiDeAditivo(c) : null;
    const corpo = ehAditivo(c)
      ? `<label class="cx-campo">Nome do aditivo<input id="cxEdNome" autocomplete="off" value="${v('nome')}" ${dis}></label>
         <div class="cx-campo">Contrato do aditivo (obrigatório)${seletorPai(pai?.id)}</div>${comum}`
      : `<label class="cx-campo">Prestador (nome do contrato)<input id="cxEdNome" autocomplete="off" value="${v('nome')}" ${dis}></label>
         <label class="cx-campo">Tipo<select id="cxEdTipo" ${dis}>${opcoesCom(TIPOS_CONTRATO, TIPOS_CONTRATO.includes(c.tipo) ? c.tipo : 'Contrato')}</select></label>${comum}`;
    abrirDialogo((ehAditivo(c) ? 'Editar aditivo · ' : 'Editar contrato · ') + c.nome, `${pode ? '' : '<p class="cx-sub">Somente visualização: só o Marcos altera contratos e aditivos.</p>'}${corpo}
      <div class="cx-acoes"><button class="cx-btn forte" data-salvar-edicao="${esc(c.id)}" ${dis}>Salvar alterações</button><button class="cx-btn" data-anexar-contrato="${esc(c.id)}" ${dis}>+ Anexar documentos</button></div>`);
    if (ehAditivo(c)){ ligarBuscaPai(); const op = pai && $(`#cxAdLista [data-ad-pai="${CSS.escape(pai.id)}"]`); if (op){ escolherPai(op, true); op.scrollIntoView({ block:'nearest' }); } }
  }
  document.addEventListener('click', async e => {
    const ed = e.target.closest?.('[data-editar-contrato]'); if (ed) return abrirEditarContrato(ed.dataset.editarContrato);
    const b = e.target.closest?.('[data-salvar-edicao]'); if (!b) return;
    if (!podeMexerContratos()) return aviso('Só o Marcos altera contratos e aditivos.');
    const id = b.dataset.salvarEdicao, c = (D.contratos || []).find(x => x.id === id); if (!c) return;
    const dados = { nome:$('#cxEdNome').value.trim().toUpperCase(), tipo:ehAditivo(c) ? 'Aditivo' : $('#cxEdTipo').value, unidade:$('#cxEdUnidade').value, valorFechado:numeroBR($('#cxEdValor').value),
      status:$('#cxEdStatus').value, aceite:$('#cxEdAceite').value || '', cnpj:$('#cxEdCnpj').value.trim(), referencia:$('#cxEdRef').value.trim(), tipologia:$('#cxEdTip').value.trim(), aprovador:$('#cxEdAprov').value.trim(),
      contratoPai:ehAditivo(c) ? $('#cxAdPai').value : null };
    if (!dados.nome) return aviso('Informe o nome.');
    if (!dados.unidade) return aviso('Escolha a unidade.');
    if (!(dados.valorFechado >= 0)) return aviso('Informe o valor.');
    if (ehAditivo(c) && !dados.contratoPai) return aviso('Escolha o contrato: todo aditivo precisa estar vinculado a um contrato.');
    b.disabled = true;
    try { await D.editarContrato(id, dados); fechar(); destacarContrato(id); aviso('Alterações salvas.'); }
    catch (erro) { b.disabled = false; aviso(erro.message); }
  });
