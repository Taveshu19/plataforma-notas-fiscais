// Site oficial dos painéis (Gustavo, 15/11/2026): menu + Expansão + Engenharia + Administrativo (TAG) num endereço só.
//   node publicados/montar-oficial.mjs             → gera tudo de novo e monta publicados/site
//   node publicados/montar-oficial.mjs --publicar  → monta e publica no site oficial
// Cada painel continua com a sua fonte (lista abaixo); este script só junta o resultado. Nunca edite publicados/site à mão.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PROJETO = join(AQUI, '..');
// Caminho relativo às pastas deste repositório (codigo/).
const TAG = join(PROJETO, '../tag/notas-fiscais');
// Caminho relativo às pastas deste repositório (codigo/).
const MENU = join(PROJETO, '../menu/index.html');
const SITE = join(AQUI, 'site');
const SITE_ID = '00000000-0000-0000-0000-000000000000';   // site paineis-empresa-exemplo (Netlify)
const ENDERECO = 'https://seu-site.netlify.app';

function trocar(texto, de, para, nome){
  const n = texto.split(de).length - 1;
  if (n < 1) throw Error(`${nome}: trecho não encontrado: ${de}`);
  return texto.split(de).join(para);
}
function gravar(arquivo, texto){
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo + '.tmp', texto, 'utf8');
  renameSync(arquivo + '.tmp', arquivo);
}
const rodar = (script, cwd) => execFileSync(process.execPath, [script], { cwd, stdio: 'inherit' });
// Cópia arquivo a arquivo: cpSync derruba o Node ao ler pastas do OneDrive (arquivos sob demanda).
function copiarPasta(de, para){
  mkdirSync(para, { recursive: true });
  for (const e of readdirSync(de, { withFileTypes: true })){
    if (e.isDirectory()) copiarPasta(join(de, e.name), join(para, e.name));
    else writeFileSync(join(para, e.name), readFileSync(join(de, e.name)));
  }
}

// 1) Gera cada painel a partir da própria fonte.
rodar('copia-engenharia/montar-copia-engenharia.mjs', PROJETO);
rodar('producao/homologacao/montar.mjs', PROJETO);
rodar('producao/engenharia/montar.mjs', PROJETO);

// 2) Junta tudo em publicados/site.
rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

// Menu na raiz, apontando para os painéis do próprio site.
let menu = readFileSync(MENU, 'utf8');
menu = trocar(menu, 'href="https://seu-site-expansao.netlify.app"', 'href="/expansao/"', 'menu');
menu = trocar(menu, 'href="https://seu-site-engenharia.netlify.app"', 'href="/engenharia/"', 'menu');
// 17/11/2026 (Gustavo): logo da Holding ao lado da Empresa Exemplo, sem o fundo branco (publicados/recursos/logo-holding.png,
// gerada da imagem enviada por ele). No tema escuro ela fica sobre o mesmo fundo claro arredondado da marca Empresa Exemplo.
menu = trocar(menu, '<div class="brand" aria-label="Empresa Exemplo — Portal de equipes">', '<div class="brand" aria-label="Empresa Exemplo e Holding — Portal de equipes">', 'menu');
menu = trocar(menu, '<div class="brand-name">EMPRESA EXEMPLO<span class="brand-sub">PORTAL DE EQUIPES</span></div>',
  '<div class="brand-name">EMPRESA EXEMPLO<span class="brand-sub">PORTAL DE EQUIPES</span></div>\n        <span class="brand-sep" aria-hidden="true"></span>\n        <img class="brand-holding" src="/logo-holding.png" alt="Holding" width="155" height="24">', 'menu');
menu = trocar(menu, '    .brand-sub { display:block;', `    .brand-sep { width:1px; height:30px; background:var(--line); margin:0 6px; flex-shrink:0; }
    .brand-holding { display:block; height:24px; width:auto; flex-shrink:0; }
    html[data-theme="dark"] .brand-holding { height:40px; box-sizing:border-box; padding:8px 12px; background:#f5f8ff; border-radius:10px; box-shadow:0 0 0 1px #ffffff1f; }
    @media(max-width:520px){ .brand-sep{margin:0 2px;height:24px} .brand-holding{height:18px} html[data-theme="dark"] .brand-holding{height:32px;padding:7px 9px} }
    .brand-sub { display:block;`, 'menu');
// 17/11/2026 (Gustavo): volta o cartão Administrativo, que abre direto o login do painel Notas TAG (/tag/).
// Assim o Otávio e o BO entram na TAG sem passar pelo painel de Engenharia.
menu = trocar(menu, '.cards-grid { grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; max-width:900px; margin-inline:auto; }',
  '.cards-grid { grid-template-columns:repeat(3,minmax(0,1fr)); width:100%; max-width:1240px; margin-inline:auto; }\n    @media(max-width:900px){ .cards-grid { grid-template-columns:1fr; max-width:520px; } }', 'menu');
