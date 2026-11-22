import { readFileSync } from 'node:fs';
// Entrada padrão dos painéis (Gustavo, 14/11/2026): Expansão e Engenharia com a mesma tela de login (a da Engenharia:
// faixa azul à esquerda, formulário claro à direita), sem a animação de abertura e sem o "Bom dia" (resumo do dia
// anterior) depois do login. Usado pelos geradores da homologação de Expansão e da cópia de Engenharia.

// Cores da Expansão, restritas ao botão de entrada nos dois temas.
export const estiloBotaoLoginPadrao = `
#splashGate #gateBtn{
  --gate-btn-bg:linear-gradient(135deg,#2b5896,#4a97e0);
  --gate-glow-rgb:74 158 255;
  --shadow-gate-btn:0 8px 24px rgb(var(--gate-glow-rgb) / .35);
  --shadow-gate-btn-hover:0 12px 30px rgb(var(--gate-glow-rgb) / .5);
  --shadow-gate-btn-pulse:0 8px 34px rgb(var(--gate-glow-rgb) / .6);
}
:root[data-theme=claro] #splashGate #gateBtn{
  --gate-btn-bg:linear-gradient(135deg,#123f6e,#1c68ae);
  --gate-glow-rgb:24 90 151;
}
#splashGate .cx-entrada-titulo{width:100%;box-sizing:border-box}

body:is(.cx-preview,.cx-login-padrao) #splashGate{--lp:#f7f9fc;--li:#192e49;--lm:#62738a;--lb:#ced9e6;background:var(--lp)!important;align-items:center}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada{box-sizing:border-box;min-height:100%;padding:48px clamp(28px,5vw,80px);background:radial-gradient(ellipse at 0 0,#397eaa66,transparent 65%),linear-gradient(145deg,#123f6e,#091d35)}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1{font-size:clamp(48px,5.5vw,80px);line-height:1.04;letter-spacing:-.045em}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1 em{color:#a9d3ef}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login{box-sizing:border-box;width:min(420px,calc(100% - 64px));margin:auto;padding:48px 0;gap:0;text-align:left}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo{margin:0 0 32px}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo>span{font:10px 'JetBrains Mono',monospace;letter-spacing:.18em;color:var(--lm)}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo h2{font:600 42px/1.15 'Source Serif 4',Georgia,serif;letter-spacing:-.04em;margin:18px 0 12px;color:var(--li)}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo p{font:14px/1.7 Inter,sans-serif;color:var(--lm)}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login>label{font:11px 'JetBrains Mono',monospace;color:var(--li)!important;margin:16px 0 8px!important}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login>input{box-sizing:border-box;width:100%;min-height:52px;padding:14px 16px;border:1px solid var(--lb);border-radius:10px;background:var(--lp);color:var(--li);font:14px Inter,sans-serif}
body:is(.cx-preview,.cx-login-padrao) #splashGate #gateBtn{width:100%;min-height:52px;border-radius:10px;background:linear-gradient(135deg,#123f6e,#2376ae);color:#fff;font:600 14px Inter,sans-serif;animation:none;box-shadow:0 8px 20px #123f6e20;margin-top:8px}
body:is(.cx-preview,.cx-login-padrao) #splashGate :is(button,input,a):focus-visible{outline:3px solid #4c9ed4!important;outline-offset:3px}
body:is(.cx-preview,.cx-login-padrao) #splashGate button:hover{filter:brightness(1.08)}
body:is(.cx-preview,.cx-login-padrao) #splashGate button:disabled{opacity:.6;cursor:wait}
body:is(.cx-preview,.cx-login-padrao) #splashGate #gateEsqueci,body:is(.cx-preview,.cx-login-padrao) #splashGate #gateRecado{color:var(--li)!important;line-height:1.6}
body:is(.cx-preview,.cx-login-padrao) #splashGate #gateEsqueci{padding:14px 8px}
body:is(.cx-preview,.cx-login-padrao) #splashGate #loginErro{color:#bd3646;line-height:1.6}
body:is(.cx-preview,.cx-login-padrao) #splashGate #cxEntrarComo{border-top:1px solid var(--lb);padding-top:24px;margin-top:24px}
body:is(.cx-preview,.cx-login-padrao) #splashGate #cxEntrarComo button{border-color:var(--lb);border-radius:10px;background:var(--lp);color:var(--li)}
body:is(.cx-preview,.cx-login-padrao) #splashGate #cxEntrarComo .cx-entrada-perfil{color:var(--li)}
body:is(.cx-preview,.cx-login-padrao) #splashGate #cxEntrarComo :is(small,.cx-atalhos-rotulo){color:var(--lm)}
:root:not([data-theme=claro]) body:is(.cx-preview,.cx-login-padrao) #splashGate{--lp:#111f32;--li:#e3edf9;--lm:#a6b8cf;--lb:#35475e}
@media(max-width:760px){body:is(.cx-preview,.cx-login-padrao) #splashGate{grid-template-columns:1fr!important;align-items:start}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada{min-height:0;height:auto;padding:24px}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem{padding:18px 0 0}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1{font-size:38px;margin:16px 0}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1 br{display:none}body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login{width:calc(100% - 48px);padding:32px 0}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo h2{font-size:36px}}

/* login-vale-20261115 */
#splashGate .cx-entrada{background:radial-gradient(ellipse at top left,#397cbc,transparent 65%),linear-gradient(145deg,#133b67,#102b50);box-sizing:border-box}
#splashGate .gate-login{font-family:Inter,sans-serif}
#splashGate .gate-login>input{border-radius:12px!important;padding:16px!important;min-height:52px;box-sizing:border-box}
#splashGate #gateBtn{border-radius:12px;min-height:52px;background:linear-gradient(135deg,#174c82,#287ac1);color:white;animation:none}
#splashGate #gateBtn:hover{filter:brightness(1.12)}
#splashGate :is(input,button,a):focus-visible{outline:3px solid #62aafa!important;outline-offset:4px}
#splashGate #gateBtn:disabled{opacity:.6;cursor:wait}
:root[data-theme=escuro] #splashGate{background:#142237!important}
/* 17/11/2026: só no login antigo (cartão escuro). No login padrão o cartão é sempre branco e o texto claro sumia no tema escuro. */
:root[data-theme=escuro] body:not(.cx-preview):not(.cx-login-padrao) #splashGate .cx-entrada-titulo :is(h2,p,span),:root[data-theme=escuro] body:not(.cx-preview):not(.cx-login-padrao) #splashGate .gate-login>label{color:#eef4ff!important}
@media(max-width:760px){#splashGate .cx-entrada{min-height:0;padding:28px}#splashGate .gate-login{width:calc(100% - 48px)!important}}

/* Remodela??o visual compartilhada ? novembro 2026 */
body:is(.cx-preview,.cx-login-padrao) #splashGate{padding:clamp(20px,4vw,64px);gap:clamp(32px,6vw,100px);grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);background:radial-gradient(ellipse at 12% 10%,#235d80 0,transparent 48%),radial-gradient(ellipse at 90% 90%,#173f59 0,transparent 45%),#091e31!important;min-height:100dvh;color:#fff;isolation:isolate}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada{position:relative;overflow:hidden;align-self:stretch;min-height:600px;padding:24px clamp(12px,3vw,48px);background:transparent;border:0;display:flex;flex-direction:column;justify-content:space-between}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada:after{content:'';position:absolute;width:420px;height:420px;right:-210px;bottom:-240px;border:1px solid #8fd4e84d;border-radius:50%;box-shadow:0 0 0 48px #8fd4e809,0 0 0 96px #8fd4e807,0 0 0 144px #8fd4e805;pointer-events:none}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-marca{font:600 22px Inter,sans-serif;letter-spacing:-.04em;color:#fff}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-marca small{display:block;font:10px Inter,sans-serif;letter-spacing:.25em;color:#a7c5d5;margin-top:10px}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem{padding:64px 0;position:relative;z-index:1}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem>span{font:10px Inter,sans-serif;letter-spacing:.22em;color:#a7d8e7;border-left:24px solid #82cadc;padding-left:12px}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1{font:500 clamp(48px,5.6vw,86px)/1.06 'Source Serif 4',Georgia,serif;letter-spacing:-.055em;color:#fff;margin:28px 0}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1 em{color:#a8dfdf;font-weight:400}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem p{font:14px/1.85 Inter,sans-serif;color:#b5cbd7;max-width:340px}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada>small{font:9px Inter,sans-serif;letter-spacing:.2em;color:#92b2c5}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login{--lp:#fff;--li:#172e42;--lm:#637688;--lb:#dce5eb;width:100%;max-width:480px;padding:clamp(28px,3.5vw,52px);background:#fff;border:1px solid #ffffff70;border-radius:26px;box-shadow:0 32px 90px #0004;position:relative;margin:auto;}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo>span{color:#35758a!important;font:600 10px Inter,sans-serif;letter-spacing:.2em}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo h2{color:#172e42!important;font-size:40px;margin:18px 0 12px}
body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo p{color:#637688!important}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login>label{color:#31495b!important;font:600 12px Inter,sans-serif}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login>input{background:#f5f8fa;border:1px solid #dce5eb;color:#172e42;transition:border-color .2s,box-shadow .2s}
body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login>input::placeholder{color:#8393a0}
body:is(.cx-preview,.cx-login-padrao) #splashGate #gateBtn{background:linear-gradient(110deg,#153f60,#24758c);min-height:54px;box-shadow:0 8px 18px #184b6026;margin-top:12px;letter-spacing:.02em}
body:is(.cx-preview,.cx-login-padrao) #splashGate #cxEntrarComo button{background:#f5f8fa}
@media(max-width:760px){body:is(.cx-preview,.cx-login-padrao) #splashGate{padding:24px 18px;gap:26px}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada{padding:8px 10px;min-height:0}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem{padding:26px 0 0}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem h1{font-size:44px;margin:18px 0 0;max-width:420px}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-mensagem>span{font-size:8px}body:is(.cx-preview,.cx-login-padrao) #splashGate .gate-login{width:100%!important;padding:28px 24px;border-radius:22px}body:is(.cx-preview,.cx-login-padrao) #splashGate .cx-entrada-titulo h2{font-size:34px}}

`;

