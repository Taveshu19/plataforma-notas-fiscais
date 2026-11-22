import { comSemSaudacao, comLoginPadrao } from '../../copia-painel/entrada-padrao.mjs';
import { comFavicon } from '../../copia-painel/favicon.mjs';
import { comCarregamentoHtml, comCarregamentoJs } from '../../copia-painel/carregamento.mjs';
import { comInclusaoManual } from '../../copia-painel/inclusao-manual.mjs';
import { semMonday } from '../../copia-painel/sem-monday.mjs';
import { comBoletoDepoisDoEnvio } from '../../copia-painel/boleto-depois-do-envio.mjs';
import { comAbaUnicaDocumentos } from '../../copia-painel/aba-unica-documentos.mjs';
// Gera producao/engenharia/index.html: o painel de Engenharia em uso (base publicada) + Aprovações, Contratos e Notas TAG, ligado ao banco REAL da Engenharia.
// Uso: node producao/engenharia/montar.mjs
// As regras e telas da Engenharia (seções 1 e 2 abaixo) são as mesmas do gerador da demonstração (copia-engenharia/montar-copia-engenharia.mjs),
// copiadas em 16/11/2026; a camada de dados é o adaptador-engenharia.js (banco real). A base é o painel PUBLICADO em 16/11 (a cópia local é antiga).
// Se um trecho esperado não existir mais, o script para com erro em vez de gerar um painel errado.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTA = dirname(fileURLToPath(import.meta.url));
const AQUI = join(ESTA, '../../copia-engenharia');   // cartoes-notas.css e laranja-engenharia.css vivem na pasta da demonstração
const BASE = join(AQUI, '../copia-painel');
const lerBase = n => readFileSync(join(BASE, n), 'utf8');
const lerAqui = n => readFileSync(join(AQUI, n), 'utf8');


// ---------- utilitários de troca (param se o trecho não for achado) ----------
function trocarEm(texto, de, para, minimo = 1, exato = null){
  const n = texto.split(de).length - 1;
  if (exato !== null ? n !== exato : n < minimo) throw Error(`Esperava ${exato ?? '>=' + minimo}x, achei ${n}x: ${String(de).slice(0, 90)}`);
  return texto.split(de).join(para);
}
function trocarRegexEm(texto, re, para){
  if (!re.test(texto)) throw Error('Trecho não encontrado: ' + re);
  re.lastIndex = 0;
  return texto.replace(re, para);
}
function trocarTrechoEm(texto, inicio, fim, novo){
  const i = texto.indexOf(inicio); if (i < 0) throw Error('Início não encontrado: ' + inicio);
  const f = texto.indexOf(fim, i + inicio.length); if (f < 0) throw Error('Fim não encontrado: ' + fim);
  return texto.slice(0, i) + novo + texto.slice(f);
}

// =====================================================================
// 1) Regras (unidades, cores, busca e filtros)
// =====================================================================
let regras = lerBase('regras-expansao.js');
// Unidades e cores da coluna Unidade do quadro Notas da Engenharia (18427870092, color_mm8db3db).
const UNIDADES_ENG = [['001','SOROCABA','#fdab3d'],['002','AMERICANA','#00c875'],['003','ILHÉUS','#df2f4a'],['004','CAMPINA GRANDE','#007eb5'],['005','LONDRINA','#9d50dd'],['006','PELOTAS','#037f4c'],['007','ANÁPOLIS','#579bfc'],['008','CONTAGEM','#cab641'],['009','NITERÓI','#ffcb00'],['010','CASCAVEL','#333333'],['011','MARÍLIA','#bb3354'],['012','JOINVILLE','#ff007f'],['013','MONTES CLAROS','#ff5ac4'],['014','PALMAS','#784bd1'],['015','IPATINGA','#9cd326'],['016','FEIRA DE SANTANA','#66ccff'],['017','BLUMENAU','#757575'],['018','MARINGÁ','#7f5347'],['019','PINHAL','#ff6d3b'],['020','ARARAQUARA','#ff7575'],['021','GUARAPARI','#ffadad'],['022','ITATIBA','#7e3b8a'],['099','CORPORATIVO','#faa1f1'],['201','FILIAL B AMERICANA','#9aadbd'],['202','FILIAL B ANÁPOLIS','#74afcc'],['203','FILIAL B CAMPINA GRANDE','#225091'],['701','COMÉRCIO','#4eccc6']];
regras = trocarRegexEm(regras, /  const CORES_UNIDADE = \{[^\n]*\};\n/, `  const CORES_UNIDADE = { ${UNIDADES_ENG.map(([c,, cor]) => `'${c}':'${cor}'`).join(', ')} };\n`);
regras = trocarRegexEm(regras, /  const UNIDADES_FIXAS = \[[^\n]*\];\n/, `  const UNIDADES_FIXAS = [${UNIDADES_ENG.map(([c, n]) => `['${c}','${n}']`).join(',')}];\n`);
regras = trocarEm(regras, '// Cores das unidades = cores de status da coluna Unidade nos quadros Aprovações e Notas da Monday (mesmos hex nos dois).', '// Cores das unidades = cores de status da coluna Unidade do quadro Notas da Engenharia na Monday.', 1, 1);
regras = trocarEm(regras, "['engenharia','admin'].includes(p.perfil) && ETAPAS_CORRIGIVEIS", "['engenharia','admin','equipe'].includes(p.perfil) && ETAPAS_CORRIGIVEIS", 1, 1);
regras = trocarEm(regras, 'r.descricao,r.narrativa,', 'r.descricao,r.narrativa,r.categoria,r.pagador,r.cod_fornecedor,r.endereco,', 1, 1);
regras = trocarEm(regras, "&& (!f.natureza || r.natureza === f.natureza)", "&& (!f.natureza || r.natureza === f.natureza) && (!f.pagador || r.pagador === f.pagador) && (!f.endereco || r.endereco === f.endereco)", 1, 1);   // 18/11/2026: filtro por endereço

