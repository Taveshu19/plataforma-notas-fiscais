// Monta a demonstração pública em demo/ (raiz do repositório): menu, Expansão, Engenharia e TAG, só com dados fictícios.
//   node codigo/montar-demo.mjs
// Cada painel é gerado da própria fonte, pelos mesmos geradores usados no projeto; este script só junta o resultado
// e deixa os endereços relativos, para a demonstração funcionar numa subpasta (GitHub Pages).
// Nunca edite demo/ à mão: ela é refeita a cada montagem.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semMonday } from './site/copia-painel/sem-monday.mjs';

const CODIGO = dirname(fileURLToPath(import.meta.url));
const SITE = join(CODIGO, 'site');
const TAG = join(CODIGO, 'tag', 'notas-fiscais');
const DEMO = join(CODIGO, '..', 'demo');
const REPOSITORIO = 'https://github.com/Taveshu19/plataforma-notas-fiscais';

function trocar(texto, de, para, nome) {
  const n = texto.split(de).length - 1;
  if (n < 1) throw Error(`${nome}: trecho não encontrado: ${de.slice(0, 90)}`);
  return texto.split(de).join(para);
}
// Insere antes da PRIMEIRA ocorrência (o painel também tem "</head>" dentro de textos do próprio código).
function antesDe(texto, marca, trecho, nome) {
  const i = texto.indexOf(marca);
  if (i < 0) throw Error(`${nome}: trecho não encontrado: ${marca}`);
  return texto.slice(0, i) + trecho + texto.slice(i);
}
function gravar(arquivo, conteudo) {
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo + '.tmp', conteudo);
  renameSync(arquivo + '.tmp', arquivo);
}
function copiarPasta(de, para, pular = []) {
  mkdirSync(para, { recursive: true });
  for (const e of readdirSync(de, { withFileTypes: true })) {
    if (pular.includes(e.name)) continue;
    if (e.isDirectory()) copiarPasta(join(de, e.name), join(para, e.name), pular);
    else copyFileSync(join(de, e.name), join(para, e.name));
  }
}
const rodar = (script, cwd) => execFileSync(process.execPath, [script], { cwd, stdio: 'inherit' });

// 1) Gera cada demonstração a partir da fonte.
rodar('copia-painel/montar-copia.mjs', SITE);
rodar('copia-engenharia/montar-copia-engenharia.mjs', SITE);
rodar('tools/build-demo.mjs', TAG);

// 2) Junta tudo em demo/.
rmSync(DEMO, { recursive: true, force: true });
mkdirSync(DEMO, { recursive: true });

// O Portfólio de Projetos era outro site (de outra equipe), aberto dentro do painel: fica fora da demonstração.
const semPortfolioExterno = (html, nome) => trocar(html, 'https://seu-portfolio.netlify.app/', 'about:blank', nome);

// Como na produção, as telas não citam a ferramenta antiga (os dados que vieram dela aparecem como histórico).
// Primeiro o mesmo filtro da produção; depois o que sobrou só nos textos (identificadores como escriturarMonday ficam).
function semNomeAntigo(html, filtroDaProducao = true) {
  if (filtroDaProducao) html = semMonday(html);
  for (const [de, para] of [['da Monday', 'do sistema antigo'], ['na Monday', 'no sistema antigo'], ['à Monday', 'ao sistema antigo'],
    ['pra Monday', 'pro sistema antigo'], ['pela Monday', 'pelo sistema antigo'], ['a Monday', 'o sistema antigo'], ['o Monday', 'o sistema antigo']]) {
    html = html.replace(new RegExp(`(?<![A-Za-zÀ-ÿ])${de}(?![A-Za-z0-9_])`, 'g'), para);
  }
  return html.replace(/(?<![A-Za-z0-9_$])Monday(?![A-Za-z0-9_])/g, 'sistema antigo');
}

// Expansão: Aprovações, Contratos, Compras, Projetos e Lançamento, com banco falso na memória da página.
// A aba "Portfólio (nosso sistema)" abria a página gerada do Portfólio, que não faz parte deste repositório: fica escondida.
let exp = semNomeAntigo(semPortfolioExterno(readFileSync(join(SITE, 'copia-painel', 'index.html'), 'utf8'), 'expansao'));
exp = antesDe(exp, '</head>', '<style>/* demonstração pública */ [data-area="portfolioNosso"]{display:none!important}</style>\n', 'expansao');
gravar(join(DEMO, 'expansao', 'index.html'), exp);

// Engenharia: a aba Notas TAG abre a demonstração da TAG desta mesma pasta.
let eng = semNomeAntigo(semPortfolioExterno(readFileSync(join(SITE, 'copia-engenharia', 'index.html'), 'utf8'), 'engenharia'));
eng = trocar(eng, 'frame-src https://seu-site-tag-demo.netlify.app', "frame-src 'self'", 'engenharia');
eng = trocar(eng, 'https://seu-site-tag-demo.netlify.app/', '../tag/', 'engenharia');
gravar(join(DEMO, 'engenharia', 'index.html'), eng);

