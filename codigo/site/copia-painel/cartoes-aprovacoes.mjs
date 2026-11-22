// Adapta somente a apresentação; campos e ações usam os handlers do quadro.
export function comCartoes(js) {
  const trocar = (de, para) => {
    if (js.split(de).length !== 2) throw Error('Marca de cartões mudou: ' + de);
    js = js.replace(de, () => para);
  };
  trocar('  const trilha = dentro =>', `  let visaoNotas = 'quadro';
  try { visaoNotas = localStorage.getItem('cx_visao_notas') === 'cartoes' ? 'cartoes' : 'quadro'; } catch (_) {}
  const fichaNota = n => \`<article class="cx-ficha cx-ficha-nota" data-linha="\${esc(n.id)}" data-texto="\${esc(R.texto(n))}" data-unidade="\${esc(n.unidade)}" data-status="\${esc(n.etapa)}" data-natureza="\${esc(n.natureza)}" data-emissao="\${esc(String(n.emissao || '').slice(0,10))}">
    <div class="cx-ficha-topo"><span>NF \${esc(n.nf)}</span>\${etiqueta(ETAPAS[n.etapa])}</div>
    <div class="cx-ficha-titulo"><span class="cx-kicker">\${unidade(n.unidade)} / \${esc(n.natureza)}</span><h3>\${esc(n.fornecedor)}</h3><span data-reserva-nota="\${esc(n.id)}" class="cx-reserva-etiqueta"></span></div>
    <dl class="cx-ficha-dados"><div><dt>Valor</dt><dd>\${dinheiro(n.valor)}</dd></div><div><dt>Vencimento</dt><dd>\${dataBR(n.vencimento)}</dd></div></dl>
    <div class="cx-ficha-campos"><label class="cx-campo">Narrativa\${celulaTexto(n,'narrativa','Narrativa')}</label><div class="cx-duas"><label class="cx-campo">É contrato?\${celulaSimNao(n,'contrato','É contrato?')}</label><label class="cx-campo">Pertence à expansão?\${celulaSimNao(n,'expansao','Pertence à expansão?')}</label></div>\${n.etapa === 'pedido' ? \`<label class="cx-campo">Pedido (Datasul)\${celulaPedido(n)}</label>\` : ''}\${bloqueioSaldo(n) ? etiqueta('Saldo do contrato insuficiente','rosa') : ''}</div>
    <div class="cx-ficha-rodape"><span>\${(n.arquivos || []).length} docs · emissão \${dataBR(n.emissao)}</span><span class="cx-ficha-acoes">\${botaoLinha(n)}<button class="cx-btn cx-mini" data-nota="\${esc(n.id)}">Abrir</button></span></div></article>\`;
  const trilha = dentro =>`);
  trocar('<div class="cx-fila-cabeca"><div><h3>${legendaAba()}</h3></div><span class="cx-total-fila">', '<div class="cx-fila-cabeca"><div><h3>${legendaAba()}</h3></div><div class="cx-visoes" aria-label="Apresentação das notas"><button data-visao="quadro" aria-pressed="${visaoNotas === \'quadro\'}">${icone(\'tabela\')} Quadro</button><button data-visao="cartoes" aria-pressed="${visaoNotas === \'cartoes\'}">${icone(\'grade\')} Cartões</button></div><span class="cx-total-fila">');
  trocar('${atuais.length ? quadroNotas(atuais) :', '${atuais.length ? (visaoNotas === \'cartoes\' ? `<div class="cx-fichas cx-fichas-notas">${atuais.map(fichaNota).join(\'\')}</div>` : quadroNotas(atuais)) :');
  trocar('visaoReq = alvo.dataset.visao; desenhar();', "if (area === 'aprovacoes') { visaoNotas = alvo.dataset.visao; try { localStorage.setItem('cx_visao_notas',visaoNotas); } catch (_) {} } else visaoReq = alvo.dataset.visao; desenhar();");
  trocar('$(`[data-visao=${visaoReq}]`).focus(); return;', '$(`[data-visao=${alvo.dataset.visao}]`).focus(); return;');
  trocar("atualizarLinha(el.closest('tr'))", "atualizarLinha(el.closest('[data-linha]'))");
  trocar('$(`tr[data-linha="${id}"] [data-celula=pedido]`)', '$(`[data-linha="${id}"] [data-celula=pedido]`)');
  return js;
}