// =====================================================================
// 2) Interface de Aprovações
// =====================================================================
// Listas dos campos Pagador, Categoria e Endereço do quadro Aprovações da Engenharia na Monday (18427870363), lidas em 14/11/2026.
const LISTAS_ENG = {
  pagador: ['Empresa Exemplo', 'Holding', 'Tag', 'Condomínio Lago', 'Parceira', 'Coligada'],
  categoria: ['Manutenção','Obras/Reformas','Despesa para Rateio','Segurança Patrimonial','Projetos/Licenciamentos','Material','Serviço','Aluguel','Taxa Condomínio','Consumo Energia','Processos Judiciais','Despesa com Pessoal','Controle de Pragas','Contábil','Impostos','Concessionária','Taxa ADM','Manutenção Elevadores','Portaria e Segurança','Locações','Paisagismo','Suporte TI','Manutenção e Conservação','Telefonia','Limpeza','Uso e Consumo','CFTV','Bens e Moveis','Coleta de Lixo','Seguro','Ato Declaratório','Consumo Água','Condomínio VV','Condomínio Lago','Serviços'],
  endereco: ['Rua das Acácias, 100 - Centro','Av. Central, 137 - Distrito Industrial','Rua do Comércio, 174 - Vila Nova','Condomínio Residencial 01','Condomínio Residencial 02','Av. Brasil, 285 - Santa Rita','Condomínio Residencial 03','Estrada Municipal, 359 - Vila Operária','Rodovia Estadual, 396 - Centro','Rua dos Ipês, 433 - Distrito Industrial','Av. Principal, 470 - Vila Nova','Rua da Estação, 507 - Parque Industrial','Rua das Flores, 544 - Bela Vista','Av. dos Trabalhadores, 581 - Santa Rita','Rua São João, 618 - Boa Vista','Rua Bela Vista, 655 - Vila Operária','Av. Industrial, 692 - Centro','Rua do Porto, 729 - Distrito Industrial','Rua Santa Cruz, 766 - Vila Nova','Rua Boa Esperança, 803 - Parque Industrial','Rua das Acácias, 840 - Bela Vista','Av. Central, 877 - Santa Rita','Rua do Comércio, 914 - Boa Vista','Av. das Indústrias, 951 - Vila Operária','Rua das Palmeiras, 988 - Centro','Av. Brasil, 125 - Distrito Industrial','Rua Projetada A, 162 - Vila Nova','Estrada Municipal, 199 - Parque Industrial','Rodovia Estadual, 236 - Bela Vista','Rua dos Ipês, 273 - Santa Rita','Av. Principal, 310 - Boa Vista','Obra 01','Rua das Flores, 384 - Centro','Av. dos Trabalhadores, 421 - Distrito Industrial','Rua São João, 458 - Vila Nova','Rua Bela Vista, 495 - Parque Industrial','Av. Industrial, 532 - Bela Vista','Obra 02','Rua Santa Cruz, 606 - Boa Vista','Rua Boa Esperança, 643 - Vila Operária','Rua das Acácias, 680 - Centro','Av. Central, 717 - Distrito Industrial','Rua do Comércio, 754 - Vila Nova','Base Operacional 01','Rua das Palmeiras, 828 - Bela Vista','Av. Brasil, 865 - Santa Rita','Rua Projetada A, 902 - Boa Vista','Estrada Municipal, 939 - Vila Operária','Rodovia Estadual, 976 - Centro','Rua dos Ipês, 113 - Distrito Industrial','Av. Principal, 150 - Vila Nova','Rua da Estação, 187 - Parque Industrial','Rua das Flores, 224 - Bela Vista','Av. dos Trabalhadores, 261 - Santa Rita','Rua São João, 298 - Boa Vista','Rua Bela Vista, 335 - Vila Operária','Av. Industrial, 372 - Centro','Rua do Porto, 409 - Distrito Industrial','Rua Santa Cruz, 446 - Vila Nova','Rua Boa Esperança, 483 - Parque Industrial','Rua das Acácias, 520 - Bela Vista','Av. Central, 557 - Santa Rita','Rua do Comércio, 594 - Boa Vista','Obra 03','Rua das Palmeiras, 668 - Centro','Av. Brasil, 705 - Distrito Industrial','Rua Projetada A, 742 - Vila Nova','Obra 04'],
};

let areas = comCarregamentoJs(lerBase('areas-novas.js'));
const t = (de, para, minimo = 1, exato = null) => { areas = trocarEm(areas, de, para, minimo, exato); };

// Lançamento de notas da Engenharia (em cima) e Aprovações (sem Compras, Projetos e Portfólio).
t("const ACESSO = { admin:['lancamento','aprovacoes','compras'], equipe:['lancamento','aprovacoes'], engenharia:['aprovacoes','compras'], compras:['compras'] };",
  "const ACESSO = { admin:['lancamento','aprovacoes','notasTag'], equipe:['lancamento','aprovacoes','notasTag'], engenharia:['aprovacoes','notasTag'], tag:['notasTag'] };", 1, 1);
// Aba Notas TAG (Gustavo, 14/11): o painel de Notas da TAG do Administrativo dentro da Engenharia. Toda a equipe vê;
// editar fica só para otavio.reis@holding.exemplo e backoffice@investidora.exemplo, com a trava no próprio painel de Notas
// (botão "Entrar para editar", conferido no servidor). O perfil "tag" é a conta do BO, que só enxerga essa aba.
const NOTAS_TAG_URL = 'https://seu-site-tag-demo.netlify.app/';
t("portfolioNosso:'Portfólio de Projetos (nosso sistema)' };", "portfolioNosso:'Portfólio de Projetos (nosso sistema)', notasTag:'Administrativo · Notas TAG' };", 1, 1);
t("const telaCheia = area === 'portfolio' || area === 'portfolioNosso';", "const telaCheia = area === 'portfolio' || area === 'portfolioNosso' || area === 'notasTag';", 1, 1);
t("const EMBUTIDOS = { portfolio: () => telaPortfolio(), portfolioNosso: () => telaPortfolioNosso() };", "const EMBUTIDOS = { portfolio: () => telaPortfolio(), portfolioNosso: () => telaPortfolioNosso(), notasTag: () => telaNotasTag() };", 1, 1);
t('  // Portfólio de Projetos (site do Marcos) dentro do painel.', `  const NOTAS_TAG_URL = '${NOTAS_TAG_URL}';
  // Login para edição (Gustavo, 15/11): qualquer um vê a aba; o botão abre a janela de senha do painel da TAG.
  // No site oficial o painel da TAG está no mesmo endereço, então o botão aciona o "Entrar para editar" dentro do quadro.
  document.addEventListener('click', e => { if (!e.target.closest('[data-login-tag]')) return; try { const d = document.querySelector('.cx-notas-tag iframe')?.contentDocument; if (d) { d.getElementById('abrir-login')?.click(); return; } } catch (err) {} window.open('${NOTAS_TAG_URL}', '_blank', 'noopener'); });
  // Tamanho igual ao da gaveta de Aprovações (16/11): enquanto a aba Notas TAG está aberta, o painel da TAG ocupa a tela toda
  // (o PDF abre na metade direita e na altura da janela). Os botões de login e de voltar ficam flutuando embaixo.
  // 17/11/2026 (Gustavo): o botão fica no topo do menu da TAG; ela avisa por mensagem (mesmo endereço) e o painel volta para a aba de antes.
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.tipo !== 'tag-voltar') return;
    const alvo = areaAntesDaTag && areaAntesDaTag !== 'notasTag' ? areaAntesDaTag : areasDe(pessoa).find(a => a !== 'notasTag');
    if (!alvo) return;
    const b = document.querySelector('#cxAbas [data-area="' + alvo + '"]');
    if (b) b.click(); else trocarArea(alvo);
  });
  document.addEventListener('click', e => { if (!e.target.closest('[data-voltar-painel]')) return; const outra = [...document.querySelectorAll('#cxAbas [data-area]')].find(b => b.dataset.area !== 'notasTag'); outra?.click(); });
  const telaNotasTag = () => \`<style>.cx-embutido:has(.cx-notas-tag){top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;z-index:300!important}.cx-embutido .cx-notas-tag .cx-portfolio-topo{display:none}.cx-embutido .cx-notas-tag .cx-notas-tag-flutuante{position:fixed;left:12px;bottom:12px;z-index:301;display:flex;gap:8px;flex-wrap:wrap}</style><div class="cx-portfolio cx-notas-tag"><div class="cx-portfolio-topo"><div><span class="cx-kicker">ADMINISTRATIVO · PAINEL DA TAG</span><h3>Administrativo · Notas TAG</h3><small class="cx-notas-tag-aviso" style="display:block;font-size:11.5px;opacity:.72;margin-top:3px">Toda a equipe pode consultar. Para editar, clique em Login para edição e entre com sua senha.</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="cx-btn" data-login-tag style="font-weight:600">Login para edição</button><a class="cx-btn cx-mini" href="\${esc(NOTAS_TAG_URL)}" target="_blank" rel="noopener">Abrir em nova aba</a></div></div><iframe class="cx-portfolio-quadro" src="\${esc(NOTAS_TAG_URL)}" title="Notas TAG"></iframe></div>\`;
  // Portfólio de Projetos (site do Marcos) dentro do painel.`, 1, 1);
