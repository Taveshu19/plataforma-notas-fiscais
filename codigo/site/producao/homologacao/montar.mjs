import { comLoginPadrao, comSemSaudacao } from '../../copia-painel/entrada-padrao.mjs';
import { comCartoes } from '../../copia-painel/cartoes-aprovacoes.mjs';
import { comFavicon } from '../../copia-painel/favicon.mjs';
import { comInclusaoManual } from '../../copia-painel/inclusao-manual.mjs';
import { comCarregamentoHtml, comCarregamentoJs } from '../../copia-painel/carregamento.mjs';
import { comContratosEComprasExpansao } from '../../copia-painel/contratos-compras-expansao.mjs';
import { semMonday } from '../../copia-painel/sem-monday.mjs';
import { comBoletoDepoisDoEnvio } from '../../copia-painel/boleto-depois-do-envio.mjs';
import { comAbaUnicaDocumentos } from '../../copia-painel/aba-unica-documentos.mjs';
// Gera producao/homologacao/index.html: o painel atual + Aprovações e Compras, ligado ao banco REAL.
// Uso: node producao/homologacao/montar.mjs
// O painel original (C:/Painéis/Expansão/painel/index.html) só é lido; ele publica sozinho no
// Netlify quando muda, por isso nada é gravado lá. Se um trecho do original mudar, o script para.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA = join(AQUI, '../../copia-painel');
// Caminho relativo às pastas deste repositório (codigo/).
const ORIGEM = join(AQUI, '../../../paineis-originais/Expansão/painel/index.html');
const ler = (pasta, nome) => readFileSync(join(pasta, nome), 'utf8');
let html = readFileSync(ORIGEM, 'utf8');

function trocar(de, para){
  const n = html.split(de).length - 1;
  if (n !== 1) throw Error(`Esperava 1x, achei ${n}x: ${de.slice(0, 80)}`);
  html = html.split(de).join(para);
}
function trocarRegex(re, para){ if (!re.test(html)) throw Error('Trecho não encontrado: ' + re); re.lastIndex = 0; html = html.replace(re, para); }
function naPosicao(marca, para, ultima = false){
  const i = ultima ? html.lastIndexOf(marca) : html.indexOf(marca);
  if (i < 0) throw Error('Marca não encontrada: ' + marca);
  html = html.slice(0, i) + para + html.slice(i + marca.length);
}

const css = ler(COPIA, 'areas-novas.css') + '\n' + readFileSync(new URL('../../copia-painel/../copia-engenharia/cartoes-notas.css', import.meta.url), 'utf8') + '\n' + ler(COPIA, 'direcao.css').split('/* Entrada da prévia:')[0];
const js = ler(AQUI, 'adaptador-producao.js') + '\n' + ler(COPIA, 'regras-expansao.js') + '\n' + ler(COPIA, 'reservas.js') + '\n' + comContratosEComprasExpansao(comCartoes(comCarregamentoJs(ler(COPIA, 'areas-novas.js'))));
if (/<\/script/i.test(js)) throw Error('Os scripts não podem conter o fechamento de script.');
if (/window\.__demo\b|cxEntrarComo|cxVerComo/.test(js)) throw Error('Controle da demonstração no pacote de produção.');

