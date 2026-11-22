// QA visual/interativa: executar no navegador da prévia como Rafael, em cada viewport.
// Não confirma nenhuma transição de negócio nem persiste alterações.
(async () => {
  const q = s => document.querySelector(s), todos = s => [...document.querySelectorAll(s)];
  const resultados = [];
  const conferir = (ok, texto) => { if (!ok) throw Error(texto); resultados.push(texto); };
  const aguardarQuadro = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!q('#cxGaveta').hidden) q('[data-gav=fechar]').click();
  if (!q('#cxModal').hidden) q('[data-acao=fechar]').click();
  q('[data-area=aprovacoes]').click();
  q('[data-cxaba=engenharia]').click();
  const busca = q('[data-busca]');
  busca.value = 'sem-correspondencia-qa'; busca.dispatchEvent(new Event('input', {bubbles:true}));
  conferir(q('[data-contagem]').textContent === '0' && !q('.cx-sem-resultado').hidden, 'Busca sem resultado informa zero e mostra orientação');
  busca.value = ''; busca.dispatchEvent(new Event('input', {bubbles:true}));
  conferir(Number(q('[data-contagem]').textContent) === todos('[data-nota]').length, 'Limpar busca recupera a lista e a contagem');
  conferir(document.documentElement.scrollWidth <= innerWidth, 'Página cabe na largura da tela');
  q('[data-nota=DEMO-004]').click();
  const narrativa = q('#cxNarrativa'), original = narrativa.value;
  narrativa.value = 'Conferência visual sem salvar';
  q('[data-arquivo]').click();
  // Espera a animação finita do painel, sem depender de uma duração fixa.
  await Promise.all(q('#cxGaveta').getAnimations().map(a => a.finished));
  await aguardarQuadro();
  narrativa.scrollIntoView({ block:'center' });
  await aguardarQuadro();
  const a = narrativa.getBoundingClientRect(), b = q('#cxGaveta').getBoundingClientRect();
  const separados = a.right <= b.left + 1 || a.top >= b.bottom - 1;
  conferir(separados, 'Documento não cobre o campo Narrativa');
  conferir(b.left >= -1 && b.right <= innerWidth + 1, 'Visualizador inteiro dentro da tela');
  const ponto = document.elementFromPoint(a.left + a.width / 2, a.top + Math.min(20, a.height / 2));
  conferir(ponto === narrativa, 'Campo de preenchimento recebe clique com a prévia aberta');
  conferir(!q('#cxGaveta [data-gav=remover]'), 'Documento original continua somente leitura');
  q('[data-gav=fechar]').click();
  conferir(narrativa.value === 'Conferência visual sem salvar', 'Fechar documento preserva o preenchimento');
  narrativa.value = original;
  q('[data-acao=fechar]').click();
  conferir(!document.body.classList.contains('cx-dialogo-aberto'), 'Fechar análise libera a rolagem da página');
  const raiz = document.documentElement, tema = raiz.getAttribute('data-theme');
  function lum(hex){
    let cor = hex.trim().replace('#','');
    if (cor.length === 3) cor = [...cor].map(c => c+c).join('');
    const canais = cor.match(/.{2}/g).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
    return .2126*canais[0]+.7152*canais[1]+.0722*canais[2];
  }
  for (const t of ['claro','escuro']){
    raiz.setAttribute('data-theme', t);
    const css = getComputedStyle(document.body);
    for (const [fg,bg] of [['text','card'],['muted','subtle'],['blue','blue-soft'],['green','green-soft'],['amber','amber-soft'],['violet','violet-soft'],['red','red-soft']]){
      const l1 = lum(css.getPropertyValue('--cx-'+fg)), l2 = lum(css.getPropertyValue('--cx-'+bg));
      const ratio = (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      conferir(ratio >= 4.5, `Contraste ${t}: ${fg} ${ratio.toFixed(2)}:1`);
    }
  }
  if (tema) raiz.setAttribute('data-theme', tema); else raiz.removeAttribute('data-theme');
  q('[data-area=compras]').click();
  q('[data-visao=cartoes]').click();
  const eu = window.__demo.PESSOAS.find(p => p.email === window.__demo.sessao().user.email);
  conferir(todos('.cx-ficha').length === window.__demo.requisicoes.filter(r => window.ExpansaoRegras.podeVerReq(eu, r)).length, 'Cartões exibem todas as requisições visíveis para a pessoa');
  const pesquisa = q('[data-busca]'); pesquisa.value = 'eletrodutos'; pesquisa.dispatchEvent(new Event('input', {bubbles:true}));
  conferir(todos('.cx-ficha:not([hidden])').length === 1, 'Busca pela descrição filtra os cartões');
  q('[data-visao=tabela]').click();
  conferir(q('[data-busca]').value === 'eletrodutos' && todos('tr[data-texto]:not([hidden])').length === 1, 'Troca para tabela preserva busca e resultados');
  q('[data-visao=cartoes]').click();
  conferir(todos('.cx-ficha:not([hidden])').length === 1, 'Retorno aos cartões mantém a busca');
  q('[data-busca]').value = ''; q('[data-busca]').dispatchEvent(new Event('input', {bubbles:true}));
  conferir(document.documentElement.scrollWidth <= innerWidth, 'Cartões não criam rolagem horizontal na página');
  q('[data-area=aprovacoes]').click();
  return { viewport:innerWidth, verificacoes:resultados.length, resultados };
})();