t("  function trocarArea(nova){\n    if (!areasDe(pessoa).includes(nova)) return;\n    area = nova;", "  let areaAntesDaTag = null;   // 17/11/2026: para o botão Voltar da TAG\n  function trocarArea(nova){\n    if (!areasDe(pessoa).includes(nova)) return;\n    if (nova === 'notasTag' && area !== 'notasTag') areaAntesDaTag = area;\n    area = nova;", 1, 1);
t("portfolio:'grade',portfolioNosso:'grade'}[a])}", "portfolio:'grade',portfolioNosso:'grade',notasTag:'documento'}[a])}", 1, 1);
t("['lancamento', 'portfolio', 'portfolioNosso'].includes(a) ? '' :", "['lancamento', 'portfolio', 'portfolioNosso', 'notasTag'].includes(a) ? '' :", 1, 1);
t("portfolioNosso:'Portfólio (nosso sistema)' };", "portfolioNosso:'Portfólio (nosso sistema)', notasTag:'Administrativo (TAG)' };", 1, 1);
t("// Quem vê cada aba. Lançamento: equipe. Compras: engenharia e Helena.", "// Engenharia (Gustavo, 14/11): Lançamento de notas só para Beatriz e Bruno (perfil equipe, que também analisa e registra pedido); Camila e Paula (perfil engenharia) só Aprovações, preenchendo os campos da análise; Gustavo, Marcos e Otávio (admin) veem tudo.", 1, 1);
// Na Engenharia, quem preenche Narrativa, Contrato e Pertence (Camila, Paula e Beatriz) é a própria equipe: o perfil equipe também faz a análise.
t("const pode = perfil => pessoa.perfil === 'admin' || pessoa.perfil === perfil;", "const pode = perfil => pessoa.perfil === 'admin' || pessoa.perfil === perfil || (perfil === 'engenharia' && pessoa.perfil === 'equipe');", 1, 1);
// equipe já vem em areas-novas.js (16/11/2026)
t("&& ['engenharia', 'admin'].includes(pessoa.perfil);", "&& ['engenharia', 'admin', 'equipe'].includes(pessoa.perfil);", 1, 1);
t("aba = pessoa.perfil === 'equipe' ? 'pedido' : 'engenharia';", "aba = 'engenharia';", 1, 1);
t("equipe:'Equipe de lançamento',engenharia:'Engenharia',compras:'Compras'}[pessoa.perfil]", "equipe:'Lançamento e aprovações',engenharia:'Análise da Engenharia',compras:'Compras',tag:'TAG · Notas'}[pessoa.perfil]", 1, 1);
t("$(`tr[data-linha=\"${id}\"] [data-celula=pedido]`)", "$(`[data-linha=\"${id}\"] [data-celula=pedido]`)", 1, 1);
t("atualizarLinha(el.closest('tr'))", "atualizarLinha(el.closest('[data-linha]'))", 1, 1);

