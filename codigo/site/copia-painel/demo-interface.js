// Somente na prévia: controles de teste, login fictício e troca de pessoa.
(function(){
  'use strict';
  const D = window.__demo;
  const $ = s => document.querySelector(s);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.body.classList.add('cx-preview');
  const entrada = document.createElement('section');
  entrada.className = 'cx-entrada';
  entrada.innerHTML = '<div class="cx-entrada-marca">expansão <small>EMPRESA EXEMPLO</small></div><div class="cx-entrada-mensagem"><span>UM NOVO ESPAÇO DE TRABALHO</span><h1>Do primeiro<br> documento<br> ao próximo<br> <em>passo.</em></h1><p>Lançamentos, aprovações e compras.<br>Uma operação conectada.</p></div><small>PRÉVIA DE INTERFACE · DADOS FICTÍCIOS</small>';
  $('#splashGate').prepend(entrada);
  $('#cxReiniciar').onclick = () => D.reiniciar();
  $('#cxVerComo').innerHTML = D.PESSOAS.map(p => `<option value="${esc(p.email)}">${esc(p.nome)} · ${esc(p.rotulo)}</option>`).join('');
  $('#cxVerComo').onchange = e => D.verComo(e.target.value);
  // Quem já tem login entra direto. Engenheiros e Helena passam pelo primeiro acesso do
  // próprio painel: senha inicial e, em seguida, a senha definitiva.
  const titulo = document.createElement('div');
  titulo.className = 'cx-entrada-titulo cx-entrada-login';
  titulo.innerHTML = `<span>PRÉVIA INTERATIVA</span><h2>Entrar no painel.</h2><p>Mesmo login do painel atual. Engenheiros e Helena fazem o primeiro acesso com a senha inicial <b>${esc(D.SENHA_INICIAL)}</b> e, em seguida, criam a própria senha.</p>`;
  $('#splashGate .gate-login').prepend(titulo);
  $('#cxEntrarComo').innerHTML = '<p class="cx-atalhos-rotulo">Atalhos da demonstração · sem digitar senha</p>' + D.PESSOAS.map(p => `<button type="button" data-entrar="${esc(p.email)}"><span class="cx-entrada-avatar">${esc(p.nome[0])}</span><span class="cx-entrada-perfil"><b>${esc(p.nome)}</b><small>${esc(p.rotulo)}${D.pendente(p.email) ? ' · primeiro acesso' : ''}</small></span><span class="cx-entrada-seta" aria-hidden="true">↗</span></button>`).join('');
  document.querySelectorAll('#cxEntrarComo [data-entrar]').forEach(b => { b.onclick = () => {
    $('#loginEmail').value = b.dataset.entrar; $('#loginSenha').value = D.senhaDemo(b.dataset.entrar); $('#gateBtn').click();
  }; });
  // "Ver como" para quem ainda não fez o primeiro acesso volta à tela de login com o e-mail preenchido.
  const preencher = sessionStorage.getItem('copia_demo_preencher');
  if (preencher){ sessionStorage.removeItem('copia_demo_preencher'); $('#loginEmail').value = preencher; $('#loginSenha').value = ''; $('#loginSenha').focus(); }
  window.__demoAoEntrar = email => {
    const pessoa = D.PESSOAS.find(p => p.email === email);
    if (!pessoa) return;
    $('#cxVerComo').value = pessoa.email;
    $('#cxAviso').hidden = false;
    window.ExpansaoUI.entrar(pessoa);
  };
  if (window.__demoEmail) window.__demoAoEntrar(window.__demoEmail);
})();
