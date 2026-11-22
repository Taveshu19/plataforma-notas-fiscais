import { comSemSaudacao, comLoginPadrao } from '../copia-painel/entrada-padrao.mjs';
import { comFavicon } from '../copia-painel/favicon.mjs';
import { comCarregamentoHtml, comCarregamentoJs } from '../copia-painel/carregamento.mjs';
// Gera copia-engenharia/index.html: a tela de Aprovações da Expansão (copia-painel) adaptada à Engenharia.
// Uso: node montar-copia-engenharia.mjs
// Nada da Expansão é alterado: os arquivos de ../copia-painel só são lidos, e cada diferença da
// Engenharia entra como uma troca marcada abaixo. O painel de Engenharia (C:/Painéis/Engenharia/painel)
// também só é lido. A cópia fica desligada do Supabase, igual à da Expansão (banco falso, dados fictícios).
// Se um trecho esperado não existir mais, o script para com erro em vez de gerar uma cópia errada.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = join(AQUI, '../copia-painel');
// Caminho relativo às pastas deste repositório (codigo/).
const ORIGEM = join(AQUI, '../../paineis-originais/Engenharia/painel/index.html');
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
regras = trocarEm(regras, "&& (!f.natureza || r.natureza === f.natureza)", "&& (!f.natureza || r.natureza === f.natureza) && (!f.pagador || r.pagador === f.pagador)", 1, 1);

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
  document.addEventListener('click', e => { if (!e.target.closest('[data-voltar-painel]')) return; const outra = [...document.querySelectorAll('#cxAbas [data-area]')].find(b => b.dataset.area !== 'notasTag'); outra?.click(); });
  const telaNotasTag = () => \`<style>.cx-embutido:has(.cx-notas-tag){top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;z-index:300!important}.cx-embutido .cx-notas-tag .cx-portfolio-topo{display:none}.cx-embutido .cx-notas-tag .cx-notas-tag-flutuante{position:fixed;left:12px;bottom:12px;z-index:301;display:flex;gap:8px;flex-wrap:wrap}</style><div class="cx-portfolio cx-notas-tag"><div class="cx-portfolio-topo"><div><span class="cx-kicker">ADMINISTRATIVO · PAINEL DA TAG</span><h3>Administrativo · Notas TAG</h3><small class="cx-notas-tag-aviso" style="display:block;font-size:11.5px;opacity:.72;margin-top:3px">Toda a equipe pode consultar. Para editar, clique em Login para edição e entre com sua senha.</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="cx-btn" data-login-tag style="font-weight:600">Login para edição</button><a class="cx-btn cx-mini" href="\${esc(NOTAS_TAG_URL)}" target="_blank" rel="noopener">Abrir em nova aba</a></div></div><iframe class="cx-portfolio-quadro" src="\${esc(NOTAS_TAG_URL)}" title="Notas TAG"></iframe><div class="cx-notas-tag-flutuante"><button type="button" class="cx-btn" data-login-tag style="font-weight:600">Login para edição</button><button type="button" class="cx-btn cx-mini" data-voltar-painel>Voltar ao painel</button><a class="cx-btn cx-mini" href="\${esc(NOTAS_TAG_URL)}" target="_blank" rel="noopener">Abrir em nova aba</a></div></div>\`;
  // Portfólio de Projetos (site do Marcos) dentro do painel.`, 1, 1);
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
  // 19/11/2026 (painel lento): a lista nasce só com o valor escolhido e recebe as opções quando a pessoa clica nela (igual à produção).
  const opcoesListaHtml = (campo, opcoes, v) => \`<option value=""\${v ? '' : ' selected'}>—</option>\${[...(v && !opcoes.includes(v) ? [v] : []), ...opcoes].map(o => \`<option\${o === v ? ' selected' : ''}>\${esc(o)}</option>\`).join('')}\`;
  const celulaLista = (n, campo, rotulo, opcoes) => { const v = n[campo] || ''; return podeEditarAnalise(n)
    ? \`<select class="cx-cel cx-cel-lista" data-celula="\${campo}" data-celula-nota="\${esc(n.id)}" data-lista-preguica="\${campo}" aria-label="\${rotulo} da NF \${esc(n.nf)}">\${v ? \`<option selected>\${esc(v)}</option>\` : '<option value="" selected>—</option>'}</select>\`
    : \`<span class="cx-cel-leitura" title="\${esc(v)}">\${esc(v || '—')}</span>\`; };
  const completarLista = s => { if (!s?.dataset?.listaPreguica) return; const campo = s.dataset.listaPreguica, v = s.value; delete s.dataset.listaPreguica; s.innerHTML = opcoesListaHtml(campo, LISTAS_ENG[campo] || [], v); };
  ['mousedown', 'focusin', 'keydown', 'touchstart'].forEach(tipo => document.addEventListener(tipo, e => { const s = e.target?.closest?.('select[data-lista-preguica]'); if (s) completarLista(s); }, true));
  const celulaTextoLonga = (n, campo, rotulo) => podeEditarAnalise(n)
    ? \`<textarea class="cx-cel" rows="3" data-celula="\${campo}" data-celula-nota="\${esc(n.id)}" placeholder="\${rotulo}" aria-label="\${rotulo} da NF \${esc(n.nf)}">\${esc(n[campo] || '')}</textarea>\`
    : \`<span class="cx-cel-leitura cx-cel-quebra">\${esc(n[campo] || '—')}</span>\`;
  const fichaNota = n => \`<article class="cx-ficha cx-ficha-nota" data-linha="\${esc(n.id)}" data-texto="\${esc(R.texto(n))}" data-unidade="\${esc(n.unidade)}" data-status="\${esc(n.etapa)}" data-natureza="\${esc(n.natureza)}" data-emissao="\${esc(String(n.emissao || '').slice(0, 10))}">
    <div class="cx-ficha-topo"><span>NF \${esc(n.nf)}</span>\${etiqueta(ETAPAS[n.etapa], n.etapa === 'escrituracao' ? 'verde' : n.etapa === 'contrato' ? 'ambar' : ['cancelada', 'devolvida'].includes(n.etapa) ? 'rosa' : '')}</div>
    <div class="cx-ficha-titulo"><span class="cx-kicker">\${unidade(n.unidade)} <span> / </span> \${esc(n.natureza)}</span><h3 title="\${esc(n.fornecedor)}">\${esc(n.fornecedor)}</h3><span data-reserva-nota="\${esc(n.id)}" class="cx-reserva-etiqueta"></span></div>
    <dl class="cx-ficha-dados"><div><dt>Valor</dt><dd>\${dinheiro(n.valor)}</dd></div><div><dt>Vencimento</dt><dd>\${dataBR(n.vencimento)}</dd></div></dl>
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
t("<div><span>Pagamento</span>${esc(n.pagamento)}</div>", "<div><span>Pagamento</span>${esc(n.pagamento)}</div><div><span>Pagador</span>${esc(n.pagador || '—')}</div><div><span>Categoria</span>${esc(n.categoria || '—')}</div><div><span>Cód. Fornecedor</span>${esc(n.cod_fornecedor || '—')}</div><div><span>Endereço da obra</span>${esc(n.endereco || '—')}</div>", 1, 1);
t("filtroVazio = () => ({ busca:'', unidade:'', status:'', prioridade:'', fornecedor:'', natureza:'', de:'', ate:'' })", "filtroVazio = () => ({ busca:'', unidade:'', status:'', prioridade:'', fornecedor:'', natureza:'', pagador:'', de:'', ate:'' })", 1, 1);
t("return `<label>Natureza<select data-cxfilter=\"natureza\">${opcoes([['','Todas'],...unicos('natureza').map(x => [x,x])], f.natureza)}</select></label>",
  "return `<label>Natureza<select data-cxfilter=\"natureza\">${opcoes([['','Todas'],...unicos('natureza').map(x => [x,x])], f.natureza)}</select></label><label>Pagador<select data-cxfilter=\"pagador\">${opcoes([['','Todos'],...unicos('pagador').map(x => [x,x])], f.pagador)}</select></label>", 1, 1);