// Cartões (pedido do Gustavo, 14/11): as mesmas informações do quadro (Narrativa, É contrato?, Pertence, pedido) para preencher por cartão.
// Os cartões usam as mesmas funções do quadro, então gravar ao sair do campo, Aprovar, bloqueio por saldo e Enter funcionam igual.
t('  const trilha = dentro =>', `  let visaoNotas = 'quadro';
  try { visaoNotas = localStorage.getItem('cx_visao_notas') === 'cartoes' ? 'cartoes' : 'quadro'; } catch (_) { /* sem lembrança da escolha */ }
  // Pagador, Categoria e Endereço da obra: preenchidos aqui em Aprovações quando a nota chega (Gustavo, 14/11), como na Monday (listas do quadro Aprovações da Engenharia).
  const LISTAS_ENG = ${JSON.stringify(LISTAS_ENG)};
  // 19/11/2026: na Escrituração a equipe administrativa ainda corrige Pagador, Categoria e Endereço (o envio depende do Pagador).
  const podeEditarListas = n => podeEditarAnalise(n) || (n.etapa === 'escrituracao' && ['equipe','admin'].includes(pessoa.perfil));
  // Endereço da obra (19/11/2026): lista da Monday + endereços novos já usados; a última opção cria um endereço novo.
  const opcoesDe = (campo, opcoes) => campo === 'endereco' ? [...new Set([...opcoes, ...(window.__enderecosExtras || [])])] : opcoes;
  // 19/11/2026 (painel lento): cada linha trazia a lista inteira (só o Endereço tem ~70 opções), e uma aba com 40 notas montava ~5 mil
  // opções a cada clique. Agora a lista nasce só com o valor escolhido e recebe as opções no momento em que a pessoa clica nela ou chega pelo teclado.
  const opcoesListaHtml = (campo, opcoesBase, v) => { const opcoes = opcoesDe(campo, opcoesBase);
    // 19/11/2026 (Gustavo: "não dá a opção de criar um novo endereço"): a opção ficava no fim de ~70 endereços; agora é a 2ª da lista.
    return \`<option value=""\${v ? '' : ' selected'}>—</option>\${campo === 'endereco' ? '<option value="__novo__">＋ Adicionar novo endereço…</option>' : ''}\${[...(v && !opcoes.includes(v) ? [v] : []), ...opcoes].map(o => \`<option\${o === v ? ' selected' : ''}>\${esc(o)}</option>\`).join('')}\`; };
  const celulaLista = (n, campo, rotulo, opcoesBase) => { const v = n[campo] || ''; return podeEditarListas(n)
    ? \`<select class="cx-cel cx-cel-lista" data-celula="\${campo}" data-celula-nota="\${esc(n.id)}" data-lista-preguica="\${campo}" aria-label="\${rotulo} da NF \${esc(n.nf)}">\${v ? \`<option selected>\${esc(v)}</option>\` : '<option value="" selected>—</option>'}</select>\`
    : \`<span class="cx-cel-leitura" title="\${esc(v)}">\${esc(v || '—')}</span>\`; };
  const completarLista = s => { if (!s?.dataset?.listaPreguica) return; const campo = s.dataset.listaPreguica, v = s.value === '' ? '' : s.value; delete s.dataset.listaPreguica; s.innerHTML = opcoesListaHtml(campo, LISTAS_ENG[campo] || [], v); };
  ['mousedown', 'focusin', 'keydown', 'touchstart'].forEach(tipo => document.addEventListener(tipo, e => { const s = e.target?.closest?.('select[data-lista-preguica]'); if (s) completarLista(s); }, true));
  const celulaTextoLonga = (n, campo, rotulo) => podeEditarAnalise(n)
    ? \`<textarea class="cx-cel" rows="3" data-celula="\${campo}" data-celula-nota="\${esc(n.id)}" placeholder="\${rotulo}" aria-label="\${rotulo} da NF \${esc(n.nf)}">\${esc(n[campo] || '')}</textarea>\`
    : \`<span class="cx-cel-leitura cx-cel-quebra">\${esc(n[campo] || '—')}</span>\`;
  const fichaNota = n => \`<article class="cx-ficha cx-ficha-nota" data-linha="\${esc(n.id)}" data-texto="\${esc(R.texto(n))}" data-unidade="\${esc(n.unidade)}" data-status="\${esc(n.etapa)}" data-natureza="\${esc(n.natureza)}" data-emissao="\${esc(String(n.emissao || '').slice(0, 10))}">
    <div class="cx-ficha-topo"><span>NF \${esc(n.nf)}</span>\${etiqueta(ETAPAS[n.etapa], n.etapa === 'escrituracao' ? 'verde' : n.etapa === 'contrato' ? 'ambar' : ['cancelada', 'devolvida'].includes(n.etapa) ? 'rosa' : '')}</div>
    <div class="cx-ficha-titulo"><span class="cx-kicker">\${unidade(n.unidade)} <span> / </span> \${esc(n.natureza)}</span><h3 title="\${esc(n.fornecedor)}">\${esc(n.fornecedor)}</h3><span data-reserva-nota="\${esc(n.id)}" class="cx-reserva-etiqueta"></span></div>
    <dl class="cx-ficha-dados"><div><dt>Valor</dt><dd>\${dinheiro(n.valor)}</dd></div><div><dt>Vencimento</dt><dd>\${dataBR(n.vencimento)}</dd></div><div><dt>Recebimento</dt><dd>\${dataBR(n.dataRecebimento)}</dd></div></dl>
    <div class="cx-ficha-campos"><label class="cx-campo">Narrativa\${celulaTextoLonga(n, 'narrativa', 'Narrativa')}</label><div class="cx-duas"><label class="cx-campo">É contrato?\${celulaSimNao(n, 'contrato', 'É contrato?')}</label><label class="cx-campo">Pertence à engenharia?\${celulaSimNao(n, 'expansao', 'Pertence à engenharia?')}</label></div><div class="cx-duas"><label class="cx-campo">Pagador\${celulaLista(n, 'pagador', 'Pagador', LISTAS_ENG.pagador)}</label><label class="cx-campo">Categoria\${celulaLista(n, 'categoria', 'Categoria', LISTAS_ENG.categoria)}</label></div><label class="cx-campo">Endereço da obra\${celulaLista(n, 'endereco', 'Endereço da obra', LISTAS_ENG.endereco)}</label>\${n.etapa === 'pedido' ? \`<label class="cx-campo">Pedido (Datasul)\${celulaPedido(n)}</label>\` : ''}\${bloqueioSaldo(n) ? etiqueta('Saldo do contrato insuficiente', 'rosa') : ''}</div>
    <div class="cx-ficha-rodape"><span>\${(n.arquivos || []).length} docs · emissão \${dataBR(n.emissao)}</span><span class="cx-ficha-acoes">\${botaoLinha(n)}<button class="cx-btn cx-mini" data-nota="\${esc(n.id)}">Abrir</button></span></div></article>\`;
  const trilha = dentro =>`, 1, 1);
t('<div class="cx-fila-cabeca"><div><h3>${legendaAba()}</h3></div><span class="cx-total-fila">', '<div class="cx-fila-cabeca"><div><h3>${legendaAba()}</h3></div><div class="cx-visoes" aria-label="Apresentação das notas"><button data-visao="quadro" aria-pressed="${visaoNotas === \'quadro\'}">${icone(\'tabela\')} Quadro</button><button data-visao="cartoes" aria-pressed="${visaoNotas === \'cartoes\'}">${icone(\'grade\')} Cartões</button></div><span class="cx-total-fila">', 1, 1);
t("${atuais.length ? quadroNotas(atuais) :", "${atuais.length ? (visaoNotas === 'cartoes' ? `<div class=\"cx-fichas cx-fichas-notas\">${atuais.map(fichaNota).join('')}</div>` : quadroNotas(atuais)) :", 1, 1);
t("visaoReq = alvo.dataset.visao; desenhar();", "if (area === 'aprovacoes'){ visaoNotas = alvo.dataset.visao; try { localStorage.setItem('cx_visao_notas', visaoNotas); } catch (_) { /* sem lembrança da escolha */ } } else visaoReq = alvo.dataset.visao; desenhar();", 1, 1);
t("$(`[data-visao=${visaoReq}]`).focus(); return;", "$(`[data-visao=${alvo.dataset.visao}]`).focus(); return;", 1, 1);
t("if (el.matches?.('[data-celula]')){", "if (el.matches?.('[data-celula]') && !(el.tagName === 'TEXTAREA' && e.shiftKey)){", 1, 1);

// Nomes: onde a Expansão diz "expansão", a Engenharia diz "engenharia".
t('Pertence à expansão', 'Pertence à engenharia', 3);
t('Fora da expansão', 'Fora da engenharia', 2);
t('Aprovações da Expansão', 'Aprovações da Engenharia', 1, 1);
t('Perfil da Expansão inválido.', 'Perfil da Engenharia inválido.', 1, 1);
t("['engenharia','Expansão']", "['engenharia','Engenharia']", 1, 1);
t("engenharia:'Expansão',contrato:'Contratos para vincular'", "engenharia:'Engenharia',contrato:'Contratos para vincular'", 1, 1);
t('<span>expansão<small>EMPRESA EXEMPLO</small></span>', '<span>engenharia<small>EMPRESA EXEMPLO</small></span>', 1, 1);
t('Gestão da expansão', 'Gestão da engenharia', 1, 1);
t('<span> / EXPANSÃO</span>', '<span> / ENGENHARIA</span>', 1, 1);
t("expansao_colaboracao_v1", "engenharia_colaboracao_v1", 1);
t("fiscal:'E-mail enviado ao fiscal'", "fiscal:'E-mail enviado'", 1, 1);

