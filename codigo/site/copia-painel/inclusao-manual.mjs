// Inclusão manual de nota no painel de Lançamento (16/11/2026, pedido do Gustavo).
// Acrescenta o botão "＋ Incluir nota" na barra de busca e uma função que entrega os arquivos escolhidos à mão ao MESMO caminho do
// vigia de pasta (processFile): lê o documento, não duplica (confere o hash), cria o lançamento e guarda o arquivo. Se não conseguir
// ler, o próprio processFile cria uma nota "Pendente" para revisão manual. Nada de regra nova: só um outro jeito de entregar o arquivo.
// Usado pelo gerador da homologação da Expansão (producao/homologacao/montar.mjs). Para com erro se o painel original mudar.

function trocarUma(html, de, para, nome){
  const n = html.split(de).length - 1;
  if (n !== 1) throw Error(`Inclusão manual (${nome}): esperava 1x, achei ${n}x: ${de.slice(0, 70)}`);
  return html.split(de).join(para);
}

const BOTAO = `<button class="folder-btn" id="incluirManualBtn" title="Escolher um ou mais arquivos (PDF, XML ou imagem) e lançar a nota à mão">＋ Incluir nota</button>
  <input type="file" id="incluirManualArquivo" hidden multiple accept="application/pdf,.pdf,.xml,text/xml,application/xml,image/*">
  `;

const FUNCAO = `  // Inclusão manual de nota (16/11/2026): mesmo caminho do vigia de pasta, com os arquivos escolhidos à mão.
  async function incluirNotasManualmente(arquivos){
    const lista = Array.from(arquivos || []);
    if(!lista.length) return;
    const botao = document.getElementById('incluirManualBtn');
    const rotulo = botao ? botao.innerHTML : '';
    if(botao){ botao.disabled = true; botao.textContent = 'Processando ' + lista.length + ' arquivo(s)…'; }
    const cont = { novo:0, anexado:0, existente:0, revisao:0, erro:0 }, falhas = [];
    for(const arquivo of lista){
      try{
        const r = await processFile(arquivo);
        const s = r && r.status;
        if(s === 'novo') cont.novo++;
        else if(s === 'anexado') cont.anexado++;
        else if(s === 'repetida' || s === 'ja_processado') cont.existente++;
        else if(s === 'erro'){ cont.erro++; falhas.push(arquivo.name); }
        else cont.revisao++;
      }catch(e){ cont.erro++; falhas.push(arquivo.name); console.error('Inclusão manual:', arquivo.name, e); }
    }
    if(botao){ botao.disabled = false; botao.innerHTML = rotulo; }
    const partes = [];
    if(cont.novo) partes.push(cont.novo + ' nota(s) incluída(s)');
    if(cont.anexado) partes.push(cont.anexado + ' anexada(s) a uma nota existente');
    if(cont.revisao) partes.push(cont.revisao + ' pendente(s) de revisão manual');
    if(cont.existente) partes.push(cont.existente + ' já existia(m) no painel');
    if(cont.erro) partes.push(cont.erro + ' com erro (' + falhas.join(', ') + ')');
    showToast({ title:'Inclusão manual', msg: partes.join(' · ') || 'Nenhum arquivo processado.', tipo: cont.erro ? 'warn' : 'success', duracao: 10000 });
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#incluirManualBtn')){ const campo = document.getElementById('incluirManualArquivo'); if(campo) campo.click(); } });
  document.addEventListener('change', e => {
    if(e.target && e.target.id === 'incluirManualArquivo'){ const alvo = e.target; incluirNotasManualmente(alvo.files).finally(() => { alvo.value = ''; }); }
  });
`;

export function comInclusaoManual(html){
  html = trocarUma(html, '<button class="folder-btn ghost" id="exportBtn">', BOTAO + '<button class="folder-btn ghost" id="exportBtn">', 'botão');
  html = trocarUma(html, '  async function processFile(file, sidecar){', FUNCAO + '  async function processFile(file, sidecar){', 'função');
  // 17/11/2026: as barras de pasta (vigia de entrada e pasta de saída) voltam a aparecer, porque o Gustavo pediu. Continua escondido
  // o "Apagar TODOS os lançamentos automáticos", que não deve ficar à vista de ninguém.
  const i = html.indexOf('</head>');   // o primeiro é o da página (os outros estão dentro de textos de código)
  if (i < 0) throw Error('Inclusão manual (sem vigia): </head> não encontrado.');
  html = html.slice(0, i) + '<style id="cxSemVigia">#resetTestBtn{display:none!important}</style>\n' + html.slice(i);
  return html;
}
