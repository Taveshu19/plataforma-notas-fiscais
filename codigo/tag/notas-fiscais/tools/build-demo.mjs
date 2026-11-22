// Monta a versão de demonstração publicável em demo/ (site estático, sem servidor, dados fictícios).
// Copia só arquivos listados aqui: nunca data/, snapshot.json nem o export da Monday.
// Falha se encontrar qualquer dado real do quadro no resultado.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'demo');
const visualDir = resolve(root, '..', 'ecossistema-visual');

// Não apaga a pasta inteira: o OneDrive pode mantê-la travada. Os arquivos são sobrescritos.
mkdirSync(join(out, 'lib'), { recursive: true });
mkdirSync(join(out, 'visual'), { recursive: true });

function trocar(texto, de, para, minimo = 1, arquivo = '') {
  const n = texto.split(de).length - 1;
  if (n < minimo) throw new Error(`${arquivo}: esperava ao menos ${minimo}x, achei ${n}x: ${de.slice(0, 70)}`);
  return texto.split(de).join(para);
}

// Pagadores de terceiros viram nomes fictícios na demonstração. Nomes da estrutura interna
// (Holding, Empresa Exemplo, TAG e os grupos do quadro) permanecem: são o processo, não dados de terceiros.
const PAGADORES_REAIS = [
  ['TAG EXEMPLO FUNDO DE INVESTIMENTO IMOBILIARIO', 'PAGADORA EXEMPLO LTDA (DEMO)'],
  ['TAG EXEMPLO', 'PAGADORA EXEMPLO (DEMO)'],
  ['CONDOMINIO LAGO', 'CONDOMINIO EXEMPLO'],
  ['PARCEIRA LTDA', 'EMPRESA EXEMPLO LTDA'],
];
// Troca o que existir; a verificação no fim garante que nenhum nome real sobrou.
function trocarPagadores(texto) {
  let t = texto;
  for (const [de, para] of PAGADORES_REAIS) t = t.split(de).join(para);
  return t;
}

// catalog.mjs e rules.mjs/form.mjs: a lista de pagadores e a regra da TAG.
const catalog = trocarPagadores(readFileSync(join(root, 'lib', 'catalog.mjs'), 'utf8'));
writeFileSync(join(out, 'lib', 'catalog.mjs'), catalog, 'utf8');
for (const n of ['rules.mjs', 'form.mjs']) copyFileSync(join(root, 'lib', n), join(out, 'lib', n));

// app.js: mesma tela; só os pagadores, o rodapé de origem e o usuário logado mudam.
let app = trocarPagadores(readFileSync(join(root, 'public', 'app.js'), 'utf8'));
// Arquivos da nota: na demonstração, todo PDF abre o documento de exemplo que fica ao lado do app.js.
app = trocar(app, "const arq = (caminho) => { const k = tokenAtual(); return k ? caminho + '?t=' + encodeURIComponent(k) : caminho; };",
  "const arq = (caminho) => caminho.startsWith('/files/') ? new URL('documento-demo.pdf', import.meta.url).href : caminho;", 1, 'app.js');
// O interceptador de /api/ é importado antes de qualquer chamada: a ordem fica garantida pelo import.
app = "import './demo-install.mjs';\n" + app;
writeFileSync(join(out, 'app.js'), app, 'utf8');

// index.html: liga o modo demonstração antes do app.js e mostra o aviso.
let html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
html = trocar(html, '<button class="cx-btn cx-mini" id="notasTema"',
  '<span class="demo-faixa">Demonstração · dados fictícios · as alterações voltam ao início ao recarregar a página</span>\n    <button class="cx-btn cx-mini" id="notasTema"', 1, 'index.html');
// Caminhos relativos: a demonstração pode ficar numa subpasta (ex.: GitHub Pages).
for (const [de, para] of [['href="/visual/', 'href="visual/'], ['href="/notas.css"', 'href="notas.css"'], ['src="/app.js"', 'src="app.js"']]) html = trocar(html, de, para, 1, 'index.html');
html = trocar(html, '</head>', '  <style>.demo-faixa{position:fixed;left:250px;bottom:14px;z-index:5;font:500 11px var(--cx-mono);color:var(--cx-muted);}</style>\n</head>', 1, 'index.html');
writeFileSync(join(out, 'index.html'), html, 'utf8');

copyFileSync(join(root, 'public', 'notas.css'), join(out, 'notas.css'));
for (const n of ['direcao.css', 'areas-novas.css', 'verde-notas.css', 'manifesto.json']) {
  // Os CSS copiados da expansão podem ter o nome do dono em comentários: troca por um rótulo neutro.
  const texto = readFileSync(join(visualDir, n), 'utf8').replace(/Gustavo/g, 'Usuário');
  writeFileSync(join(out, 'visual', n), texto, 'utf8');
}
for (const n of ['demo-store.mjs', 'dados-ficticios.mjs', 'demo-install.mjs']) {
  copyFileSync(join(root, 'demo-src', n), join(out, n));
}

copyFileSync(join(root, 'assets', 'documento-demo.pdf'), join(out, 'documento-demo.pdf'));
writeFileSync(join(out, '_redirects'), '/files/* /documento-demo.pdf 200\n', 'utf8');

// Verificação: nenhum dado real do quadro pode estar na saída.
// O arquivo com os dados reais do quadro só existia no computador de trabalho; sem ele, vale a lista fixa abaixo.
const arqSnapshot = join(root, 'data', 'snapshot.json');
const snapshot = existsSync(arqSnapshot) ? JSON.parse(readFileSync(arqSnapshot, 'utf8')) : { items: [] };
const proibidos = new Set(['TAG EXEMPLO', 'CONDOMINIO LAGO', 'PARCEIRA LTDA', 'Reis', 'reis']);
// Fornecedores, CNPJs, contas bancárias, observações e endereços reais. Narrativas genéricas ficam de fora.
for (const it of snapshot.items) {
  for (const v of [it.supplierName, it.supplierDoc, it.bank, it.paymentNotes, it.approverNotes, ...it.address]) {
    if (v && String(v).length >= 8) proibidos.add(String(v));
  }
}
const achados = [];
function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { varrer(p); continue; }
    if (!['.html', '.css', '.js', '.mjs', '.json'].includes(extname(p))) continue;
    const texto = readFileSync(p, 'utf8');
    for (const termo of proibidos) if (texto.includes(termo)) achados.push(`${p}: ${termo.slice(0, 60)}`);
  }
}
varrer(out);
if (achados.length) {
  throw new Error(`Dados reais encontrados na demonstração. Não publicar.\n${achados.slice(0, 10).join('\n')}`);
}
console.log(JSON.stringify({ pasta: out, arquivos: readdirSync(out), verificacao: 'sem dados reais do quadro' }, null, 2));