// Colunas da Engenharia que a Expansão não tem: Pagador e Categoria no quadro; Pagador, Categoria,
// Endereço e Cód. Fornecedor na janela da nota; Pagador também como filtro.
t('<td>${esc(n.natureza)}</td><td>${dataBR(n.emissao)}</td>', '<td>${esc(n.natureza)}</td><td>${celulaLista(n, \'pagador\', \'Pagador\', LISTAS_ENG.pagador)}</td><td>${celulaLista(n, \'categoria\', \'Categoria\', LISTAS_ENG.categoria)}</td><td>${dataBR(n.emissao)}</td>', 1, 1);
t('<th>Natureza</th><th>Emissão</th>', '<th>Natureza</th><th>Pagador</th><th>Categoria</th><th>Emissão</th>', 1, 1);
t("<th>Unidade</th><th>Narrativa</th><th>É contrato?</th>", "<th>Unidade</th><th>Endereço da obra</th><th>Narrativa</th><th>É contrato?</th>", 1, 1);
t("`<td>${unidade(n.unidade)}</td>`", "`<td>${unidade(n.unidade)}</td><td>${celulaLista(n, 'endereco', 'Endereço da obra', LISTAS_ENG.endereco)}</td>`", 1, 1);
t("<div><span>Pagamento</span>${esc(n.pagamento)}</div>", "<div><span>Pagamento</span>${esc(n.pagamento)}</div><div><span>Pagador</span>${esc(n.pagador || '—')}</div><div><span>Categoria</span>${esc(n.categoria || '—')}</div><div><span>Cód. Fornecedor</span>${esc(n.cod_fornecedor || '—')}</div><div><span>Data de recebimento</span>${dataBR(n.dataRecebimento)}</div><div><span>Endereço da obra</span>${esc(n.endereco || '—')}</div>", 1, 1);
t("filtroVazio = () => ({ busca:'', unidade:'', status:'', prioridade:'', fornecedor:'', natureza:'', de:'', ate:'' })", "filtroVazio = () => ({ busca:'', unidade:'', status:'', prioridade:'', fornecedor:'', natureza:'', pagador:'', endereco:'', de:'', ate:'' })", 1, 1);
t("return `<label>Natureza<select data-cxfilter=\"natureza\">${opcoes([['','Todas'],...unicos('natureza').map(x => [x,x])], f.natureza)}</select></label>",
  "return `<label>Natureza<select data-cxfilter=\"natureza\">${opcoes([['','Todas'],...unicos('natureza').map(x => [x,x])], f.natureza)}</select></label><label>Pagador<select data-cxfilter=\"pagador\">${opcoes([['','Todos'],...unicos('pagador').map(x => [x,x])], f.pagador)}</select></label><label>Endereço<select data-cxfilter=\"endereco\">${opcoes([['','Todos'],...unicos('endereco').map(x => [x,x])], f.endereco)}</select></label>", 1, 1);

// Destino da escrituração: na Engenharia depende do Pagador (Beatriz, 23/10/2026; notificar-escrituracao da Engenharia).
t('  function acaoDaNota(n){', `  // Destino da escrituração da Engenharia (regra da função notificar-escrituracao, rotaDa): depende do Pagador, não só da unidade.
  //   Remessa → não vai · Holding → SharePoint, ou e-mail ao fiscal se a unidade for Pinhal
  //   Empresa Exemplo, Parceira, Condomínio Lago → e-mail da Planilha Azul · Tag, Coligada, outros ou sem Pagador → não vai.
  const PAGADORES_PLANILHA_AZUL = ['empresa exemplo', 'parceira', 'condomínio lago'];
  const destinoEscrituracao = n => {
    const pag = String(n.pagador || '').replace(/\\s+/g, ' ').trim(), chave = pag.toLowerCase();
    // 18/11/2026 (Gustavo): Remessa e Pagador Tag vão para o painel da TAG (aba do Otávio, em análise).
    // 19/11/2026 (Gustavo): Remessa NÃO vai para a TAG; vai direto do lançamento para a Escrituração. O envio automático não vale para ela.
    // 19/11/2026 (Gustavo): Remessa vai por e-mail ao fiscal da unidade da nota.
    if (n.natureza === 'Remessa') return { tipo:'fiscal', vai:true, texto:'e-mail ao fiscal da unidade (Remessa)' };
    if (chave === 'tag') return { tipo:'tag', vai:true, texto:'painel da TAG (aba do Otávio, em análise)' };
    if (chave === 'holding') return /pinhal/i.test(n.unidade) ? { tipo:'pinhal', vai:true, texto:'e-mail ao fiscal de Pinhal' } : { tipo:'sharepoint', vai:true, texto:'fluxo do SharePoint (Lista Validações)' };
    if (PAGADORES_PLANILHA_AZUL.includes(chave)) return { tipo:'azul', vai:true, texto:'e-mail da Planilha Azul' };
    return { tipo:'nao', vai:false, texto: pag ? \`não vai: o pagador "\${pag}" não é escriturado\` : 'não vai: a nota está sem Pagador' };
  };
  function acaoDaNota(n){`, 1, 1);
t("const eng = pode('engenharia') ? '' : 'disabled', envioFiscal = /pinhal/i.test(n.unidade) || n.natureza === 'Remessa';", "const eng = pode('engenharia') ? '' : 'disabled', destino = destinoEscrituracao(n);", 1, 1);
areas = trocarRegexEm(areas, /      case 'escrituracao': return `[^\n]*\n/,
  "      case 'escrituracao': return `<h4>Prévia para escriturar</h4><p>${etiqueta('Destino: ' + destino.texto, destino.vai ? 'verde' : 'rosa')}</p>${bloqueio('equipe')}<div class=\"cx-nota\">Simulação: nenhum e-mail ou arquivo sai daqui. A versão real precisa manter as validações que o botão Enviar tem hoje.</div><div class=\"cx-acoes\">${botao('escriturar', 'Simular envio para escrituração', pode('equipe') && destino.vai)}</div>`;\n");
t("      const n = notas().find(x => x.id === id), emitente = $('#cxEmitente').value.trim();\n      if (!/^\\d{1,9}$/.test(emitente)) return aviso('Informe o código do emitente com até nove dígitos. Não use o CNPJ.');\n      moverNota(id, /pinhal/i.test(n.unidade) || n.natureza === 'Remessa' ? 'fiscal' : 'encaminhada', 'Envio para escrituração simulado', { emitente });",
  "      const n = notas().find(x => x.id === id), destino = destinoEscrituracao(n);\n      if (!destino.vai) return aviso('Esta nota ' + destino.texto + '.');\n      moverNota(id, destino.tipo === 'sharepoint' ? 'encaminhada' : 'fiscal', 'Envio para escrituração simulado: ' + destino.texto, {});", 1, 1);
t("Destino: ${/pinhal/i.test(n.unidade) || n.natureza === 'Remessa' ? 'e-mail ao fiscal da unidade' : 'fluxo do SharePoint'}.", "Destino: ${destinoEscrituracao(n).texto}.", 1, 1);
// Andamento na Monday: colunas de status que só existem no quadro Notas da Engenharia.
t("<div><span>Data de envio</span>${dataBR(n.dataEnvio || m.data_envio)}</div>", "<div><span>Data de envio</span>${dataBR(n.dataEnvio || m.data_envio)}</div><div><span>Criação de pedido</span>${esc(m.criacao_pedido || '—')}</div><div><span>Aprovação do pedido</span>${esc(m.aprovacao_pedido || '—')}</div><div><span>Pré nota</span>${esc(m.pre_nota || '—')}</div><div><span>Envio fiscal</span>${esc(m.envio_fiscal || '—')}</div>${m.motivo_reprovacao ? `<div><span>Motivo da reprovação</span>${esc(m.motivo_reprovacao)}</div>` : ''}", 1, 1);
// 19/11/2026 (Beatriz, NF 55): o bloco aparece sempre na Escrituração; quando a nota não pode ir, diz o motivo e mostra o campo para corrigir.
t("<div class=\"cx-acoes\" id=\"cxEscriturarAcoes\">${botao('escriturarMonday', 'Enviar para escriturar', !bloqueioSaldo(n))}</div></div>",
  "${camposEnvioEng(n)}<div class=\"cx-acoes\" id=\"cxEscriturarAcoes\">${botao('escriturarMonday', 'Enviar para escriturar', !bloqueioSaldo(n) && destinoEscrituracao(n).vai)}</div></div>", 1, 1);