// TAG: site estático com a API simulada no navegador (demo-install.mjs).
copiarPasta(join(TAG, 'demo'), join(DEMO, 'tag'), ['_redirects']);
gravar(join(DEMO, 'tag', 'app.js'), semNomeAntigo(readFileSync(join(DEMO, 'tag', 'app.js'), 'utf8'), false));
{ // ícone da aba (a TAG não tinha um próprio): a mesma marca neutra dos outros painéis
  const icone = readFileSync(join(SITE, 'integracao', 'empresa-exemplo-aba.png')).toString('base64');
  gravar(join(DEMO, 'tag', 'index.html'), antesDe(readFileSync(join(DEMO, 'tag', 'index.html'), 'utf8'), '</head>',
    `  <link rel="icon" type="image/png" href="data:image/png;base64,${icone}">\n`, 'tag'));
}

// Menu: os três painéis, com endereços relativos e o aviso de demonstração.
let menu = readFileSync(join(CODIGO, 'menu', 'index.html'), 'utf8');
menu = trocar(menu, 'href="https://seu-site-expansao.netlify.app"', 'href="expansao/"', 'menu');
menu = trocar(menu, 'href="https://seu-site-engenharia.netlify.app"', 'href="engenharia/"', 'menu');
menu = trocar(menu, '.cards-grid { grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; max-width:900px; margin-inline:auto; }',
  '.cards-grid { grid-template-columns:repeat(3,minmax(0,1fr)); width:100%; max-width:1240px; margin-inline:auto; }\n    @media(max-width:900px){ .cards-grid { grid-template-columns:1fr; max-width:520px; } }', 'menu');
menu = trocar(menu, '          </a>\n        </div>\n      </nav>', `          </a>
        </div>
        <div class="card-entry enter">
          <a class="team-card card-administrativo" id="card-adm" data-team-id="adm" data-team-name="Administrativo" href="tag/" aria-labelledby="title-adm">
            <div class="card-top"><svg class="team-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h9l5 5v15H6Z"/><path d="M15 2v5h5M9 12h8M9 16h8"/></svg></div>
            <svg class="card-art" viewBox="0 0 250 150" fill="none" aria-hidden="true">
              <g stroke="currentColor" stroke-width=".8"><path d="M31 125h189M43 137V18m165 119V18M29 27h194" stroke-dasharray="2 5" opacity=".18"/></g>
              <g class="art-detail" stroke="currentColor" stroke-linejoin="round">
                <path d="M88 22h56l22 22v92H88Z" fill="currentColor" fill-opacity=".035" opacity=".7"/>
                <path d="M144 22v22h22" opacity=".55"/>
                <path d="M100 66h54M100 82h54M100 98h54M100 114h34" opacity=".4"/>
                <rect x="70" y="40" width="56" height="92" rx="2" fill="currentColor" fill-opacity=".05" opacity=".35"/>
              </g>
            </svg>
            <div class="card-content"><h2 class="team-name" id="title-adm">Administrativo · TAG</h2></div>
            <div class="card-action"><span class="action-arrow" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span></div>
          </a>
        </div>
      </nav>`, 'menu');
menu = trocar(menu, '</body>', `<div class="demo-aviso" role="note">Demonstração com dados fictícios: nada aqui sai da sua tela. Em cada painel, use “Ver como” para trocar de perfil. <a href="${REPOSITORIO}">Sobre o projeto</a></div>
<style>
  .demo-aviso { position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:50; max-width:calc(100% - 32px); box-sizing:border-box;
    padding:10px 16px; border-radius:12px; font:500 13px/1.45 Inter, system-ui, sans-serif; color:#0b1530; background:#eef3ff; border:1px solid #c9d6f5; box-shadow:0 6px 24px #0b153022; }
  .demo-aviso a { color:#1d4ed8; font-weight:600; }
  html[data-theme="dark"] .demo-aviso { color:#e8eeff; background:#16213f; border-color:#2b3b66; }
  html[data-theme="dark"] .demo-aviso a { color:#9db8ff; }
</style>
</body>`, 'menu');
gravar(join(DEMO, 'index.html'), menu);

// A proposta navegável de 05/11/2026 (o ponto de partida da fase 2), com dados fictícios.
// O levantamento completo era um documento interno; na versão pública o link leva à história da migração.
gravar(join(DEMO, 'proposta.html'), trocar(readFileSync(join(SITE, 'proposta.html'), 'utf8'), 'href="docs/levantamento-2026-11-05.md"',
  `href="${REPOSITORIO}/blob/main/docs/12-migracao.md"`, 'proposta'));

// Página de entrada do GitHub Pages sem processamento Jekyll (pastas e arquivos são servidos como estão).
gravar(join(DEMO, '.nojekyll'), '');

// 3) Trava final: nada do ambiente real pode estar na demonstração.
const PROIBIDOS = [/\.supabase\.co/i, /functions\/v1/i, /sb_publishable_(?!SUA_CHAVE)/i, /sb_secret_(?!chave_do_gatilho)/i,
  /netlify\.app/i, /monday\.com\/boards\/(?!0+\b)/i];
const achados = [];
(function varrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const p = join(pasta, nome);
    if (statSync(p).isDirectory()) { varrer(p); continue; }
    if (!['.html', '.js', '.mjs', '.css', '.json'].includes(extname(p))) continue;
    const texto = readFileSync(p, 'utf8');
    for (const re of PROIBIDOS) if (re.test(texto)) achados.push(`${relative(DEMO, p)}: ${re}`);
  }
})(DEMO);
if (achados.length) throw Error('A demonstração cita o ambiente real:\n' + achados.join('\n'));
console.log('Demonstração montada em', DEMO);