menu = trocar(menu, '          </a>\n        </div>\n      </nav>', `          </a>
        </div>
        <div class="card-entry enter">
          <a class="team-card card-administrativo" id="card-adm" data-team-id="adm" data-team-name="Administrativo" href="/tag/" aria-labelledby="title-adm">
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
            <div class="card-content"><h2 class="team-name" id="title-adm">Administrativo</h2></div>
            <div class="card-action"><span class="action-arrow" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></span></div>
          </a>
        </div>
      </nav>`, 'menu');
gravar(join(SITE, 'index.html'), menu);
{ const logo = readFileSync(join(AQUI, 'recursos', 'logo-holding.png')); writeFileSync(join(SITE, 'logo-holding.png.tmp'), logo); renameSync(join(SITE, 'logo-holding.png.tmp'), join(SITE, 'logo-holding.png')); }

// Expansão (banco real) e o Portfólio do nosso sistema.
gravar(join(SITE, 'expansao', 'index.html'), readFileSync(join(PROJETO, 'producao/homologacao/index.html'), 'utf8'));
// O Portfólio de Projetos vinha de outro site (de outra equipe) e não está neste repositório: entra só se existir.
if (existsSync(join(PROJETO, 'producao/homologacao/dist/portfolio'))) copiarPasta(join(PROJETO, 'producao/homologacao/dist/portfolio'), join(SITE, 'expansao', 'portfolio'));

// Engenharia (banco REAL, 16/11/2026): Aprovações, Contratos e Notas TAG; a aba Administrativo abre o painel da TAG deste mesmo site.
let engReal = readFileSync(join(PROJETO, 'producao/engenharia/index.html'), 'utf8');
engReal = trocar(engReal, 'https://seu-site-tag-demo.netlify.app/', '/tag/', 'engenharia');
if (engReal.includes('seu-site-tag-demo')) throw Error('engenharia: sobrou endereço antigo do painel da TAG.');
gravar(join(SITE, 'engenharia', 'index.html'), engReal);


// Engenharia (demonstração, dados fictícios): preservada em /engenharia-demo/.
let eng = readFileSync(join(PROJETO, 'copia-engenharia/index.html'), 'utf8');
eng = trocar(eng, 'frame-src https://seu-site-tag-demo.netlify.app', "frame-src 'self'", 'engenharia-demo');
eng = trocar(eng, 'https://seu-site-tag-demo.netlify.app/', '/tag/', 'engenharia-demo');
if (eng.includes('seu-site-tag-demo')) throw Error('engenharia-demo: sobrou endereço antigo do painel da TAG.');
gravar(join(SITE, 'engenharia-demo', 'index.html'), eng);