function trocar(html, de, para, nome){
  const n = html.split(de).length - 1;
  if (n !== 1) throw Error(`Entrada padrão (${nome}): esperava 1x, achei ${n}x.`);
  return html.replace(de, () => para);
}

// Sem animação de abertura, sem som de abertura e sem o resumo do dia anterior.
export function comSemSaudacao(html){
  html = trocar(html, "const overlay = document.getElementById('dailyBriefing');", "const overlay = null;   // resumo do dia anterior desligado (Gustavo, 14/11)", 'resumo');
  html = trocar(html, 'function tocarAberturaSonora(){', 'function tocarAberturaSonora(){ return;   // sem som de abertura (14/11)', 'som');
  return html.replace('</head>', () => '<style id="cxSemSaudacao">#splash,#dailyBriefing{display:none!important}</style>\n</head>');
}

// Login com a mesma aparência da Engenharia, sem os atalhos da demonstração.
export function comLoginPadrao(html, { marca, mensagem }){
  const direcao = readFileSync(new URL('./direcao.css', import.meta.url), 'utf8');
  const i = direcao.indexOf('/* Entrada da prévia:');
  if (i < 0) throw Error('Entrada padrão: bloco de estilo da entrada mudou.');
  const css = direcao.slice(i).replaceAll('body.cx-preview', 'body.cx-login-padrao');
  html = trocar(html, '<div id="splashGate">', `<div id="splashGate"><section class="cx-entrada"><div class="cx-entrada-marca">${marca} <small>EMPRESA EXEMPLO</small></div><div class="cx-entrada-mensagem"><span>UM NOVO ESPAÇO DE TRABALHO</span><h1>Do primeiro<br> documento<br> ao próximo<br> <em>passo.</em></h1><p>${mensagem}</p></div><small>EMPRESA EXEMPLO · ${marca.toUpperCase()}</small></section>`, 'faixa');
  html = trocar(html, '<div class="gate-login">', '<div class="gate-login"><div class="cx-entrada-titulo cx-entrada-login"><span>EMPRESA EXEMPLO</span><h2>Entrar no painel.</h2><p>Use seu e-mail e sua senha.</p></div>', 'título');
  if (!/<body>/.test(html)) throw Error('Entrada padrão: <body> mudou.');
  html = html.replace('<body>', () => '<body class="cx-login-padrao">');
  if (!/Source\+Serif\+4/.test(html)) html = html.replace('family=JetBrains+Mono:wght@500;600&display=swap', 'family=JetBrains+Mono:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap');
  return html.replace('</head>', () => `<style id="cxLoginPadrao">\n${css}\n${estiloBotaoLoginPadrao}\nbody.cx-login-padrao .cx-entrada-titulo{width:100%;box-sizing:border-box}\n\n</style>\n</head>`);
}