// Nota da Tag (Gustavo, 14/11): segue o processo normal da Engenharia; no envio (onde as outras vão para a escrituração),
// a nota com Pagador Tag vai para o painel da TAG (aba Administrativo), em "TAG - Notas Fiscais Pendentes de aprovação",
// onde só Otávio e o BO decidem. Na demonstração a nota passa pela janela já carregada do painel da TAG, que confirma o recebimento.
t("    if (PAGADORES_PLANILHA_AZUL.includes(chave)) return { tipo:'azul', vai:true, texto:'e-mail da Planilha Azul' };",
  "    if (chave === 'tag') return { tipo:'tag', vai:true, texto:'painel da TAG (pendente de aprovação do Otávio)' };\n    if (PAGADORES_PLANILHA_AZUL.includes(chave)) return { tipo:'azul', vai:true, texto:'e-mail da Planilha Azul' };", 1, 1);
t("${botao('escriturar', 'Simular envio para escrituração', pode('equipe') && destino.vai)}",
  "${botao('escriturar', destino.tipo === 'tag' ? 'Enviar para o painel da TAG' : 'Simular envio para escrituração', pode('equipe') && destino.vai)}", 1, 1);
t("      if (!destino.vai) return aviso('Esta nota ' + destino.texto + '.');\n",
  "      if (!destino.vai) return aviso('Esta nota ' + destino.texto + '.');\n      if (destino.tipo === 'tag'){ enviarParaTag(n).then(r => { if (r.erro) throw new Error(r.erro); return moverNota(id, 'encaminhada', 'Enviada ao painel da TAG: ' + (r.grupo || 'pendente de aprovação do Otávio'), {}); }).then(() => aviso('Nota enviada ao painel da TAG. Ela aparece na aba Administrativo (TAG).')).catch(e => aviso(e.message)); return; }\n", 1, 1);
t("  function acaoDaNota(n){", `  function enviarParaTag(n){
    return new Promise((ok, erro) => {
      const quadro = embutido('notasTag')?.querySelector('iframe');
      if (!quadro?.contentWindow) return erro(new Error('O painel da TAG não está disponível para este perfil.'));
      const origem = new URL(NOTAS_TAG_URL, location.href).origin, pedido = 'eng-' + n.id + '-' + Date.now();
      const nota = { origemId:n.id, nf:n.nf, fornecedor:n.fornecedor, cnpj:n.cnpj_fornecedor || '', valor:n.valor, emissao:n.emissao, vencimento:n.vencimento, narrativa:n.narrativa || '', categoria:n.categoria || '', endereco:n.endereco || '', pagamento:n.pagamento || '', unidade:n.unidade };
      let tentativas = 0, relogio = null;
      const enviar = () => { try { quadro.contentWindow.postMessage({ tipo:'vale:nota-tag', pedido, nota }, origem); } catch (_) { /* painel ainda carregando */ } };
      const ouvir = ev => { if (ev.origin !== origem || ev.data?.tipo !== 'vale:nota-tag:ok' || ev.data.pedido !== pedido) return; clearInterval(relogio); removeEventListener('message', ouvir); ok(ev.data); };
      addEventListener('message', ouvir);
      relogio = setInterval(() => { if (++tentativas > 30){ clearInterval(relogio); removeEventListener('message', ouvir); erro(new Error('O painel da TAG não respondeu. Abra a aba Administrativo (TAG) uma vez e tente de novo.')); } else enviar(); }, 500);
      enviar();
    });
  }
  function acaoDaNota(n){`, 1, 1);

// Nota com Pagador Tag (TAG real, 16/11): no "Enviar para escriturar" o adaptador chama tag_receber_nota e a nota vai para o painel da TAG.
// O destino mostrado na tela segue a regra da demonstração aprovada: Tag → "painel da TAG (pendente de aprovação do Otávio)".

// Contratos da Engenharia (Gustavo, 16/11): o saldo desconta o que já foi pago = notas vinculadas + "Pago (histórico)" do quadro Contratos da Monday.
t("      const pago = ids.reduce((s, id) => s + Number(notaPorId.get(id)?.valor || 0), 0);",
  "      const pagoNotas = ids.reduce((s, id) => s + Number(notaPorId.get(id)?.valor || 0), 0), pagoHistorico = Number(c.pagoHistorico || 0), pago = pagoNotas + pagoHistorico;", 1, 1);
t("return { ...c, notasIds: ids, pago, aditivo, total, saldo: total - pago };", "return { ...c, notasIds: ids, pago, pagoNotas, pagoHistorico, aditivo, total, saldo: total - pago };", 1, 1);
t("Pago = soma das notas vinculadas (na Monday ou aqui no painel)", "Pago = soma das notas vinculadas (na Monday ou aqui no painel) + Pago (histórico)", 1, 1);

// Pedidos da Camila (17/11/2026, autorizados pelo Gustavo). Só no painel da Engenharia.
// 1) Engenheiros veem todas as abas (antes: só Engenharia, Contratos, Fora e Todas). Ações das outras etapas continuam bloqueadas pelo perfil.
t("const abasVisiveis = () => pessoa.perfil === 'engenharia' ? ABAS.filter(([k]) => ['engenharia','contrato','fora','todas'].includes(k)) : ABAS;",
  "const abasVisiveis = () => ABAS;", 1, 1);
// 2) Pagador, Categoria e Endereço da obra também na janela "Abrir" da análise (gravam na hora, como no quadro).
t("${D.modoValidacao ? '' : '<label class=\"cx-campo\">Motivo da devolução (se necessário)",
  "<div class=\"cx-duas\"><label class=\"cx-campo\">Pagador${celulaLista(n, 'pagador', 'Pagador', LISTAS_ENG.pagador)}</label><label class=\"cx-campo\">Categoria${celulaLista(n, 'categoria', 'Categoria', LISTAS_ENG.categoria)}</label></div><label class=\"cx-campo\">Endereço da obra${celulaLista(n, 'endereco', 'Endereço da obra', LISTAS_ENG.endereco)}</label>\n        ${D.modoValidacao ? '' : '<label class=\"cx-campo\">Motivo da devolução (se necessário)", 1, 1);