// Administrativo (TAG REAL, 16/11/2026) em /tag/: a mesma tela da TAG, agora com login obrigatório e dados no banco da Engenharia.
// /api/* e /files/* vão para a função tag-api (Supabase). A demonstração com dados fictícios continua só localmente (tools/build-demo.mjs).
const TAG_PUBLIC = join(TAG, 'public'), VISUAL = join(TAG, '..', 'ecossistema-visual');
let tag = readFileSync(join(TAG_PUBLIC, 'index.html'), 'utf8');
tag = trocar(tag, 'href="/visual/', 'href="/tag/visual/', 'tag');
tag = trocar(tag, 'href="/notas.css"', 'href="/tag/notas.css"', 'tag');
tag = trocar(tag, 'src="/app.js"', 'src="/tag/app.js"', 'tag');
// 17/11/2026 (Gustavo): a TAG segue o visual da Expansão. Antes ela usava cópias congeladas de 14/11 (pasta ecossistema-visual) e não
// tinha os tokens base da Expansão (fontes Manrope/Inter/JetBrains Mono, cores, linhas, painéis): os componentes caíam em outra fonte.
// Agora: estilos atuais da Expansão (copia-painel) + tokens extraídos do painel da Expansão gerado acima, a cada montagem.
tag = trocar(tag, '<link rel="stylesheet" href="/tag/visual/areas-novas.css">', '<link rel="stylesheet" href="/tag/visual/base-expansao.css">\n  <link rel="stylesheet" href="/tag/visual/areas-novas.css">', 'tag');
// Botão "Exportar Excel" da TAG (17/11/2026): a mesma biblioteca dos painéis, carregada sem travar a abertura.
tag = trocar(tag, '<script type="module" src="/tag/app.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" crossorigin="anonymous" async></script>\n  <script type="module" src="/tag/app.js"></script>', 'tag');
// 19/11/2026 (Gustavo): aba "Controle de Lançamentos" (Marina, Laura e Tatiana), fonte em producao/controle/. Usa o banco da EXPANSÃO
// (o login delas é o da Expansão): o endereço e a chave pública vêm do painel da Expansão gerado acima, a cada montagem.
tag = trocar(tag, '<link rel="stylesheet" href="/tag/notas.css">', '<link rel="stylesheet" href="/tag/notas.css">\n  <link rel="stylesheet" href="/tag/controle.css">', 'tag');
tag = trocar(tag, '<script type="module" src="/tag/app.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.js"></script>\n  <script src="/tag/controle.js"></script>\n  <script type="module" src="/tag/app.js"></script>', 'tag');
{
  const exp = readFileSync(join(PROJETO, 'producao', 'homologacao', 'index.html'), 'utf8');
  const url = exp.match(/SUPABASE_URL\s*=\s*"(https:\/\/seu-projeto-expansao\.supabase\.co)"/)?.[1], chave = exp.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
  if (!url || !chave) throw Error('Controle de Lançamentos: não achei o endereço/chave pública da Expansão no painel gerado.');
  let ctl = readFileSync(join(PROJETO, 'producao', 'controle', 'controle.js'), 'utf8');
  ctl = trocar(trocar(ctl, "'__EXP_URL__'", JSON.stringify(url), 'controle'), "'__EXP_KEY__'", JSON.stringify(chave), 'controle');
  gravar(join(SITE, 'tag', 'controle.js'), ctl);
  gravar(join(SITE, 'tag', 'controle.css'), readFileSync(join(PROJETO, 'producao', 'controle', 'controle.css'), 'utf8'));
}
gravar(join(SITE, 'tag', 'index.html'), tag);
for (const n of ['app.js', 'notas.css']) gravar(join(SITE, 'tag', n), readFileSync(join(TAG_PUBLIC, n), 'utf8'));
for (const n of ['direcao.css', 'areas-novas.css']) gravar(join(SITE, 'tag', 'visual', n), readFileSync(join(PROJETO, 'copia-painel', n), 'utf8'));
for (const n of ['verde-notas.css', 'manifesto.json']) gravar(join(SITE, 'tag', 'visual', n), readFileSync(join(VISUAL, n), 'utf8'));
{
  const exp = readFileSync(join(PROJETO, 'producao', 'homologacao', 'index.html'), 'utf8');
  const bloco = inicio => {
    const i = exp.indexOf(inicio); if (i < 0) throw Error('Tokens da Expansão: não achei ' + inicio.trim());
    const j = exp.indexOf('\n  }', i + inicio.length); if (j < 0) throw Error('Tokens da Expansão: fim do bloco ' + inicio.trim());
    return exp.slice(i, j + 4).trim();
  };
  const tokens = `/* Tokens base da Expansão (fontes e cores), gerados por publicados/montar-oficial.mjs. Não editar aqui: a fonte é o painel da Expansão. */\n${bloco('\n  :root{\n')}\n${bloco('\n  :root[data-theme="claro"]{')}\n`;
  for (const t of ['--display:', '--mono:', '--ink:', '--panel:', '--line:']) if (!tokens.includes(t)) throw Error('Tokens da Expansão sem ' + t);
  gravar(join(SITE, 'tag', 'visual', 'base-expansao.css'), tokens);
}
const FUNCAO_TAG = 'https://seu-projeto-engenharia.supabase.co/functions/v1/tag-api';
gravar(join(SITE, '_redirects'), `/api/* ${FUNCAO_TAG}/api/:splat 200\n/files/* ${FUNCAO_TAG}/files/:splat 200\n`);
console.log('Site oficial montado em', SITE);

// 3) Publica (só com --publicar). Funções do painel da TAG: sessão e primeiro acesso.
if (process.argv.includes('--publicar')) {
  const token = process.env.NETLIFY_AUTH_TOKEN || readFileSync(join(homedir(), '.netlify-painel', 'token.txt'), 'utf8').trim();
  // A TAG real não usa mais funções do Netlify (tudo vai pela função tag-api, no Supabase): só o site estático e o _redirects.
  const r = spawnSync('netlify', ['deploy', '--prod', '--dir', SITE, '--site', SITE_ID, '--no-build', '--message', 'Site oficial: menu, Expansão, Engenharia e TAG real'],
    { stdio: 'inherit', shell: true, env: { ...process.env, NETLIFY_AUTH_TOKEN: token } });
  if (r.status !== 0) throw Error('Publicação falhou.');
  console.log('Publicado em', ENDERECO);
}
