// 19/11/2026 (Gustavo): "a Monday só guarda o histórico; corte todo e qualquer vínculo". Aplicado no HTML final dos painéis de
// Expansão e Engenharia (producao/homologacao/montar.mjs e producao/engenharia/montar.mjs):
//  - o selo "aguardando Monday / sincronizado com a Monday" do lançamento some e o "tentar de novo" (que regravava o vínculo
//    com a Monday) não faz mais nada;
//  - os textos que diziam que a nota vai/fica/sobe na Monday passam a falar do painel.
// O que é só histórico (nota "Importada da Monday", campos antigos monday_*) continua aparecendo como histórico.
export function semMonday(html){
  const trocar = (de, para, obrigatorio = false) => {
    const n = html.split(de).length - 1;
    if (obrigatorio && n < 1) throw Error('semMonday: trecho não encontrado: ' + de.slice(0, 80));
    html = html.split(de).join(para);
  };
  // Parte que AGE: sem "tentar de novo" com a Monday e sem o selo de sincronização.
  trocar('function tentarNovamenteMonday(id){', 'function tentarNovamenteMonday(id){ return; }\n  async function tentarNovamenteMondayDesligada(id){', true);
  const i = html.indexOf('</head>'); if (i < 0) throw Error('semMonday: sem </head>');
  html = html.slice(0, i) + '<style>/* 19/11/2026: Monday desligada */ .badge.monday-sync{display:none!important}</style>\n' + html.slice(i);
  // Textos.
  trocar('A sincronização com a Monday parece ter sido concluída — a tela foi atualizada.', 'A tela foi atualizada.');
  trocar('Dados para a Monday', 'Dados da nota');
  trocar(' (fora da lista da Monday)', ' (fora da lista)');
  trocar('Documentos da nota (do lançamento e da Monday). Clique para abrir ao lado.', 'Documentos da nota. Clique para abrir ao lado.');
  trocar('Envio pedido. A nota passa para Encaminhadas quando a Monday registrar o envio.', 'Envio pedido.');
  trocar('Durante a validação, as decisões continuam na Monday.', 'Tudo é feito aqui no painel.');
  trocar(' Na Monday nada é alterado, e ela volta para cá quando for reenviada.', ' Ela volta para cá quando for reenviada.');
  trocar(' Na Monday nada é alterado, e ela volta para cá quando o lançamento reenviar.', ' Ela volta para cá quando o lançamento reenviar.');
  trocar('Não foi possível abrir o arquivo da Monday.', 'Não foi possível abrir o arquivo.');
  trocar('Os mesmos arquivos do contrato na Monday. Clique para abrir ao lado.', 'Arquivos do contrato. Clique para abrir ao lado.');
  trocar(' — isso evita que o Monday acabe com arquivos/dados duplicados. Se precisar corrigir algo, trate como um lançamento novo.', '. Para corrigir, use "Corrigir dados da nota" nas Aprovações.');
  trocar(' Boletos não viram itens na Monday, só arquivos anexados às notas.', ' O boleto vira arquivo da nota.');
  trocar(' — ele não vai subir pra Monday. Confira o boleto na Monday depois de enviar.', ' — confira o boleto na nota.');
  trocar('Quando uma delas anexar, o MESMO arquivo sobe também no item dela na Monday.', 'Quando uma delas anexar, o MESMO arquivo fica também na outra.');
  trocar('inclusive pra Monday, se ainda não tiverem sido enviadas.', 'se ainda não tiverem sido enviadas.');
  trocar('Arquivo pode continuar na Monday', 'Arquivo pode continuar em notas já enviadas');
  trocar('Lido pelo Gemini, mas confira (por isso não foi sozinha pra Monday):', 'Lido pelo Gemini, mas confira (por isso não foi enviada sozinha):');
  trocar('enviada pra Monday`', 'enviada para as Aprovações`');
  trocar('Prazo encontrado na Monday: 3 dias.', 'Prazo: 3 dias.');
  trocar('Cópia do quadro da Monday, atualizada a cada 5 minutos', 'Projetos importados do sistema antigo (histórico)');
  trocar("arquivada:'Arquivada na Monday'", "arquivada:'Arquivada (histórico)'");
  trocar("outro:'Fora dos grupos da Monday'", "outro:'Fora dos grupos (histórico)'");
  // 19/11/2026 (Gustavo: "a Monday não tem que ser mais usada em nada"): nenhum texto da tela cita a Monday. O que veio de lá aparece
  // como "sistema antigo" / "histórico". Feito no HTML final para não mexer nos trechos que os outros geradores procuram.
  const textos = [
    ['Na Monday nada é alterado, e ela volta para cá quando for reenviada.', 'Ela volta para cá quando for reenviada.'],
    ['Na Monday nada é alterado, e ela volta para cá quando o lançamento reenviar.', 'Ela volta para cá quando o lançamento reenviar.'],
    ['Documentos da nota (do lançamento e da Monday).', 'Documentos da nota.'],
    ['Só no painel: a Monday não é mais usada. Cada correção', 'Cada correção'],
    ['Prazo encontrado na Monday: 3 dias.', 'Prazo: 3 dias.'],
    ['Dados do painel (projetos copiados da Monday a cada 5 minutos, contratos e notas ao vivo).', 'Dados do painel (projetos, contratos e notas).'],
    ['Os mesmos arquivos do contrato na Monday.', 'Arquivos do contrato.'],
    ['A nota passa para Encaminhadas quando a Monday registrar o envio.', 'A nota passa para Encaminhadas.'],
    ['Ainda não há projetos copiados da Monday.', 'Ainda não há projetos.'],
    ['PORTFÓLIO DE PROJETOS · MONDAY', 'PORTFÓLIO DE PROJETOS · ANTIGO'],
    ['Portfólio de Projetos (Monday)', 'Portfólio de Projetos (antigo)'],
    ["'Portfólio (Monday)'", "'Portfólio (antigo)'"],
    ["'Importada da Monday'", "'Importada do sistema antigo'"],
    ['Não foi possível abrir o arquivo da Monday.', 'Não foi possível abrir o arquivo.'],
    ["'Nota enviada à Monday'", "'Nota enviada (sistema antigo)'"],
    ["'Boleto enviado à Monday'", "'Boleto enviado (sistema antigo)'"],
    ["'Reenviando para a Monday'", "'Reenviando'"],
    ['title="Sincronizado com a Monday">✓ Monday<', 'title="Sincronizado">✓ sincronizado<'],
    ['title="Aguardando confirmação da Monday">⏳ aguardando Monday<', 'title="Aguardando confirmação">⏳ aguardando<'],
    ["'da Monday'", "'do histórico'"],
  ];
  for (const [de, para] of textos) trocar(de, para);
  // Linhas antigas do histórico (gravadas no banco) aparecem sem o nome da Monday.
  trocar("  const historico = lista => `<h4 style=\"margin-top:16px\">Histórico</h4><ul class=\"cx-hist\">${lista.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;",
    "  const semNomeAntigo = t => String(t ?? '').replace(/da Monday/g, 'do sistema antigo').replace(/na Monday/g, 'no sistema antigo').replace(/à Monday/g, 'ao sistema antigo')\n" +
    "    .replace(/pela Monday/g, 'pelo sistema antigo').replace(/a Monday/g, 'o sistema antigo').replace(/Monday/g, 'sistema antigo');\n" +
    "  const historico = lista => `<h4 style=\"margin-top:16px\">Histórico</h4><ul class=\"cx-hist\">${lista.map(t => `<li>${esc(semNomeAntigo(t))}</li>`).join('')}</ul>`;", true);
  return html;
}
