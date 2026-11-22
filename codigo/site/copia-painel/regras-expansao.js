// Regras de apresentação compartilhadas pela interface e pelos testes.
(function(root){
  'use strict';
  const normalizar = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  // Busca por palavras (Gustavo, 14/11): "marcos teste" acha "MARCOS PRADO - TESTE"; cada palavra pode estar em qualquer parte e em qualquer ordem.
  const contem = (texto, busca) => { const alvo = normalizar(texto); return normalizar(busca).split(/\s+/).filter(Boolean).every(p => alvo.includes(p)); };
  const statusCompra = r => /^recusad/i.test(r.etapa) ? 'Recusados' : ['Aprovada', 'Aguardando fechamento', 'Aguardando entrega', 'Entrega concluída'].includes(r.etapa) ? 'Aprovados' : 'Pendentes';
  const podeVerReq = (p, r) => p.perfil !== 'engenharia' || (r.solicitanteEmail ? normalizar(r.solicitanteEmail) === normalizar(p.email) : normalizar(r.solicitante) === normalizar(p.nome));
  // Quem abriu a requisição aprova, pede ajuste ou recusa; administração também (Gustavo, 09/11).
  const podeDecidirReq = (p, r) => !!r && (p.perfil === 'admin' || (p.perfil === 'engenharia' && podeVerReq(p, r)));
  // 19/11/2026 (Camila): o código interno da nota (AUTO-…, M…) tem muitos números e fazia "501" achar centenas de notas: fica fora da busca.
  const idBuscavel = id => /^(AUTO-|M\d)/.test(String(id || '')) ? '' : (id || '');
  const texto = r => normalizar([idBuscavel(r.id),r.nf,r.pedido,r.nome,r.fornecedor,r.unidade,r.tipo,r.descricao,r.narrativa,...(r.itens || []).map(i=>i.descricao || i.nome || '')].join(' '));
  const dia = v => String(v || '').slice(0, 10);
  // Busca só com números (ex.: 501): NF, pedido ou código do fornecedor iguais (sem zeros à esquerda), ou parte do CNPJ (5 dígitos ou mais).
  const soDig = v => String(v ?? '').replace(/\D/g, '');
  const semZero = v => soDig(v).replace(/^0+(?=\d)/, '');
  const buscaNumerica = b => /^[\d.\-\/\s]+$/.test(String(b || '').trim());
  const bateNumero = (r, b) => { const n = semZero(b); if (!n) return false;
    if ([r.nf, r.pedido, r.cod_fornecedor, r.codigo_emitente].some(v => semZero(v) === n)) return true;
    return soDig(b).length >= 5 && soDig(r.cnpj_fornecedor).includes(soDig(b)); };
  const passaBusca = (r, b, compras) => !b || (!compras && buscaNumerica(b) ? bateNumero(r, b) : contem(texto(r), b));
  const filtrar = (r, f, compras) => passaBusca(r, f.busca, compras) && (!f.unidade || unidadeChave(r.unidade) === unidadeChave(f.unidade))
    && (!f.status || (compras ? statusCompra(r) : r.etapa) === f.status) && (!f.prioridade || r.prioridade === f.prioridade)
    && (!f.fornecedor || r.fornecedor === f.fornecedor) && (!f.natureza || r.natureza === f.natureza)
    && (!f.de || dia(r.emissao) >= f.de) && (!f.ate || (!!dia(r.emissao) && dia(r.emissao) <= f.ate))
    // 19/11/2026: período de vencimento e número do pedido (pedidos da Engenharia).
    && (!f.vde || dia(r.vencimento) >= f.vde) && (!f.vate || (!!dia(r.vencimento) && dia(r.vencimento) <= f.vate))
    && (!f.pedido || contem(String(r.pedido || ''), f.pedido));
  // Engenharia corrige narrativa e contrato até antes de escriturar (Gustavo, 09/11).
  const ETAPAS_CORRIGIVEIS = ['contrato','pedido','aprovacao','fora'];
  const podeCorrigirAnalise = (p, n) => !!n && ['engenharia','admin'].includes(p.perfil) && ETAPAS_CORRIGIVEIS.includes(n.etapa);
  // "Nota de / No cartão de": só engenheiros, enquanto a nota não foi para a escrituração.
  const podeEditarVinculo = n => !!n && ['engenharia', ...ETAPAS_CORRIGIVEIS].includes(n.etapa);
  // Cores das unidades = cores de status da coluna Unidade nos quadros Aprovações e Notas da Monday (mesmos hex nos dois).
  const CORES_UNIDADE = { '001':'#9aadbd', '002':'#007eb5', '003':'#401694', '004':'#c4c4c4', '005':'#fdab3d', '006':'#00c875', '007':'#df2f4a', '008':'#9d50dd', '009':'#037f4c', '010':'#579bfc', '011':'#cab641', '012':'#ffcb00', '013':'#333333', '014':'#bb3354', '015':'#ff007f', '017':'#784bd1', '018':'#9cd326', '019':'#66ccff', '020':'#ff6d3b', '099':'#757575' };
  const RESERVA = ['#4338ca','#9d174d','#b45309','#1d4ed8','#6d28d9','#0f766e','#92400e','#3730a3'];
  const corUnidade = u => CORES_UNIDADE[unidadeChave(u)] || RESERVA[[...normalizar(u)].reduce((s, c) => s + c.charCodeAt(0), 0) % RESERVA.length];
  // Unidades fixas (Gustavo, 10/11): só estas aparecem no filtro, sempre, na mesma ordem.
  const UNIDADES_FIXAS = [['001','SOROCABA'],['002','AMERICANA'],['003','ILHÉUS'],['004','CAMPINA GRANDE'],['005','LONDRINA'],['006','PELOTAS'],['007','ANÁPOLIS'],['008','CONTAGEM'],['009','NITERÓI'],['010','CASCAVEL'],['011','MARÍLIA'],['012','JOINVILLE'],['013','MONTES CLAROS'],['014','PALMAS'],['015','IPATINGA'],['017','BLUMENAU'],['018','MARINGÁ'],['019','PINHAL'],['020','ARARAQUARA'],['099','CORPORATIVO']];
  const codigoPorNome = new Map(UNIDADES_FIXAS.map(([c, n]) => [normalizar(n), c]));
  // "001" e "001 - SOROCABA" e "SOROCABA" são a mesma unidade.
  const unidadeChave = u => { const s = String(u ?? '').trim(); if (!s) return ''; const m = s.match(/^(\d{3})(?!\d)/); return m ? m[1] : (codigoPorNome.get(normalizar(s)) || normalizar(s)); };
  // Sempre "código - NOME" (ex.: "018 - MARINGÁ"), venha o dado só com o número, só com o nome ou completo.
  const nomeUnidade = u => { const s = String(u ?? '').trim(), cod = unidadeChave(s), fixa = UNIDADES_FIXAS.find(([c]) => c === cod); return fixa ? `${fixa[0]} - ${fixa[1]}` : (s || '—'); };
  const configurarUnidades = () => {};
  const opcoesUnidade = () => UNIDADES_FIXAS.map(([c, n]) => [c, c + ' - ' + n]);
  const api = { contem, unidadeChave, nomeUnidade, configurarUnidades, opcoesUnidade, normalizar, statusCompra, podeVerReq, podeDecidirReq, texto, filtrar, podeCorrigirAnalise, podeEditarVinculo, corUnidade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExpansaoRegras = api;
})(typeof window !== 'undefined' ? window : null);