// 5) Engenheiro cancela nota (com motivo), exceto já enviada ou já cancelada. Mover de grupo continua só do administrativo (o banco confere: e19).
t("  function blocoAnexosPainel(n){",
  "  const engenheiroCancela = n => pessoa.perfil === 'engenharia' && !!D.analise?.mover && !['encaminhada', 'fiscal', 'cancelada'].includes(n.etapa);\n  function blocoAnexosPainel(n){\n    if (engenheiroCancela(n)) return `<div class=\"cx-acoes\">${botao('cancelarNota', 'Cancelar nota', true, false)}</div>`;", 1, 1);
t("const opts = GRUPOS_MOVER.filter(([v]) => v !== 'removida' || D.analise?.removerSuportado)",
  "const opts = GRUPOS_MOVER.filter(([v]) => (pessoa.perfil !== 'engenharia' || v === 'cancelada') && (v !== 'removida' || D.analise?.removerSuportado))", 1, 1);

// 19/11/2026 (Beatriz/Gustavo): Cód. Fornecedor editável (quadro e bloco de envio), Data de recebimento, Pagador no bloco de envio,
// endereço novo. O Cód. Fornecedor grava como correção (codigo_emitente) e vai no envio para o SharePoint.
t("  function acaoDaNota(n){", `  const podeCorrigirCodigo = n => !!D.analise?.salvarCodigo && ['equipe','admin'].includes(pessoa.perfil) && ['engenharia','contrato','pedido','aprovacao','escrituracao','fora'].includes(n.etapa);
  const celulaCodigo = (n, id) => podeCorrigirCodigo(n)
    ? \`<input class="cx-cel" \${id ? 'id="' + id + '"' : ''} data-celula="cod_fornecedor" data-celula-nota="\${esc(n.id)}" value="\${esc(n.cod_fornecedor || '')}" placeholder="Código Datasul" inputmode="numeric" autocomplete="off" aria-label="Cód. Fornecedor da NF \${esc(n.nf)}">\`
    : \`<span class="cx-cel-leitura">\${esc(n.cod_fornecedor || '—')}</span>\`;
  const camposEnvioEng = n => { const d = destinoEscrituracao(n); return \`<div class="cx-duas"><label class="cx-campo">Pagador\${celulaLista(n, 'pagador', 'Pagador', LISTAS_ENG.pagador)}</label><label class="cx-campo">Cód. Fornecedor (Datasul)\${celulaCodigo(n, 'cxEmitente')}</label></div>\${d.vai ? '' : \`<p class="cx-aviso-perm">Não dá para enviar: \${esc(d.texto.replace(/^não vai:\\s*/, ''))}.\${n.natureza === 'Remessa' ? ' Se ela já foi escriturada, use os três pontinhos da linha → Mover para grupo → Encaminhadas.' : ' Corrija acima e o botão libera.'}</p>\`}\`; };
  // Novo endereço: a lista vira um campo de texto; Enter ou sair do campo grava; Esc desiste.
  document.addEventListener('change', e => {
    const s = e.target;
    if (!s.matches?.('select[data-celula="endereco"]') || s.value !== '__novo__') return;
    e.stopImmediatePropagation();
    const campo = document.createElement('input'), anterior = D.fluxo[s.dataset.celulaNota]?.endereco || '';
    campo.className = 'cx-cel'; campo.dataset.celula = 'endereco'; campo.dataset.celulaNota = s.dataset.celulaNota; campo.autocomplete = 'off';
    campo.placeholder = 'Digite o novo endereço e tecle Enter'; campo.setAttribute('aria-label', 'Novo endereço da obra');
    s.replaceWith(campo); campo.focus();
    campo.addEventListener('keydown', ev => { if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); campo.value = anterior; campo.blur(); } });
    campo.addEventListener('change', () => { const v = campo.value.trim(); if (v && !(window.__enderecosExtras || []).includes(v)) (window.__enderecosExtras ||= []).push(v); });
  }, true);
  function acaoDaNota(n){`, 1, 1);
t("  async function gravarCampos(id, campos){\n    const f = D.fluxo[id];\n    if (D.analise){",
  "  async function gravarCampos(id, campos){\n    const f = D.fluxo[id];\n    // 19/11/2026: Cód. Fornecedor grava como correção da nota (codigo_emitente), não na análise.\n    if (D.analise?.salvarCodigo && 'cod_fornecedor' in campos){ const r = await D.analise.salvarCodigo(id, campos.cod_fornecedor, f.versao ?? null); Object.assign(f, { etapa:r.etapa, historico:r.historico, versao:r.versao }); return; }\n    if (D.analise){", 1, 1);
// Depois de trocar Pagador ou Cód. Fornecedor dentro da janela, a janela se atualiza (destino e botão de envio).
t("atualizarLinha(el.closest('[data-linha]'))", "{ atualizarLinha(el.closest('[data-linha]')); if (el.closest('#cxModal') && abertoId === id && ['pagador', 'cod_fornecedor'].includes(campo)) abrirNota(id); }", 1, 1);
// Colunas novas do quadro: Cód. Fornecedor (depois de Categoria) e Recebimento (depois de Emissão).
t('<th>Categoria</th><th>Emissão</th><th>Envio</th>', '<th>Categoria</th><th>Cód. Fornecedor</th><th>Emissão</th><th>Recebimento</th><th>Envio</th>', 1, 1);
t("<td>${celulaLista(n, 'categoria', 'Categoria', LISTAS_ENG.categoria)}</td><td>${dataBR(n.emissao)}</td><td>${dataBR(n.dataEnvio || n.monday?.data_envio)}</td>",
  "<td>${celulaLista(n, 'categoria', 'Categoria', LISTAS_ENG.categoria)}</td><td class=\"cx-q-cod\">${celulaCodigo(n)}</td><td>${dataBR(n.emissao)}</td><td>${dataBR(n.dataRecebimento)}</td><td>${dataBR(n.dataEnvio || n.monday?.data_envio)}</td>", 1, 1);

// =====================================================================
// 3) Camada de produção: adaptador do banco real + página base publicada
// =====================================================================
const adaptador = readFileSync(join(ESTA, 'adaptador-engenharia.js'), 'utf8');
const jsAreas = regras + '\n' + lerBase('reservas.js').replaceAll('expansao_colaboracao_v1', 'engenharia_colaboracao_v1') + '\n' + areas;
const js = adaptador + '\n' + jsAreas;
if (/<\/script/i.test(js)) throw Error('Os scripts não podem conter o fechamento de script.');
if (/window\.__demo\b|cxEntrarComo|cxVerComo|demo-banco|demonstracao\.invalid/.test(js)) throw Error('Controle da demonstração no pacote de produção.');

let html = readFileSync(join(ESTA, 'base-publicada-2026-11-16.html'), 'utf8');
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
const css = lerBase('areas-novas.css') + '\n' + lerAqui('cartoes-notas.css') + '\n' + lerBase('direcao.css').split('/* Entrada da prévia:')[0] + '\n' + lerAqui('laranja-engenharia.css');

