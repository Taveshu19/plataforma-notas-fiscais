// Primeiro acesso de quem ainda não tem senha própria, pela tela do próprio painel. Usado por testar.sh.
(async()=>{
  const q=s=>document.querySelector(s),esp=ms=>new Promise(r=>setTimeout(r,ms)),ok=[];
  const check=(v,m)=>{if(!v)throw Error('FALHOU: '+m+' | feitos: '+ok.join('; '));ok.push(m);};
  const email=__EMAIL__,nome=__NOME__;
  check(q('#loginEmail').value===email,'"Ver como" leva ao login com o e-mail preenchido');
  check(__demo.pendente(email),'Pessoa ainda em primeiro acesso');
  q('#loginSenha').value='senha-errada';q('#gateBtn').click();await esp(500);
  check(/incorretos/.test(q('#loginErro').textContent),'Senha diferente da inicial é recusada');
  q('#loginSenha').value=__demo.SENHA_INICIAL;q('#gateBtn').click();await esp(700);
  check(!!q('#nomeExib')&&!!q('#novaSenha1'),'Senha inicial abre a criação da senha definitiva');
  q('#nomeExib').value=nome;q('#novaSenha1').value='curta';q('#novaSenha2').value='curta';q('#trocaBtn').click();await esp(200);
  check(/8 caracteres/.test(q('#trocaErro').textContent),'Senha curta é recusada');
  q('#novaSenha1').value='MinhaSenha123';q('#novaSenha2').value='MinhaSenha123';q('#trocaBtn').click();await esp(3600);
  check(!__demo.pendente(email),'Senha definitiva salva');
  check(__demo.senhaDemo(email)==='MinhaSenha123','Próximo login usa a senha escolhida');
  check(!!document.querySelector('#cxAbas button'),'Entrou no painel depois de criar a senha');
  return JSON.stringify({primeiroAcesso:email,verificacoes:ok.length,ok});
})()
