import { readFileSync } from 'node:fs';
// Favicon da aba: só o símbolo V da Empresa Exemplo, em PNG com fundo transparente (na versão pública, uma marca neutra no lugar do símbolo original).
// Usado pelos geradores de Expansão (demonstração e homologação) e de Engenharia.
export function comFavicon(html) {
  const png = readFileSync(new URL('../integracao/empresa-exemplo-aba.png', import.meta.url));
  const href = 'data:image/png;base64,' + png.toString('base64');
  const tag = '<link rel="icon" type="image/png" id="pwaFavicon">';
  if (!html.includes(tag)) throw Error('Tag do favicon mudou.');
  html = html.replace(tag, `<link rel="icon" type="image/png" id="pwaFavicon" href="${href}">`);
  const marca = 'if(fav) fav.href = icon192;';
  if (!html.includes(marca)) throw Error('Inicialização do favicon mudou.');
  return html.replace(marca, `if(fav){ fav.type = 'image/png'; fav.href = '${href}'; }`);
}