// Excel (900 kB) não segura mais a abertura da página (async, 14/11): baixa em paralelo e só é usado ao exportar.
// Vem do cdnjs: no unpkg a primeira abertura chegou a levar 6 s só para esse arquivo.
trocarRegex(/<script src="https:\/\/unpkg\.com\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js" crossorigin="anonymous"><\/script>\n<script>window\.XLSX \|\| document\.write\([^\n]*\n/,
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" crossorigin="anonymous" async></script>\n');
trocarRegex(/<title>[^<]*<\/title>/, '<title>Painel de Expansão · Empresa Exemplo</title>');   // 17/11/2026: era "HOMOLOGAÇÃO · ..." também no site oficial
naPosicao('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex">');   // 17/11/2026: sem desligar showDirectoryPicker (pastas ativas)
trocarRegex(/const APP_BUILD = "([^"]*)";/, 'const APP_BUILD = "$1-homologacao";');
// Sem vigia de pasta e sem a tela obrigatória de pastas: a homologação não deve criar lançamentos.
trocar("indexedDB.open('painel_nf_db', 1)", "indexedDB.open('painel_nf_db_homologacao', 1)");
trocar('function abrirSetupGateSeNecessario(){', 'function abrirSetupGateSeNecessario(){ return;');
// Equipe antes de tudo; Expansão e Compras não carregam o lançamento.
trocar('if(jaCarregou) return; jaCarregou = true;',
  'if(jaCarregou) return; jaCarregou = true;\n    // Com sessão salva, o painel chega aqui antes do script de Aprovações carregar: espera por ele.\n    if(!window.__expansaoAntes) await new Promise(ok=>{const t=setInterval(()=>{if(window.__expansaoAntes){clearInterval(t);ok();}},30);});\n    if(!(await window.__expansaoAntes(currentEmail))) return;\n    if(window.__expansaoAoEntrar) window.__expansaoAoEntrar(currentEmail, currentUser);\n    if(window.__expansaoSemLancamento){ const g=document.getElementById(\'splashGate\'); if(g) g.style.display=\'none\'; return; }');
trocar('<!-- Assistente (build106;', `<nav id="cxAbas" role="tablist" hidden></nav>
<main id="cxArea" hidden></main>
<div id="cxModal" hidden></div><div id="cxToast" role="status" aria-live="polite" hidden></div>
<!-- Assistente (build106;`);
// "Esqueci minha senha" no login (14/11/2026): o adaptador liga o botão e envia o pedido à função recuperar-senha.
trocar('<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>', '<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>\n    <button type="button" id="gateEsqueci" style="margin-top:12px;background:none;border:0;color:inherit;opacity:.85;text-decoration:underline;cursor:pointer;font:inherit;font-size:13px">Esqueci minha senha</button>\n    <div id="gateRecado" role="status" aria-live="polite" style="margin-top:8px;font-size:13px;line-height:1.5;opacity:.9"></div>');
naPosicao('</head>', `<style>
${css}
#cxEscolhaEquipe{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgb(10 14 20 / .78);padding:16px}
#cxEscolhaEquipe section{width:min(520px,100%);background:#fff;color:#17202f;border-radius:10px;padding:26px;font:14px/1.5 system-ui,sans-serif}
#cxEscolhaEquipe h2{margin:0 0 6px;font-size:22px}
#cxEscolhaEquipe .cx-escolhas{display:grid;gap:10px;margin:18px 0}
#cxEscolhaEquipe [data-equipe]{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px 14px;border:1px solid #c9d1dc;border-radius:8px;background:#f7f9fc;color:#17202f;font:inherit;cursor:pointer;text-align:left}
#cxEscolhaEquipe [data-equipe][aria-pressed="true"]{border-color:#1f4fd1;background:#e9effd}
#cxEscolhaEquipe [data-equipe] small{color:#596473}
#cxEscolhaEquipe [data-confirmar]{margin-left:8px;padding:7px 14px;border:0;border-radius:6px;background:#1f4fd1;color:#fff;font:inherit;cursor:pointer}
#cxEscolhaEquipe button:focus-visible{outline:2px solid #1f4fd1;outline-offset:2px}
#cxEscolhaEquipe .cx-escolha-erro{color:#ae202b}
</style>
</head>`);
naPosicao('</body>', `<script>\n${js}\n</script>\n</body>`, true);

html = comInclusaoManual(html);   // botão "＋ Incluir nota" (16/11/2026)
html = comCarregamentoHtml(comFavicon(comLoginPadrao(comSemSaudacao(html), { marca:'expansão', mensagem:'Lançamentos, aprovações, compras e projetos.' })));
html = semMonday(html);   // 19/11/2026: Monday só como histórico
html = comBoletoDepoisDoEnvio(html);   // 19/11/2026: boleto depois do envio (Laura)
html = comAbaUnicaDocumentos(html);   // 19/11/2026: arquivos abrem sempre na mesma aba (Beatriz)
const destino = join(AQUI, 'index.html');
writeFileSync(destino + '.tmp', html, 'utf8');
renameSync(destino + '.tmp', destino);
console.log('Homologação gerada:', destino, Math.round(html.length / 1024) + ' kB');
