// Carregamento sem "tela congelada" (Gustavo, 14/11/2026): do login até o painel novo terminar de montar, aparece
// "Carregando o painel…" por cima da tela de lançamento que ainda está sendo montada. Fica abaixo da tela de login
// (z-index 10001), então nunca a cobre. Some quando ExpansaoUI.entrar termina (window.__cxPronto) ou, por segurança, em 30 s.
// Usado pelos geradores de Expansão (demonstração e homologação) e de Engenharia.
const ESTILO = `<style id="cxCarregandoEstilo">
#cxCarregando{position:fixed;inset:0;z-index:10000;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#101319;color:#e8ecf3;font:500 15px system-ui,-apple-system,"Segoe UI",sans-serif}
html[data-theme=claro] #cxCarregando{background:#f4f5f7;color:#17202f}
#cxCarregando .cx-anel{width:34px;height:34px;border-radius:50%;border:3px solid rgb(128 140 160 / .25);border-top-color:#5b8cff;animation:cxGira .8s linear infinite}
@keyframes cxGira{to{transform:rotate(360deg)}}
</style>`;
const CAIXA = `<div id="cxCarregando" role="status" aria-live="polite"><div class="cx-anel" aria-hidden="true"></div><div>Carregando o painel…</div></div>
<script>(function(){
  var el = document.getElementById('cxCarregando'), pronto = false, relogio = null;
  function mostrar(){ if (pronto) return; el.style.display = 'flex'; clearTimeout(relogio); relogio = setTimeout(esconder, 30000); }
  function esconder(){ el.style.display = 'none'; }
  window.__cxPronto = function(){ pronto = true; esconder(); };
  try { var chaves = Object.keys(localStorage).concat(Object.keys(sessionStorage)); if (chaves.some(function(k){ return /auth-token|sessao/.test(k); })) mostrar(); } catch (e) {}
  // Login feito: a tela de entrada some e o painel começa a montar por baixo.
  document.addEventListener('DOMContentLoaded', function(){
    var gate = document.getElementById('splashGate'); if (!gate) return;
    new MutationObserver(function(){ var some = gate.classList.contains('hide') || getComputedStyle(gate).display === 'none'; if (some) mostrar(); }).observe(gate, { attributes:true, attributeFilter:['class', 'style'] });
  });
})();</script>
`;

export function comCarregamentoHtml(html) {
  const marca = '<div id="splashGate">';
  if (html.split(marca).length !== 2) throw Error('Tela de login mudou (carregamento).');
  if (!html.includes('</head>')) throw Error('Sem </head> (carregamento).');
  return html.replace('</head>', () => ESTILO + '\n</head>').replace(marca, () => CAIXA + marca);
}

export function comCarregamentoJs(js) {
  const de = '    trocarArea(permitidas[0]);\n    sincronizarNotas();\n  }';
  if (js.split(de).length !== 2) throw Error('Final do entrar() mudou (carregamento).');
  return js.replace(de, () => '    trocarArea(permitidas[0]);\n    sincronizarNotas();\n    requestAnimationFrame(() => setTimeout(() => window.__cxPronto && window.__cxPronto(), 0));\n  }');
}