// Excel (900 kB) não segura a abertura (async): baixa em paralelo e só é usado ao exportar.
trocarRegex(/<script src="https:\/\/unpkg\.com\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js" crossorigin="anonymous"><\/script>\r?\n<script>window\.XLSX \|\| document\.write\([^\n]*\n/,
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" crossorigin="anonymous" async></script>\n');
trocarRegex(/<title>[^<]*<\/title>/, '<title>Painel de Engenharia · Empresa Exemplo</title>');
naPosicao('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex">');   // 17/11/2026: sem desligar showDirectoryPicker (pastas ativas)
trocarRegex(/const APP_BUILD = "([^"]*)";/, 'const APP_BUILD = "$1-painel-unico";');
// Sem vigia de pasta e sem a tela obrigatória de pastas: as notas entram pelo painel de Lançamento já em uso ou pelo botão "Incluir nota".
trocar("indexedDB.open('painel_eng_db', 1)", "indexedDB.open('painel_eng_db_painel_unico', 1)");
trocar('function abrirSetupGateSeNecessario(){', 'function abrirSetupGateSeNecessario(){ return;');
// 19/11/2026 (Beatriz): Endereço do lançamento aceita endereço novo (o adaptador liga a opção "＋ Adicionar novo endereço…").
trocar("function espelhoSelect(rec, field, opcoes, extra){\n    const atual = rec[field] || '';",
  "function espelhoSelect(rec, field, opcoes, extra){\n    if(field === 'endereco') opcoes = [...new Set([...opcoes, ...(window.__enderecosExtras || []), ...LANCAMENTOS.map(r => String(r.endereco || '').trim()).filter(Boolean)])];\n    const atual = rec[field] || '';");
trocar("${opcoes.map(op=>`<option value=\"${escapeHtml(op)}\" ${atual===op?'selected':''}>${escapeHtml(op)}</option>`).join('')}\n        </select>`;\n  }\n\n  // Badge de vencimento",
  "${field === 'endereco' ? '<option value=\"__novo__\">＋ Adicionar novo endereço…</option>' : ''}${opcoes.map(op=>`<option value=\"${escapeHtml(op)}\" ${atual===op?'selected':''}>${escapeHtml(op)}</option>`).join('')}\n        </select>`;\n  }\n\n  // Badge de vencimento");
// Equipe antes de tudo; engenheiros não carregam o lançamento.
trocar('if(jaCarregou) return; jaCarregou = true;',
  'if(jaCarregou) return; jaCarregou = true;\n    // Com sessão salva, o painel chega aqui antes do script de Aprovações carregar: espera por ele.\n    if(!window.__expansaoAntes) await new Promise(ok=>{const t=setInterval(()=>{if(window.__expansaoAntes){clearInterval(t);ok();}},30);});\n    if(!(await window.__expansaoAntes(currentEmail))) return;\n    if(window.__expansaoAoEntrar) window.__expansaoAoEntrar(currentEmail, currentUser);\n    if(window.__expansaoSemLancamento){ const g=document.getElementById(\'splashGate\'); if(g) g.style.display=\'none\'; return; }');
trocar('<!-- Assistente (build106;', `<nav id="cxAbas" role="tablist" hidden></nav>
<main id="cxArea" hidden></main>
<div id="cxModal" hidden></div><div id="cxToast" role="status" aria-live="polite" hidden></div>
<!-- Assistente (build106;`);
// "Esqueci minha senha" no login (16/11/2026): o adaptador liga o botão e envia o pedido à função recuperar-senha.
trocar('<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>', '<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>\n    <button type="button" id="gateEsqueci" style="margin-top:12px;background:none;border:0;color:inherit;opacity:.85;text-decoration:underline;cursor:pointer;font:inherit;font-size:13px">Esqueci minha senha</button>\n    <div id="gateRecado" role="status" aria-live="polite" style="margin-top:8px;font-size:13px;line-height:1.5;opacity:.9"></div>');
// Mesma fonte editorial carregada pela Expansão.
html = html.replace('family=JetBrains+Mono:wght@500;600&display=swap', 'family=JetBrains+Mono:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap');
naPosicao('</head>', `<style>
${css}
/* 17/11/2026 (pedido da Camila): quadro de Aprovações mais compacto, para a linha caber sem arrastar para o lado. */
body.cx-experiencia .cx-quadro{min-width:0!important;width:100%}
body.cx-experiencia .cx-quadro th{white-space:normal!important;padding:8px 5px!important;font-size:8px!important;line-height:1.3}
body.cx-experiencia .cx-quadro td{padding:4px 5px!important;font-size:11px!important}
body.cx-experiencia .cx-quadro td:nth-child(4),body.cx-experiencia .cx-quadro td:nth-child(5){min-width:0!important}
body.cx-experiencia .cx-quadro .cx-cel{min-width:0!important;width:100%;max-width:170px;font-size:11px;padding:3px 4px}
body.cx-experiencia .cx-quadro .cx-q-narr .cx-cel{max-width:220px}
body.cx-experiencia .cx-quadro .cx-q-nota small{white-space:normal;max-width:180px;display:block}
body.cx-experiencia .cx-quadro .cx-q-acoes{white-space:nowrap}
#cxEscolhaEquipe{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgb(10 14 20 / .78);padding:16px}
#cxEscolhaEquipe section{width:min(520px,100%);background:#fff;color:#17202f;border-radius:10px;padding:26px;font:14px/1.5 system-ui,sans-serif}
#cxEscolhaEquipe h2{margin:0 0 6px;font-size:22px}
#cxEscolhaEquipe .cx-escolhas{display:grid;gap:10px;margin:18px 0}
#cxEscolhaEquipe [data-equipe]{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px 14px;border:1px solid #c9d1dc;border-radius:8px;background:#f7f9fc;color:#17202f;font:inherit;cursor:pointer;text-align:left}
#cxEscolhaEquipe [data-equipe][aria-pressed="true"]{border-color:#e8792e;background:#fdf0e6}
#cxEscolhaEquipe [data-equipe] small{color:#596473}
#cxEscolhaEquipe [data-confirmar]{margin-left:8px;padding:7px 14px;border:0;border-radius:6px;background:#b94a0b;color:#fff;font:inherit;cursor:pointer}
#cxEscolhaEquipe button:focus-visible{outline:2px solid #b94a0b;outline-offset:2px}
#cxEscolhaEquipe .cx-escolha-erro{color:#ae202b}
</style>
</head>`);
naPosicao('</body>', `<script>\n${js}\n</script>\n</body>`, true);

html = comInclusaoManual(html);   // botão "＋ Incluir nota" no Lançamento (16/11/2026)
html = comCarregamentoHtml(comFavicon(comLoginPadrao(comSemSaudacao(html), { marca:'engenharia', mensagem:'Lançamentos, aprovações e notas da TAG.' })));
html = semMonday(html);   // 19/11/2026: Monday só como histórico
html = comBoletoDepoisDoEnvio(html);   // 19/11/2026: boleto depois do envio (Laura)
html = comAbaUnicaDocumentos(html);   // 19/11/2026: arquivos abrem sempre na mesma aba (Beatriz)
const destino = join(ESTA, 'index.html');
writeFileSync(destino + '.tmp', html, 'utf8');
renameSync(destino + '.tmp', destino);
console.log('Painel de Engenharia (produção) gerado:', destino, Math.round(html.length / 1024) + ' kB');
