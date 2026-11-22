// Empacota a interface para a etapa de integração, sem login fictício ou banco de teste.
// O pacote não ativa serviços reais. Consulte integracao/README.md.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, '../integracao');
mkdirSync(destino, { recursive:true });
const ler = nome => readFileSync(resolve(aqui, nome), 'utf8');
const arquivos = {
  'expansao.css': ler('areas-novas.css') + '\n' + ler('direcao.css').split('/* Entrada da prévia:')[0],
  'expansao.js': ler('regras-expansao.js') + '\n' + ler('reservas.js') + '\n' + ler('areas-novas.js'),
  'estrutura.html': '<!-- Inserir depois do cabeçalho do painel; carregar CSS após o CSS existente. -->\n<nav id="cxAbas" role="tablist" aria-label="Áreas do painel" hidden></nav>\n<main id="cxArea" hidden></main>\n<div id="cxModal" hidden></div>\n<div id="cxToast" role="status" aria-live="polite" hidden></div>\n',
};
if (/window\.__demo|cxEntrarComo|cxVerComo|cxReiniciar/.test(arquivos['expansao.js'])) throw Error('Controle de demonstração encontrado no módulo.');
const manifesto = { versao:'2026-11-06', estado:'interface para integração; serviços ainda simulados', arquivos:{} };
for (const [nome, conteudo] of Object.entries(arquivos)){
  const arquivo = resolve(destino, nome);
  writeFileSync(arquivo + '.tmp', conteudo); renameSync(arquivo + '.tmp', arquivo);
  manifesto.arquivos[nome] = createHash('sha256').update(conteudo).digest('hex');
}
const arquivo = resolve(destino, 'manifesto.json');
writeFileSync(arquivo + '.tmp', JSON.stringify(manifesto, null, 2) + '\n'); renameSync(arquivo + '.tmp', arquivo);
console.log('Pacote de interface gerado em', destino);
