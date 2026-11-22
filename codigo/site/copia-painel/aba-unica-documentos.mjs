// 19/11/2026 (Beatriz, Engenharia): "cada clique no DANFE/Boleto abre uma guia nova". O botão "2 monitores" foi escondido na tela nova
// (areas-novas.css), e sem ele o painel abria cada arquivo numa aba nova. Agora o arquivo abre SEMPRE numa mesma aba de documentos:
// o primeiro clique cria a aba e os seguintes só trocam o arquivo nela. Quem já tinha o "2 monitores" ligado continua com a janela
// no outro monitor (mesmo nome de janela). Ctrl/Shift/clique do meio no link do portal continuam abrindo aba nova, como o navegador faz.
// Aplicado nos painéis de Expansão e Engenharia.
export function comAbaUnicaDocumentos(html){
  const trocar = (de, para) => { const n = html.split(de).length - 1; if (n !== 1) throw Error(`aba-unica-documentos: esperava 1x, achei ${n}x: ${de.slice(0, 70)}`); html = html.split(de).join(para); };
  const trocarRe = (re, para) => { const n = (html.match(re) || []).length; if (n !== 1) throw Error(`aba-unica-documentos: esperava 1x, achei ${n}x: ${re}`); html = html.replace(re, para); };
  // 1) Sem "2 monitores": mesma aba nomeada (reaproveitada a cada clique), em vez de uma aba nova.
  trocar("    if(!usar2Monitores){\n      window.open(url, '_blank');\n      return;\n    }",
    "    if(!usar2Monitores){\n" +
    "      // 19/11/2026: uma aba só para os documentos; o clique seguinte troca o arquivo nela (não abre outra).\n" +
    "      const aba = window.open(url, NOME_JANELA_ARQUIVOS);\n" +
    "      if(!aba){ window.open(url, '_blank'); return; }\n" +
    "      try{ aba.focus(); }catch(e){ /* sem foco: a aba já mostra o arquivo */ }\n" +
    "      return;\n    }");
  // 2) Link "Abrir nota" do portal: também na mesma aba (antes só com "2 monitores" ligado).
  trocarRe(/        if\(localStorage\.getItem\('painel_(?:eng|nf)_usar_2_monitores'\) === '1'\)\{\n          e\.preventDefault\(\);\n          abrirArquivoExterno\(a\.getAttribute\('href'\)\);/,
    "        if(!(e.ctrlKey || e.metaKey || e.shiftKey || e.button)){\n          e.preventDefault();\n          abrirArquivoExterno(a.getAttribute('href'));");
  // 3) Arquivo aberto pela lista de "vincular boleto/nota": mesma aba de documentos.
  trocar("else urlAssinadaDocumento(path).then(u => { if(u) window.open(u, '_blank'); });",
    "else urlAssinadaDocumento(path).then(u => { if(u) abrirArquivoExterno(u); });");
  return html;
}