// Destino da escrituração: na Engenharia depende do Pagador (Beatriz, 23/10/2026; notificar-escrituracao da Engenharia).
t('  function acaoDaNota(n){', `  // Destino da escrituração da Engenharia (regra da função notificar-escrituracao, rotaDa): depende do Pagador, não só da unidade.
  //   Remessa → não vai · Holding → SharePoint, ou e-mail ao fiscal se a unidade for Pinhal
  //   Empresa Exemplo, Parceira, Condomínio Lago → e-mail da Planilha Azul · Tag, Coligada, outros ou sem Pagador → não vai.
  const PAGADORES_PLANILHA_AZUL = ['empresa exemplo', 'parceira', 'condomínio lago'];
  const destinoEscrituracao = n => {
    const pag = String(n.pagador || '').replace(/\\s+/g, ' ').trim(), chave = pag.toLowerCase();
    if (n.natureza === 'Remessa') return { tipo:'nao', vai:false, texto:'não vai: nota de Remessa não é escriturada' };
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
t("const podeEscriturar = n => n.etapa === 'escrituracao' && !!D.escriturar && ['equipe','admin'].includes(pessoa.perfil);", "const podeEscriturar = n => n.etapa === 'escrituracao' && !!D.escriturar && ['equipe','admin'].includes(pessoa.perfil) && destinoEscrituracao(n).vai;", 1, 1);

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

// =====================================================================
// 3) Banco falso e entrada da demonstração (dados fictícios da Engenharia)
// =====================================================================
let banco = lerBase('demo-banco.js');
const b = (de, para, minimo = 1, exato = null) => { banco = trocarEm(banco, de, para, minimo, exato); };
b("const CHAVE = 'copia_demo_banco_v5', CHAVE_SESSAO = 'copia_demo_sessao_v1';", "const CHAVE = 'copia_eng_banco_v1', CHAVE_SESSAO = 'copia_eng_sessao_v1';", 1, 1);
b("const SENHA_INICIAL = 'SenhaDemo2026', CHAVE_CONTAS = 'copia_demo_contas_v1';", "const SENHA_INICIAL = 'SenhaDemo2026', CHAVE_CONTAS = 'copia_eng_contas_v1';", 1, 1);
b("const BASE_ARQUIVOS = 'copia_demo_anexos';", "const BASE_ARQUIVOS = 'copia_eng_anexos';", 1, 1);
b("copia_demo_preencher", "copia_eng_preencher", 1);
b("painel_nf_", "painel_eng_", 3);   // o painel da Engenharia guarda a sessão com o prefixo painel_eng_ (Ver como)
b("expansao_colaboracao_v1", "engenharia_colaboracao_v1", 1);
banco = trocarTrechoEm(banco, '  const PESSOAS = [', '  ];\n', `  // Camila, Paula e Beatriz lançam as notas, preenchem Narrativa/Contrato/Pertence/Pagador/Categoria/Endereço e registram o pedido (Gustavo, 14/11).
  const PESSOAS = [
    { email:'gustavo@empresa.exemplo', nome:'Gustavo', perfil:'admin', rotulo:'Administração · vê tudo' },
    { email:'marcos.prado@holding.exemplo', nome:'Marcos', perfil:'admin', rotulo:'Administração · vê tudo' },
    { email:'otavio.reis@holding.exemplo', nome:'Otávio', perfil:'tag', rotulo:'Só Administrativo (TAG) · edita' },   // Gustavo, 14/11: Otávio e BO só veem a TAG
    { email:'beatriz.martins@empresa.exemplo', nome:'Beatriz', perfil:'equipe', rotulo:'Lançamento e aprovações' },
    { email:'bruno.alves@empresa.exemplo', nome:'Bruno', perfil:'equipe', rotulo:'Lançamento e aprovações' },
    { email:'camila.torres@empresa.exemplo', nome:'Camila', perfil:'engenharia', rotulo:'Só aprovações (análise)' },
    { email:'paula.duarte@empresa.exemplo', nome:'Paula', perfil:'engenharia', rotulo:'Só aprovações (análise)' },
    { email:'backoffice@investidora.exemplo', nome:'TAG (BO)', perfil:'tag', rotulo:'Só Administrativo (TAG) · edita' },
  `);
b("const EMAILS_PROJETOS = ['marcos.prado@holding.exemplo', 'gustavo@empresa.exemplo'];", "const EMAILS_PROJETOS = [];", 1, 1);
const obra = 'Rua das Acácias, 100 - Centro';
banco = trocarTrechoEm(banco, '  const CONTRATOS_DEMO = [', '\n  ];\n', `  const CONTRATOS_DEMO = [
    { id:'C-001', nome:'CONSTRUTORA EXEMPLO LTDA', grupo:'Contratos', unidade:'022 - Itatiba', tipologia:'Civil', tipo:'Contrato', status:'Ativo', aprovador:'Analista', referencia:'CT-ENG-014', narrativa:'', valorFechado:900000, aceite:'2026-03-10', cnpj:'12.345.678/0001-95', inclusao:'2026-03-01', aditivos:['C-002'], notas:['DEMO-009'], subitens:[], arquivos:[arq('ctr-C-001','Contrato-CONSTRUTORA-EXEMPLO.pdf','Monday')] }
    ,{ id:'C-002', nome:'CONSTRUTORA EXEMPLO - ADITIVO 1', grupo:'Aditivos', unidade:'022 - Itatiba', tipologia:'Civil', tipo:'Aditivo', status:'Ativo', aprovador:'Analista', referencia:'', narrativa:'', valorFechado:100000, aceite:'2026-05-05', cnpj:'12.345.678/0001-95', inclusao:'2026-05-01', aditivos:[], notas:[], subitens:[], arquivos:[arq('ctr-C-002','Aditivo-1.pdf','Monday')] }
    ,{ id:'C-003', nome:'ELÉTRICA MODELO LTDA', grupo:'Contratos', unidade:'001 - Sorocaba', tipologia:'Elétrica', tipo:'Contrato', status:'Ativo', aprovador:'Analista', referencia:'CT-ENG-021', narrativa:'', valorFechado:250000, aceite:'2026-04-04', cnpj:'98.765.432/0001-10', inclusao:'2026-04-01', aditivos:[], notas:[], subitens:[], arquivos:[arq('ctr-C-003','Contrato-ELETRICA-MODELO.pdf','Monday')] }
    ,{ id:'C-004', nome:'OFICINA MODELO LTDA', grupo:'Contratos finalizados', unidade:'006 - Pelotas', tipologia:'Mecânica', tipo:'Contrato', status:'Encerrado', aprovador:'Analista', referencia:'', narrativa:'', valorFechado:120000, aceite:'2025-11-11', cnpj:'11.222.333/0001-44', inclusao:'2025-11-01', aditivos:[], notas:[], subitens:[], arquivos:[] }`);
const nova = (id, nf, forn, un, nat, valor, status, extra) => `nota('${id}','${nf}','${forn}','${un}','${nat}',${valor},'${status}',${extra})`;
const eng = (pagador, categoria, cod, endereco = obra) => `pagador:'${pagador}', categoria:'${categoria}', cod_fornecedor:'${cod}', endereco:'${endereco}'`;
const fl = (etapa, resto) => `{ etapa:'${etapa}', ${resto} }`;
const rec = "historico:['Recebida do lançamento · dados fictícios']";
banco = trocarTrechoEm(banco, '  function dadosIniciais(){', '\n  let banco;', `  function dadosIniciais(){
    return {
      lancamentos: [
        ${nova('DEMO-001', '8042', 'Horizonte Materiais', 'ITATIBA', 'Material', 4280, 'Pendente', `{ ${eng('Holding', 'Material', '104510')} }`)},
        ${nova('DEMO-002', '5518', 'Vértice Instalações', 'SOROCABA', 'Serviço', 3120, 'Pendente', `{ pagamento:null, ${eng('Holding', 'Manutenção', '104511')} }`)},
        ${nova('DEMO-003', '77', 'Oficina Modelo', 'PELOTAS', 'Serviço', 980, 'Pendente', `{ cnpj_fornecedor:null, requer_revisao:true, ${eng('Empresa Exemplo', 'Serviços', '')} }`)},
        ${nova('DEMO-004', '217', 'Estrutura Engenharia', 'ITATIBA', 'Serviço', 8450, 'Enviado', `{ pagador:'', categoria:'', endereco:'', cod_fornecedor:'104522' }`)},
        ${nova('DEMO-005', '3302', 'Campo Alto Terraplenagem', 'FILIAL B CAMPINA GRANDE', 'Serviço', 12600, 'Enviado', `{ pagador:'', categoria:'', endereco:'', cod_fornecedor:'104530' }`)},
        ${nova('DEMO-006', '9301', 'Norte Equipamentos', 'PINHAL', 'Material', 1930, 'Enviado', `{ ${eng('Holding', 'Uso e Consumo', '104540', 'Rua do Comércio, 754 - Vila Nova')} }`)},
        ${nova('DEMO-007', '331', 'Base Serviços', 'CORPORATIVO', 'Serviço', 6700, 'Enviado', `{ ${eng('Empresa Exemplo', 'Manutenção', '104550', 'Rua Bela Vista, 655 - Vila Operária')} }`)},
        ${nova('DEMO-008', '1209', 'Sul Materiais', 'PELOTAS', 'Material', 1560, 'Enviado', `{ ${eng('Holding', 'Material', '104560', 'Av. Brasil, 285 - Santa Rita')} }`)},
        ${nova('DEMO-009', '470', 'Concreto Modelo', 'PINHAL', 'Material', 5200, 'Enviado', `{ ${eng('Holding', 'Material', '104570', 'Rua do Comércio, 754 - Vila Nova')} }`)},
        ${nova('DEMO-010', '88', 'Transportes Rápido', 'SOROCABA', 'Remessa', 420, 'Enviado', `{ ${eng('Holding', 'Material', '104580')} }`)},
        ${nova('DEMO-011', '5120', 'Edificações Norte', 'COMÉRCIO', 'Serviço', 7300, 'Enviado', `{ ${eng('Parceira', 'Obras/Reformas', '104590')} }`)},
        ${nova('DEMO-012', '6610', 'Manutenção Predial Exemplo', 'CORPORATIVO', 'Serviço', 3850, 'Enviado', `{ ${eng('Tag', 'Manutenção', '104600', 'Rua Bela Vista, 655 - Vila Operária')} }`)},
      ],
      historico_status: [], arquivos_processados: [], exclusoes_recentes: [],
      // Etapa de cada nota já enviada (a jornada da Engenharia é a mesma da Expansão).
      fluxo: {
        'DEMO-004': ${fl('engenharia', `narrativa:'', contrato:'', expansao:'', pedido:'', ${rec}`)},
        'DEMO-005': ${fl('engenharia', `narrativa:'', contrato:'', expansao:'', pedido:'', ${rec}`)},
        'DEMO-006': ${fl('pedido', "narrativa:'Material para a casa de bombas.', contrato:'Não', expansao:'Sim', pedido:'', historico:['Análise aprovada · dados fictícios']")},
        'DEMO-007': ${fl('aprovacao', "narrativa:'Serviço de manutenção da cobertura.', contrato:'Não', expansao:'Sim', pedido:'131800', historico:['Pedido 131800 registrado · dados fictícios']")},
        'DEMO-008': ${fl('escrituracao', "narrativa:'Materiais para instalação elétrica.', contrato:'Não', expansao:'Sim', pedido:'131809', historico:['Pedido aprovado · dados fictícios']")},
        'DEMO-009': ${fl('escrituracao', "narrativa:'Concretagem da base.', contrato:'Sim', contratoRef:'CT-ENG-014', expansao:'Sim', pedido:'131810', historico:['Pedido aprovado · dados fictícios']")},
        'DEMO-010': ${fl('escrituracao', "narrativa:'Retorno de remessa de equipamento.', contrato:'Não', expansao:'Sim', pedido:'131811', historico:['Pedido aprovado · dados fictícios']")},
        'DEMO-012': ${fl('escrituracao', "narrativa:'Manutenção do telhado do galpão (Pagador Tag).', contrato:'Não', expansao:'Sim', pedido:'131812', historico:['Pedido aprovado · dados fictícios']")},
        'DEMO-011': ${fl('contrato', "narrativa:'Ampliação da portaria.', contrato:'Sim', expansao:'Sim', pedido:'', historico:['Análise aprovada · dados fictícios']")},
      },
      requisicoes: [],
    };
  }
`);

// =====================================================================
// 4) Entrada da demonstração
// =====================================================================
import { estiloBotaoLoginPadrao } from '../copia-painel/entrada-padrao.mjs';
let demo = lerBase('demo-interface.js');
const d = (de, para, minimo = 1, exato = null) => { demo = trocarEm(demo, de, para, minimo, exato); };
d('expansão <small>EMPRESA EXEMPLO</small>', 'engenharia <small>EMPRESA EXEMPLO</small>', 1, 1);
d('Lançamentos, aprovações e compras.', 'Aprovações das notas da engenharia.', 1, 1);
d('Mesmo login do painel atual. Engenheiros e Helena fazem o primeiro acesso com a senha inicial <b>${esc(D.SENHA_INICIAL)}</b> e, em seguida, criam a própria senha.', 'Use seu e-mail e sua senha.', 1, 1);
d('<span>PRÉVIA INTERATIVA</span>', '<span>EMPRESA EXEMPLO</span>', 1, 1);
d("$('#splashGate .gate-login').prepend(titulo);", `  const estiloEntrada = document.createElement('style');
  estiloEntrada.textContent = ${JSON.stringify(estiloBotaoLoginPadrao)};
  document.head.append(estiloEntrada);`, 1, 1);
d('copia_demo_preencher', 'copia_eng_preencher', 1);

// =====================================================================
// 5) Casca: o painel de Engenharia, desligado do banco real
// =====================================================================
let html = readFileSync(ORIGEM, 'utf8');
const h = (de, para, vezes = 1) => { html = trocarEm(html, de, para, vezes, vezes); };
const POLITICA = ["default-src 'none'", "script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com data:', 'img-src data: blob:',
  "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "object-src 'none'", `frame-src ${NOTAS_TAG_URL.replace(/\/$/, '')}`].join('; ');
const QUADROS = lerBase('trechos-quadros.js');
// Aba Atividades (Gustavo, 14/11): quadro Monday 18397191835 (workspace Engenharia Empresa Exemplo), cópia lida em 14/11.
// Todos da Engenharia veem e exportam; na demonstração a administração cria e edita (fica só na memória da página).
t("const ACESSO = { admin:['lancamento','aprovacoes','notasTag'], equipe:['lancamento','aprovacoes','notasTag'], engenharia:['aprovacoes','notasTag'], tag:['notasTag'] };",
  "const ACESSO = { admin:['lancamento','aprovacoes','notasTag','atividades'], equipe:['lancamento','aprovacoes','notasTag','atividades'], engenharia:['aprovacoes','notasTag','atividades'], tag:['notasTag'] };", 1, 1);
t('  function telaProjetos(){\n    const P = D.projetos;', '  const podeMexerPortfolio = p => p.perfil === \'admin\';\n  const numeroBR = v => { const s = String(v ?? \'\').trim(); if (!s) return NaN; return Number(s.includes(\',\') ? s.replace(/\\./g, \'\').replace(\',\', \'.\') : s); };\n' + QUADROS + '  function telaProjetos(P = D.projetos, chave = \'projetos\'){', 1, 1);
t('const f = filtros.projetos,', 'const f = filtros[chave] || (filtros[chave] = filtroVazio()),', 1, 1);
t("    if (area === 'projetos') $('#cxArea').innerHTML = telaProjetos();", "    if (area === 'projetos') $('#cxArea').innerHTML = telaProjetos();\n    if (area === 'atividades') $('#cxArea').innerHTML = telaProjetos(D.atividades, 'atividades');\n    { const nAt = $('#cxAbas [data-area=atividades] .cx-num'); if (nAt) nAt.textContent = D.atividades?.itens.length ?? 0; }", 1, 1);
t("projetos:'Quadro de Projetos', ", "projetos:'Quadro de Projetos', atividades:'Atividades', ", 1, 1);
t("projetos:'Projetos', portfolio:'Portfólio (Monday)'", "projetos:'Projetos', atividades:'Atividades', portfolio:'Portfólio (Monday)'", 1, 1);
t("projetos:'tabela',portfolio:'grade'", "projetos:'tabela',atividades:'tabela',portfolio:'grade'", 1, 1);
t('<span class="cx-kicker">QUADRO DE PROJETOS</span><h3>${esc(P.quadro.nome || \'Portfólio de Projetos\')}</h3></div>', '<span class="cx-kicker">${chave === \'atividades\' ? \'QUADRO DE ATIVIDADES\' : \'QUADRO DE PROJETOS\'}</span><h3>${esc(P.quadro.nome || \'Portfólio de Projetos\')}</h3></div>${acoesQuadro(chave)}', 1, 1);
t("<thead><tr><th>Projeto</th>${colunas.map(c => `<th>${esc(c.titulo)}</th>`).join('')}</tr></thead>", "<thead><tr><th>${chave === 'atividades' ? 'Atividade' : 'Projeto'}</th>${colunas.map(c => `<th>${esc(c.titulo)}</th>`).join('')}<th></th></tr></thead>", 1, 1);
t("${celulaProjeto(c, i.valores[c.id])}</td>`).join('') + '</tr>';", "${celulaProjeto(c, i.valores[c.id])}</td>`).join('') + `<td class=\"cx-q-acoes\"><button class=\"cx-btn cx-mini\" data-quadro-editar=\"${chave}|${esc(i.item_id)}\">Editar</button></td></tr>`;", 1, 1);
t("Cópia do quadro da Monday, atualizada a cada 5 minutos", "Cópia do quadro da Monday", 1, 1);
const ATIVIDADES = readFileSync(join(AQUI, 'atividades-demo.json'), 'utf8');
b('get contratos(){ return CONTRATOS_DEMO; },', `get contratos(){ return CONTRATOS_DEMO; },
    get atividades(){ return this._atividades ||= ${ATIVIDADES}; },
    salvarItemQuadro(chave, id, d){
      const P = this.atividades; const g = P.quadro.grupos.find(x => x.id === d.grupo); if (!g) throw Error('Escolha o grupo.');
      if (id){ const i = P.itens.find(x => x.item_id === id); Object.assign(i, { nome:d.nome, grupo_id:d.grupo, grupo_nome:g.titulo, valores:{ ...i.valores, ...d.valores } }); }
      else P.itens.push({ item_id:'P-' + Date.now().toString(36), grupo_id:d.grupo, grupo_nome:g.titulo, ordem:P.itens.length, nome:d.nome, valores:d.valores, subitens:[] });
    },`, 1, 1);
const jsAreas = regras + '\n' + lerBase('reservas.js').replaceAll('expansao_colaboracao_v1', 'engenharia_colaboracao_v1') + '\n' + areas;
if (/<\/script/i.test(banco + jsAreas + demo)) throw Error('Os scripts não podem conter o fechamento de script.');

const naPosicao = (marca, para, ultima = false) => {
  const i = ultima ? html.lastIndexOf(marca) : html.indexOf(marca);
  if (i < 0) throw Error('Marca não encontrada: ' + marca);
  html = html.slice(0, i) + para + html.slice(i + marca.length);
};
naPosicao('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="${POLITICA}">\n<meta name="robots" content="noindex">\n<script>window.showDirectoryPicker = undefined;</script>`);
html = trocarRegexEm(html, /<title>Painel de Lançamento de NFs · Engenharia<\/title>/, '<title>CÓPIA DE DEMONSTRAÇÃO · Painel de Engenharia</title>');
h('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3" crossorigin="anonymous"></script>', `<script>\n${banco}\n</script>`);
html = trocarRegexEm(html, /const SUPABASE_URL = "[^"]*";/, 'const SUPABASE_URL = "http://demonstracao.invalid";');
html = trocarRegexEm(html, /const SUPABASE_ANON_KEY = "[^"]*";/, 'const SUPABASE_ANON_KEY = "demonstracao";');
html = trocarRegexEm(html, /const APP_BUILD = "([^"]*)"/, 'const APP_BUILD = "$1-copia-demonstracao"');
html = html.replace(/\blocalStorage\b/g, 'sessionStorage');
h("indexedDB.open('painel_eng_db', 1)", "indexedDB.open('painel_eng_db_copia_demonstracao', 1)");
h('function abrirSetupGateSeNecessario(){', 'function abrirSetupGateSeNecessario(){ return;');
h('if(jaCarregou) return; jaCarregou = true;', 'if(jaCarregou) return; jaCarregou = true;\n    window.__demoEmail = currentEmail; if(window.__demoAoEntrar) window.__demoAoEntrar(currentEmail);');
html = trocarRegexEm(html, /alert\('Seu navegador não suporta esse recurso\.[^']*'\)/g, () => "alert('Pastas desligadas nesta cópia de demonstração.')");
h('<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>', '<button class="gate-btn" id="gateBtn">Entrar no Sistema</button>\n    <div id="cxEntrarComo"></div>');
// Mesma fonte editorial carregada pela Expansão.
html = html.replace('family=JetBrains+Mono:wght@500;600&display=swap', 'family=JetBrains+Mono:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap');
const css = lerBase('areas-novas.css') + '\n' + lerBase('direcao.css') + '\n' + lerAqui('cartoes-notas.css') + '\n' + lerAqui('laranja-engenharia.css');
naPosicao('</head>', `<style>\n${css}\n</style>\n</head>`);
naPosicao('</body>', `<div id="cxAviso" hidden><span><b>CÓPIA DE DEMONSTRAÇÃO.</b> Dados fictícios, sem ligação com o banco real. Nada aqui chega à equipe.</span><span style="display:inline-flex;gap:10px"><label>Ver como <select id="cxVerComo"></select></label><button id="cxReiniciar">Reiniciar dados</button></span></div>
<nav id="cxAbas" role="tablist" hidden></nav>
<main id="cxArea" hidden></main>
<div id="cxModal" hidden></div><div id="cxToast" role="status" aria-live="polite" hidden></div>
<script>window.ExpansaoDados = window.__demo;\n${jsAreas}\n${demo}\n</script>\n</body>`, true);

// Trava final: o arquivo gerado não pode citar o banco real da Engenharia nem o da Expansão.
for (const proibido of [/seu-projeto-engenharia/i, /seu-projeto-expansao/i, /sb_publishable/i, /\.supabase\.co/i, /functions\/v1/i, /unpkg\.com\/@supabase/i]){
  if (proibido.test(html)) throw Error('Sobrou referência ao banco real: ' + proibido);
}
// Login igual ao da Expansão (Gustavo, 16/11): mesma faixa azul, mesmo formulário (função compartilhada).
html = comCarregamentoHtml(comFavicon(comLoginPadrao(comSemSaudacao(html), { marca:'engenharia', mensagem:'Aprovações das notas da engenharia.' })));
const destino = join(AQUI, 'index.html');
writeFileSync(destino + '.tmp', html, 'utf8');
renameSync(destino + '.tmp', destino);
console.log('Cópia de Engenharia gerada:', destino, Math.round(html.length / 1024) + ' kB');
