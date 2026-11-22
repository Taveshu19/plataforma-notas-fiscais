import { comCartoes } from './cartoes-aprovacoes.mjs';
import { comFavicon } from './favicon.mjs';
import { comCarregamentoHtml, comCarregamentoJs } from './carregamento.mjs';
import { comContratosEComprasExpansao, comBancoDemoExpansao } from './contratos-compras-expansao.mjs';
// Gera copia-painel/index.html a partir do painel real, SEM alterar o original.
// Uso: node montar-copia.mjs
// A cópia fica desligada do Supabase: o cliente real sai, entra um banco falso, e a política
// de segurança do navegador bloqueia qualquer conexão. Se um trecho do original mudar, o
// script para com erro em vez de gerar uma cópia mal isolada.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
// Caminho relativo às pastas deste repositório (codigo/).
const ORIGEM = join(AQUI, '../../paineis-originais/Expansão/painel/index.html');
const ler = n => readFileSync(join(AQUI, n), 'utf8');
let html = readFileSync(ORIGEM, 'utf8');

function trocar(de, para, vezes = 1){
  const achados = html.split(de).length - 1;
  if (achados !== vezes) throw Error(`Esperava ${vezes}x, achei ${achados}x: ${de}`);
  html = html.split(de).join(para);
}
// Para marcas que também aparecem dentro de janelas geradas pelo painel.
function trocarNaPosicao(marca, para, ultima = false){
  const i = ultima ? html.lastIndexOf(marca) : html.indexOf(marca);
  if (i < 0) throw Error('Marca não encontrada: ' + marca);
  html = html.slice(0, i) + para + html.slice(i + marca.length);
}
function trocarRegex(re, para){
  if (!re.test(html)) throw Error('Trecho não encontrado: ' + re);
  re.lastIndex = 0;
  html = html.replace(re, para);
}

const POLITICA = ["default-src 'none'", "script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com data:', 'img-src data: blob:',
  "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "object-src 'none'", "frame-src 'none'"].join('; ');

const js = comBancoDemoExpansao(ler('demo-banco.js')), jsAreas = ler('regras-expansao.js') + '\n' + ler('reservas.js') + '\n' + comContratosEComprasExpansao(comCartoes(comCarregamentoJs(ler('areas-novas.js')))), jsDemo = ler('demo-interface.js');
if (/<\/script/i.test(js + jsAreas + jsDemo)) throw Error('Os scripts não podem conter o fechamento de script.');

trocarNaPosicao('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="${POLITICA}">\n<meta name="robots" content="noindex">\n<script>window.showDirectoryPicker = undefined;</script>`);
trocarRegex(/<title>[^<]*<\/title>/, '<title>CÓPIA DE DEMONSTRAÇÃO · Painel</title>');
trocarRegex(/<script src="https:\/\/unpkg\.com\/@supabase[^\n]*\r?\n<script>window\.supabase \|\|[^\n]*\r?\n/, () => `<script>\n${js}\n</script>\n`);

trocarRegex(/const SUPABASE_URL = "[^"]*";/, 'const SUPABASE_URL = "http://demonstracao.invalid";');
trocarRegex(/const SUPABASE_ANON_KEY = "[^"]*";/, 'const SUPABASE_ANON_KEY = "demonstracao";');
trocarRegex(/const APP_BUILD = "([^"]*)";/, 'const APP_BUILD = "$1-copia-demonstracao";');

// Nada de preferências, pastas ou sessão do painel real nesta cópia.
trocarRegex(/\blocalStorage\b/g, 'sessionStorage');
trocar("indexedDB.open('painel_nf_db', 1)", "indexedDB.open('painel_nf_db_copia_demonstracao', 1)");
trocar('function abrirSetupGateSeNecessario(){', 'function abrirSetupGateSeNecessario(){ return;');
trocar('if(jaCarregou) return; jaCarregou = true;', 'if(jaCarregou) return; jaCarregou = true;\n    window.__demoEmail = currentEmail; if(window.__demoAoEntrar) window.__demoAoEntrar(currentEmail);');
trocarRegex(/alert\('Seu navegador não suporta esse recurso\.[^']*'\)/g, () => "alert('Pastas desligadas nesta cópia de demonstração.')");

trocar('<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>', '<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>\n    <div id="cxEntrarComo"></div>');
trocar('<!-- Assistente (build106;', `<div id="cxAviso" hidden><span><b>CÓPIA DE DEMONSTRAÇÃO.</b> Dados fictícios, sem ligação com o banco real. Nada aqui chega à equipe.</span><span style="display:inline-flex;gap:10px"><label>Ver como <select id="cxVerComo"></select></label><button id="cxReiniciar">Reiniciar dados</button></span></div>
<nav id="cxAbas" role="tablist" hidden></nav>
<main id="cxArea" hidden></main>
<div id="cxModal" hidden></div><div id="cxToast" role="status" aria-live="polite" hidden></div>
<!-- Assistente (build106;`);
trocarNaPosicao('</head>', `<style>\n${ler('areas-novas.css') + '\n' + readFileSync(new URL('./../copia-engenharia/cartoes-notas.css', import.meta.url), 'utf8')}\n${ler('direcao.css')}\n</style>\n<script>if(!sessionStorage.getItem('painel_nf_tema')){sessionStorage.setItem('painel_nf_tema','claro');document.documentElement.setAttribute('data-theme','claro');}</script>\n</head>`);
trocarNaPosicao('</body>', `<script>window.ExpansaoDados = window.__demo;\n${jsAreas}\n${jsDemo}\n</script>\n</body>`, true);

// Trava final: o arquivo gerado não pode citar o banco real.
for (const proibido of [/seu-projeto-expansao/i, /sb_publishable/i, /\.supabase\.co/i, /functions\/v1/i, /unpkg\.com\/@supabase/i]){
  if (proibido.test(html)) throw Error('Sobrou referência ao banco real: ' + proibido);
}
html = comCarregamentoHtml(comFavicon(html));
const destino = join(AQUI, 'index.html');
writeFileSync(destino + '.tmp', html, 'utf8');
renameSync(destino + '.tmp', destino);
console.log('Cópia gerada:', destino, Math.round(html.length / 1024) + ' kB');
