// Notas Fiscais: réplica local do quadro Monday 18407995628, na mesma base visual da Expansão.
// As abas são as visualizações do quadro. Dentro de cada uma, os grupos aparecem
// empilhados, cada um com a sua tabela, como no Monday. Nada aqui grava na Monday.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const TAG = 'TAG EXEMPLO FUNDO DE INVESTIMENTO IMOBILIARIO';
const TAG_PENDING = 'group_mm2c28pe';
const TAG_APPROVED = 'group_mm2ct5t8';
const TAG_AWAITING = 'group_mm332dfe';
const TAG_PAID = 'group_mm2daf7r';
const TAG_REJECTED = 'group_mm2np6s6';

// Visualizações: Otávio, Formulário e Notas TAG.
const VIEWS = [
  { key: 'otavio', label: 'Otávio - Aprovação', title: 'Otávio - Aprovação', desc: 'Notas da TAG ainda sem decisão do Otávio (coluna Aprovação Otávio em branco ou em análise).' },
  { key: 'formulario', label: 'Formulário', title: 'Formulário', desc: '' },
  { key: 'tag', label: 'Notas TAG', title: 'Notas TAG', desc: 'Notas da TAG aprovadas pelo Otávio, nos grupos de aprovadas, aguardando comprovante, pagas e reprovadas.' },
];
const VIEW_KEYS = VIEWS.map((v) => v.key);

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);
const pad2 = (n) => String(n).padStart(2, '0');

const S = {
  meta: null,
  actor: {canEdit:false,email:''}, token:null, auth:null, uploadUrl:null,
  rows: [],
  route: { name: 'board', view: 'otavio' },
  filters: { q: '', dept: '', cat: '', from: '', to: '', apFrom: '', apTo: '', sort: '' },   // sort vazio = padrão da tela
  fechados: {},
  presentation: (() => { try { return localStorage.getItem('notas.apresentacao') === 'cartoes' ? 'cartoes' : 'quadro'; } catch { return 'quadro'; } })(),
  form: null,
  formNotice: null,
  drawerId: null,
};

// Ícones de traço, no mesmo estilo dos da Expansão.
const ICONS = {
  voltar: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  documento: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  bolsa: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  bolt: '<path d="M13 2L3 14h7l-1 8 10-12h-7z"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grade: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
};
const icon = (name) => `<svg class="cx-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------- rede ----------
// TAG real (16/11/2026): a API exige login. Vale o token do "Entrar" desta tela ou, se houver, o da sessão aberta no painel de Engenharia
// (mesmo endereço do site, a TAG é aberta dentro dele): assim quem já entrou lá vê as notas sem digitar a senha de novo.
function tokenDoPainel() {
  try {
    const ref = S.auth?.url ? new URL(S.auth.url).hostname.split('.')[0] : '';
    if (!ref) return null;
    const s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
    if (!s?.access_token || (s.expires_at && s.expires_at * 1000 < Date.now() + 5000)) return null;
    return s.access_token;
  } catch { return null; }
}
// Renova a sessão guardada do painel (mesmo navegador, mesmo banco da Engenharia) quando o acesso vence.
async function garantirSessao() {
  try {
    const ref = S.auth?.url ? new URL(S.auth.url).hostname.split('.')[0] : '';
    if (!ref) return false;
    const chave = 'sb-' + ref + '-auth-token';
    const s = JSON.parse(localStorage.getItem(chave) || 'null');
    if (!s?.refresh_token) return false;
    if (s.access_token && s.expires_at && s.expires_at * 1000 > Date.now() + 60000) return true;
    const r = await fetch(S.auth.url + '/auth/v1/token?grant_type=refresh_token', { method:'POST', headers:{ apikey:S.auth.key, 'Content-Type':'application/json' }, body:JSON.stringify({ refresh_token:s.refresh_token }) });
    if (!r.ok) return false;
    localStorage.setItem(chave, JSON.stringify(await r.json()));
    return true;
  } catch { return false; }
}
const tokenAtual = () => S.token || tokenDoPainel();
// Links de arquivo não carregam cabeçalho: o token vai na própria URL (vale por 1 hora; o servidor confere do mesmo jeito).
const arq = (caminho) => { const k = tokenAtual(); return k ? caminho + '?t=' + encodeURIComponent(k) : caminho; };
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(tokenAtual() ? {Authorization:'Bearer '+tokenAtual()} : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.details = data.details;
    throw err;
  }
  return data;
}

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 4800);
}

async function refresh() {
  const [meta, items] = await Promise.all([api('/api/meta'), api('/api/items')]);
  // 18/11/2026: guarda uma assinatura; a atualização automática só redesenha a tela quando algo mudou (antes piscava a cada 15 s).
  const assinatura = JSON.stringify([meta.total, (items.items || []).map((r) => [r.id, r.updatedAt, r.groupId, r.otavio, r.status, r.filesCount, r.proofsCount])]);
  const mudou = assinatura !== S.assinatura;
  S.assinatura = assinatura;
  S.meta = meta;
  S.rows = items.items;
  return mudou;
}

const groupById = (id) => S.meta.groups.find((g) => g.id === id);
const depById = (id) => S.meta.catalog.departments.find((d) => d.id === id);
const rowById = (id) => S.rows.find((r) => r.id === id);

// ---------- rotas ----------
function parseRoute() {
  const [name] = location.hash.replace(/^#\/?/, '').split('/');
  if (name === 'historico') return { name: 'history' };
  if (name === 'controle') return { name: 'controle' };   // 19/11/2026: Controle de Lançamentos (producao/controle/controle.js)
  if (name === 'novo') return { name: 'board', view: 'formulario' };
  if (VIEW_KEYS.includes(name)) return { name: 'board', view: name };
  return { name: 'board', view: 'otavio' };
}

// ---------- menu lateral (cx-marca, cx-nav-links, cx-nav-pessoa) ----------
document.addEventListener('click', (ev) => {
  if (!ev.target.closest?.('[data-voltar-engenharia]')) return;
  try { window.parent.postMessage({ tipo: 'tag-voltar' }, location.origin); } catch { /* sem painel de fora */ }
});
function renderNav() {
  const r = S.route;
  const m = S.meta;
  const items = [
    { go: '#/otavio', label: 'Notas fiscais', ico: 'grade', count: m.total, active: r.name === 'board' },
    { go: '#/historico', label: 'Histórico', ico: 'relogio', active: r.name === 'history' },
    // 19/11/2026 (Gustavo): só Marina, Laura e Tatiana (login da Expansão) veem o Controle de Lançamentos.
    ...(window.Controle?.visivel?.(S.actor.email) ? [{ go: '#/controle', label: 'Controle de Lançamentos', ico: 'documento', active: r.name === 'controle' }] : []),
  ];
  $('#cxAbas').innerHTML = `
    <div class="cx-marca"><span class="cx-marca-simbolo" aria-hidden="true"><i></i><i></i><i></i></span><span>notas<small>ADMINISTRATIVO</small></span></div>
    ${window.self !== window.top ? `<div class="cx-nav-links cx-nav-voltar"><button type="button" data-voltar-engenharia title="Voltar para as outras abas da Engenharia">${icon('voltar')}<span>Voltar para a Engenharia</span></button><a href="/tag/" target="_blank" rel="noopener" class="cx-nav-nova-aba">Abrir em nova aba</a></div>` : ''}
    <div class="cx-nav-rotulo">ÁREA DE TRABALHO</div>
    <div class="cx-nav-links">
      ${items.map((it) => `<button role="tab" type="button" class="${it.active ? 'ativa' : ''}" data-go="${esc(it.go)}">${icon(it.ico)}<span>${esc(it.label)}</span>${it.count !== undefined ? `<span class="cx-num">${esc(it.count)}</span>` : ''}</button>`).join('')}
    </div>
    <div class="cx-nav-nota"><span class="cx-nav-traco"></span><p>Notas fiscais.<br>Um fluxo só.</p><small>Painel Notas TAG</small></div>
    <div class="cx-nav-pessoa"><span class="cx-avatar">${esc((S.actor.email || '?').trim().charAt(0).toUpperCase())}</span><div><b>${esc(S.actor.email || 'Consulta local')}</b><small>${S.actor.canEdit ? 'Edição liberada' : 'Somente leitura'}</small></div><span class="cx-presenca" title="Sessão ativa"></span></div>`;
}

// ---------- visualizações do quadro ----------
// Filtros replicados das visualizações do Monday:
// - Otávio - Aprovação: Pagador = TAG e Aprovação Otávio em branco (índice 5) ou "Em analise" (índice 0).
// - Notas TAG: Pagador = TAG, Aprovação Otávio = Aprovado e grupo em aprovadas, aguardando comprovante, pagas ou reprovadas.
function viewRows(view, rows = S.rows) {
  if (view === 'otavio') return rows.filter((r) => r.payer.includes(TAG) && (r.otavio === '' || r.otavio === 'Em analise'));
  if (view === 'tag') {
    const grupos = [TAG_APPROVED, TAG_AWAITING, TAG_PAID, TAG_REJECTED];
    return rows.filter((r) => r.payer.includes(TAG) && grupos.includes(r.groupId));   // 18/11/2026: grupo e decisão agora são sempre coerentes
  }
  return rows;
}

const maisRecente = (r) => [r.groupAt, r.otavioAt, r.createdAt].filter(Boolean).sort().pop() || '';
function boardRows(view) {
  let rows = viewRows(view).slice();
  const f = S.filters;
  if (f.q) {
    const q = norm(f.q);
    rows = rows.filter((r) => norm([r.nf, r.name, r.supplierName, r.supplierDoc, r.narrative, r.address.join(' '), r.department, r.category, r.payment, r.payer.join(' ')].join(' ')).includes(q));
  }
  if (f.dept) rows = rows.filter((r) => String(r.departmentId) === f.dept);
  if (f.cat) rows = rows.filter((r) => r.category === f.cat);
  if (f.from) rows = rows.filter((r) => r.issueDate && r.issueDate >= f.from);
  if (f.to) rows = rows.filter((r) => r.issueDate && r.issueDate <= f.to);
  // 18/11/2026: data da decisão do Otávio (dia local), para achar "aprovadas hoje".
  const diaAprov = (r) => r.otavioAt ? new Date(r.otavioAt).toLocaleDateString('sv-SE') : '';
  if (f.apFrom) rows = rows.filter((r) => diaAprov(r) && diaAprov(r) >= f.apFrom);
  if (f.apTo) rows = rows.filter((r) => diaAprov(r) && diaAprov(r) <= f.apTo);
  const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  const sorters = {
    due: byDue,
    issue: (a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''),
    value: (a, b) => (b.value || 0) - (a.value || 0),
    // Mais recente = a última vez que a nota chegou ou foi movimentada (entrou no quadro, mudou de grupo ou teve decisão do Otávio).
    recent: (a, b) => maisRecente(b).localeCompare(maisRecente(a)),
  };
  // 18/11/2026 (Gustavo): em todas as abas, o que chegou ou foi movimentado por último fica em cima (padrão).
  rows.sort(sorters[f.sort || 'recent'] || sorters.recent);
  return rows;
}

// Abas no topo, com as visualizações do quadro.
function tabsRow(view) {
  const counts = { otavio: viewRows('otavio').length, principal: S.rows.length, tag: viewRows('tag').length };
  return `<nav class="notas-abas" aria-label="Visualizações do quadro">
    ${VIEWS.filter((v) => !S.actor?.soNotasTag || v.key === 'tag').map((v, i) => `<button type="button" class="${v.key === view ? 'active' : ''}" data-view="${v.key}"><span class="idx">${pad2(i + 1)}</span>${esc(v.label)}${v.key in counts ? `<span class="cnt">${counts[v.key]}</span>` : ''}</button>`).join('')}
  </nav>`;
}

function kpisHtml() {
  const kpi = (n, l, s) => `<div class="notas-kpi"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div><div class="s">${esc(s)}</div></div>`;
  const otavioOpen = viewRows('otavio').length;
  return `<section class="cx-editorial" aria-label="Resumo">
    <div class="notas-kpis">
      ${kpi(S.meta.total, 'notas no quadro', `${S.meta.groups.length} grupos · Holding, Empresa Exemplo e TAG`)}
      ${kpi(groupById(TAG_PENDING)?.count ?? 0, 'aguardando aprovação da TAG', `${otavioOpen} sem decisão do Otávio`)}
      ${kpi(groupById(TAG_PAID)?.count ?? 0, 'pagas pela TAG', `${groupById(TAG_AWAITING)?.count ?? 0} aguardando comprovante · ${groupById(TAG_APPROVED)?.count ?? 0} aprovadas`)}
    </div>
  </section>
  <hr class="notas-linha">`;
}

function renderBoardView(view) {
  if (S.actor?.soNotasTag && view !== 'tag') { view = 'tag'; S.route = { name: 'board', view: 'tag' }; }   // 18/11/2026: BO vê só Notas TAG
  if (view === 'formulario') {
    $('#cxArea').innerHTML = tabsRow(view) + formPanelHtml();
    applyPermissions();
    return;
  }
  const info = VIEWS.find((v) => v.key === view);
  $('#cxArea').innerHTML = `${kpisHtml()}
    ${tabsRow(view)}
    <section class="notas-painel" aria-label="${esc(info.title)}">
      <div class="notas-painel-cabeca">
        <div>
          <h1>${esc(info.title)}</h1>
          <p>${esc(info.desc)}</p>
        </div>
        <button type="button" class="cx-btn notas-btn" id="incluir-manual" title="Abrir o formulário para lançar uma nota à mão">＋ Incluir nota manualmente</button>
        <button type="button" class="cx-btn" id="exportar-excel" title="Baixar em Excel as notas desta visualização, com os filtros aplicados">Exportar Excel</button>
        <div class="cx-visoes" role="group" aria-label="Apresentação das notas"><button type="button" data-presentation="quadro" aria-pressed="${S.presentation === 'quadro'}">Quadro</button><button type="button" data-presentation="cartoes" aria-pressed="${S.presentation === 'cartoes'}">Cartões</button></div>
        <div class="notas-total"><div class="v" id="board-total"></div><div class="l">valor nesta visualização</div></div>
      </div>
      <div class="notas-ferr">
        <label class="cx-pesquisa">${icon('busca')}<input class="cx-busca" id="q" type="search" placeholder="Buscar por NF, fornecedor, endereço ou narrativa…" value="${esc(S.filters.q)}" autocomplete="off"></label>
        <span class="cx-contagem" id="board-count"></span>
        <select class="cx-cel" id="sort" style="width:auto;min-width:210px" aria-label="Ordenar">
          <option value="" ${!S.filters.sort ? 'selected' : ''}>Mais recentes em cima (padrão)</option>
          <option value="due" ${S.filters.sort === 'due' ? 'selected' : ''}>Vencimento mais próximo</option>
          <option value="issue" ${S.filters.sort === 'issue' ? 'selected' : ''}>Emissão mais recente</option>
          <option value="value" ${S.filters.sort === 'value' ? 'selected' : ''}>Maior valor</option>
        </select>
      </div>
      <div class="cx-filtros">
        <label>Departamento / empresa
          <select id="dept"><option value="">Todos os departamentos</option>
            ${S.meta.catalog.departments.map((d) => `<option value="${d.id}" ${S.filters.dept === String(d.id) ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}
          </select></label>
        <label>Categoria
          <select id="cat"><option value="">Todas as categorias</option>
            ${S.meta.catalog.categories.map((c) => `<option ${S.filters.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select></label>
        <label>Emissão de<input type="date" id="from" value="${esc(S.filters.from)}"></label>
        <label>Emissão até<input type="date" id="to" value="${esc(S.filters.to)}"></label>
        <label>Aprovação de<input type="date" id="apFrom" value="${esc(S.filters.apFrom)}"></label>
        <label>Aprovação até<input type="date" id="apTo" value="${esc(S.filters.apTo)}"></label>
        <button class="cx-btn cx-mini" id="clear" type="button">Limpar filtros</button>
      </div>
      <div id="board-notice"></div>
      <div class="notas-secoes" id="board-table"></div>
    </section>`;
  updateBoardDynamic();
}

// Atualiza só a parte que muda com filtros, para não perder o foco da busca.
function updateBoardDynamic() {
  const view = S.route.view;
  if (view === 'formulario') return;
  const rows = boardRows(view);
  const total = rows.reduce((s, r) => s + (r.value || 0), 0);
  $('#board-total').textContent = BRL.format(total);
  $('#board-count').textContent = `${rows.length} ${rows.length === 1 ? 'nota' : 'notas'}`;
  const divergent = rows.filter((r) => (r.groupId === TAG_PENDING && r.otavio === 'Reprovado') || (r.groupId === TAG_REJECTED && r.otavio === 'Aprovado')).length;
  $('#board-notice').innerHTML = divergent
    ? `<div class="notas-nota">${divergent} nota(s) têm decisão do Otávio diferente do grupo onde estão. Como na Monday, a tela não move a nota sozinha: corrija a decisão ou o grupo.</div>`
    : '';
  $('#board-table').innerHTML = gruposHtml(rows, view);
  applyPermissions();
}

// Exportar Excel (17/11/2026): as notas da visualização atual, com busca e filtros aplicados.
function exportarExcel() {
  if (!window.XLSX) { toast('O Excel ainda está carregando. Tente de novo em alguns segundos.', true); return; }
  const view = S.route.view, rows = boardRows(view);
  if (!rows.length) { toast('Nenhuma nota para exportar nesta visualização.', true); return; }
  const br = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
  const linhas = rows.map((r) => ({
    'NF': r.nf || '', 'Fornecedor': r.supplierName || '', 'CNPJ / CPF': r.supplierDoc || '', 'Departamento': r.department || '',
    'Endereço': (r.address || []).join('; '), 'Narrativa': r.narrative || '', 'Categoria': r.category || '', 'Pagamento': r.payment || '',
    'Valor': Number(r.value || 0), 'Emissão': br(r.issueDate), 'Vencimento': br(r.dueDate), 'Grupo': r.group || '',
    'Aprovação Otávio': r.otavio || '', 'Status': r.status || '', 'Pagador': (r.payer || []).join('; '),
  }));
  const ws = XLSX.utils.json_to_sheet(linhas), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notas TAG');
  XLSX.writeFile(wb, `notas-tag-${String(view || 'todas').replace(/[^\w-]/g, '')}-${new Date().toLocaleDateString('sv-SE')}.xlsx`);
  toast(`Exportadas ${linhas.length} notas.`);
}

// Grupos empilhados: cada um com cabeçalho recolhível e a sua tabela.
// No Quadro principal aparecem todos os grupos do quadro. Nas demais visualizações, só os grupos com notas.
function gruposHtml(rows, view) {
  const porGrupo = Object.fromEntries(S.meta.groups.map((g) => [g.id, []]));
  for (const r of rows) if (porGrupo[r.groupId]) porGrupo[r.groupId].push(r);
  const grupos = S.meta.groups.filter((g) => view === 'principal' || porGrupo[g.id].length);
  if (!grupos.length) {
    return `<div class="notas-vazio"><b>Nenhuma nota nesta visualização</b>Ajuste os filtros ou escolha outra aba.</div>`;
  }
  return grupos.map((g) => {
    const lista = porGrupo[g.id];
    const chave = `${view}:${g.id}`;
    const fechado = !!S.fechados[chave];
    const soma = lista.reduce((s, r) => s + (r.value || 0), 0);
    return `<section class="notas-grupo ${fechado ? 'fechado' : ''}" data-grupo="${esc(g.id)}">
      <div class="notas-grupo-linha">
      <button type="button" class="notas-grupo-cabeca" data-toggle="${esc(chave)}" aria-expanded="${!fechado}">
        <span class="seta" aria-hidden="true">${fechado ? '▸' : '▾'}</span>
        <h3>${esc(g.title)}</h3>
        <span class="cnt">${lista.length}</span>
        <span class="valor">${BRL.format(soma)}</span>
      </button>
      ${view === 'tag' && lista.length ? `<button type="button" class="cx-btn cx-mini notas-zip" data-zip-grupo="${esc(g.id)}" title="Baixa em um ZIP os arquivos das notas deste grupo (uma pasta por nota). Respeita a busca e os filtros da tela."${S.zip && S.zip.grupo === g.id ? ' disabled' : ''}>${esc(textoZip(g.id, ROTULO_ZIP))}</button>` : ''}
      </div>
      ${fechado ? '' : (lista.length ? (S.presentation === 'cartoes' ? cartoesHtml(lista) : tableHtml(lista)) : '<div class="notas-grupo-vazio">Nenhum item neste grupo.</div>')}
    </section>`;
  }).join('');
}

// Colunas com a mesma largura em todos os grupos, para as tabelas ficarem alinhadas.
const COLUNAS = [230, 130, 180, 200, 240, 150, 130, 120, 170, 170, 120, 110];

function tableHtml(rows) {
  const today = todayIso();
  const body = rows.map((r) => {
    const dep = depById(r.departmentId);
    const overdue = r.dueDate && r.dueDate < today && r.groupId !== TAG_PAID;
    const addr = r.address.join('; ');
    return `<tr class="linha" data-id="${esc(r.id)}">
      <td><div class="notas-nf"><strong>${esc(r.nf ? `NF ${r.nf}` : r.name || 'Sem número')}</strong><small>${esc(r.supplierName || 'Fornecedor não informado')}</small></div></td>
      <td class="notas-valor num">${r.value == null ? '—' : BRL.format(r.value)}</td>
      <td><span class="notas-dep"><i style="background:${esc(dep?.hex || '#777')}"></i>${esc(r.department || '—')}</span></td>
      <td class="notas-clip" title="${esc(addr)}">${esc(addr || '—')}</td>
      <td class="notas-clip" title="${esc(r.narrative)}">${esc(r.narrative || '—')}</td>
      <td>${esc(r.category || '—')}</td>
      <td>${esc(r.payment || '—')}</td>
      <td class="notas-venc ${overdue ? 'vencida' : ''}">${fmtDate(r.dueDate)}${overdue ? '<small>vencida</small>' : ''}</td>
      <td><select class="notas-sel" data-role="otavio" data-id="${esc(r.id)}" data-v="${esc(r.otavio)}" aria-label="Aprovação Otávio">${otavioOptions(r.otavio)}</select></td>
      <td><select class="notas-sel" data-role="status" data-id="${esc(r.id)}" data-v="${esc(r.status)}" aria-label="Status">${selectOptions(S.meta.catalog.paymentStatus, r.status)}</select></td>
      <td class="notas-docs">${r.filesCount} NF · ${r.proofsCount} comp.${r.preview ? `<div class="notas-mini-tabela" data-abrir-pdf="${esc(r.id)}" title="Clique para abrir o PDF">${visorHtml(arq('/files/' + encodeURIComponent(r.id) + '/' + encodeURIComponent(r.preview.id)), true)}</div>` : '<small class="notas-faint">Sem PDF</small>'}</td>
      <td class="notas-venc">${fmtDate(r.issueDate)}</td>
    </tr>`;
  }).join('');
  return `<div class="notas-tabela cx-quadro-rolagem"><table class="cx-quadro">
    <colgroup>${COLUNAS.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>
    <thead><tr>
      <th>Nota / fornecedor</th><th class="num">Valor</th><th>Departamento</th><th>Endereço</th><th>Narrativa</th><th>Categoria</th><th>Pagamento</th>
      <th>Vencimento</th><th>Aprovação Otávio</th><th>Status</th><th>Documentos</th><th>Emissão</th>
    </tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

// 18/11/2026: com a prévia do PDF aberta, desenhar 600 cartões de uma vez travava a tela. Mostra 24 por grupo e um botão para ver mais.
function cartoesHtml(rowsTodos) {
  const limite = S.cartoesLimite || 24, rows = rowsTodos.slice(0, limite), resto = rowsTodos.length - rows.length;
  return '<div class="notas-cartoes">' + rows.map(r => `<article class="notas-cartao" data-id="${esc(r.id)}">
    <div class="cx-ficha-topo"><span>NF ${esc(r.nf || '—')}</span><span>${esc(r.group)}</span></div>
    <h3>${esc(r.supplierName || r.name || 'Fornecedor não informado')}</h3>
    <p class="notas-faint">${esc(r.department || '—')} · ${esc(r.address.join(', ') || '—')}</p>
    <dl class="cx-ficha-dados"><div><dt>Valor</dt><dd>${r.value == null ? '—' : BRL.format(r.value)}</dd></div><div><dt>Vencimento</dt><dd>${fmtDate(r.dueDate)}</dd></div><div><dt>Emissão</dt><dd>${fmtDate(r.issueDate)}</dd></div><div><dt>Categoria</dt><dd>${esc(r.category || '—')}</dd></div></dl>
    <p class="notas-cartao-narrativa">${esc(r.narrative || 'Sem narrativa')}</p><p class="notas-faint">Pagamento: ${esc(r.payment || '—')}</p>
    <label class="notas-decisao"><span>Narrativa da decisão <small>escreva antes de aprovar ou reprovar</small></span><textarea data-role="approverNotes" data-id="${esc(r.id)}" rows="3" placeholder="Por que esta nota foi aprovada ou reprovada?">${esc(r.approverNotes || '')}</textarea></label>
    <div class="notas-cartao-campos"><label>Aprovação Otávio<select class="notas-sel" data-role="otavio" data-id="${esc(r.id)}" data-v="${esc(r.otavio)}" aria-label="Aprovação Otávio da NF ${esc(r.nf)}">${otavioOptions(r.otavio)}</select></label><label>Status<select class="notas-sel" data-role="status" data-id="${esc(r.id)}" data-v="${esc(r.status)}" aria-label="Status da NF ${esc(r.nf)}">${selectOptions(S.meta.catalog.paymentStatus,r.status)}</select></label></div>
    ${previewHtml(r)}<footer><span>${r.filesCount} NF · ${r.proofsCount} comp.</span><button type="button" class="cx-btn notas-btn sec peq" data-open-note="${esc(r.id)}">Abrir nota</button></footer></article>`).join('') + '</div>' + (resto > 0 ? `<p style="text-align:center;margin:12px 0"><button type="button" class="cx-btn notas-btn sec" data-mais-cartoes>Mostrar mais ${Math.min(resto, 48)} de ${resto}</button></p>` : '');
}

// Visor de PDF igual ao da Expansão (14/11/2026): o leitor do navegador abria pequeno, com cinza em volta.
// Aqui cada página é desenhada (pdf.js) na largura toda do espaço, com − / Ajustar / +. Qualquer .notas-visor que
// aparecer na tela é desenhado sozinho; data-paginas="1" faz a miniatura só da primeira página.
let leitorPdf = null;
function carregarLeitorPdf(){
  if (leitorPdf) return leitorPdf;
  const script = src => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Leitor de PDF indisponível.')); document.head.appendChild(s); });
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  // 18/11/2026: o leitor roda em segundo plano (worker de verdade). Antes o worker era carregado como script comum e o PDF era
  // processado na mesma linha da tela, congelando a página a cada PDF desenhado.
  leitorPdf = script(base + 'pdf.min.js').then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; }).catch(e => { leitorPdf = null; throw e; });
  return leitorPdf;
}
const pdfsAbertos = new Map();
// 19/11/2026 (BO): a aba Notas TAG tem mais de 600 notas com PDF; guardar todos os PDFs abertos enchia a memória e deixava a tela lenta.
function abrirPdf(url){
  let p = pdfsAbertos.get(url);
  if (p) { pdfsAbertos.delete(url); pdfsAbertos.set(url, p); return p; }   // o mais usado fica por último (não sai)
  p = window.pdfjsLib.getDocument({ url, isEvalSupported:false }).promise.catch(e => { pdfsAbertos.delete(url); throw e; });
  pdfsAbertos.set(url, p);
  while (pdfsAbertos.size > 40) { const [velho, prom] = pdfsAbertos.entries().next().value; pdfsAbertos.delete(velho); prom.then(d => d.destroy()).catch(() => null); }
  return p;
}
async function desenharVisor(el){
  const vez = el._vez = (el._vez || 0) + 1, url = el.dataset.pdf, zoom = Number(el.dataset.zoom || 1), max = Number(el.dataset.paginas || 30);
  const paginas = el.querySelector('.notas-visor-paginas');
  try {
    await carregarLeitorPdf();
    const pdf = await abrirPdf(url);
    const largura = Math.min(3600, Math.max(300, (paginas.clientWidth - 8) * (window.devicePixelRatio || 1) * zoom));
    const destino = document.createDocumentFragment();
    for (let n = 1; n <= Math.min(pdf.numPages, max); n++){
      const pagina = await pdf.getPage(n), base = pagina.getViewport({ scale:1 }), vista = pagina.getViewport({ scale:largura / base.width });
      const c = document.createElement('canvas'); c.width = Math.floor(vista.width); c.height = Math.floor(vista.height);
      await pagina.render({ canvasContext:c.getContext('2d'), viewport:vista }).promise;
      if (el._vez !== vez || !el.isConnected) return;
      c.style.cssText = `width:${zoom * 100}%;max-width:none;height:auto;display:block;margin:0 auto 12px;background:#fff`;
      destino.appendChild(c);
    }
    paginas.replaceChildren(destino);
    if (pdf.numPages > max && max > 1) paginas.insertAdjacentHTML('beforeend', '<p class="notas-faint">Mostrando as 30 primeiras páginas.</p>');
  } catch (e) {
    if (el._vez === vez) paginas.innerHTML = '<p class="notas-faint">Não foi possível mostrar o PDF aqui. Use “Abrir PDF em outra aba”.</p>';
  }
}
function visorHtml(url, mini = false){
  return `<div class="notas-visor${mini ? ' notas-visor-mini' : ''}" data-pdf="${esc(url)}"${mini ? ' data-paginas="1"' : ''}>${mini ? '' : '<div class="notas-visor-zoom"><button type="button" class="cx-btn cx-mini" data-visor-zoom="menos" aria-label="Diminuir o PDF">−</button><button type="button" class="cx-btn cx-mini" data-visor-zoom="ajustar">Ajustar</button><button type="button" class="cx-btn cx-mini" data-visor-zoom="mais" aria-label="Aumentar o PDF">+</button></div>'}<div class="notas-visor-paginas"><p class="notas-faint">Carregando o PDF…</p></div></div>`;
}
// Prévias pequenas: uma de cada vez, só as que aparecem na tela (18/11/2026).
let filaVisor = Promise.resolve();
// 19/11/2026 (BO): a nota aberta esperava na fila atrás das miniaturas de tudo o que já tinha passado pela tela.
// Agora a fila pausa enquanto a nota está aberta e pula a miniatura que saiu da tela (ela volta para a fila quando reaparecer).
const pertoDaTela = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > -400 && r.top < innerHeight + 400; };
const desenharNaFila = (el) => { filaVisor = filaVisor.then(async () => {
  while (S.drawerId && el.isConnected) await new Promise(ok => setTimeout(ok, 400));
  if (!el.isConnected) return null;
  if (!pertoDaTela(el)) { if (visorVisivel) visorVisivel.observe(el); return null; }
  return desenharVisor(el);
}).catch(() => null); };
const visorVisivel = ('IntersectionObserver' in window) ? new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { visorVisivel.unobserve(e.target); desenharNaFila(e.target); } }), { rootMargin: '150px' }) : null;   // 18/11/2026: só os PDFs à vista
new MutationObserver(() => document.querySelectorAll('.notas-visor[data-pdf]:not([data-desenhado])').forEach(el => { el.dataset.desenhado = '1'; if (visorVisivel && el.classList.contains('notas-visor-mini')) visorVisivel.observe(el); else desenharVisor(el); }))
  .observe(document.body, { childList:true, subtree:true });
// Redesenha o PDF quando a área muda de largura (gaveta ajustada, tela redimensionada): o PDF acompanha o espaço, como nos painéis (16/11/2026).
const redesenharVisor = new ResizeObserver(entradas => {
  for (const e of entradas) {
    const p = e.target, larg = Math.round(e.contentRect.width), v = p.closest('.notas-visor[data-pdf]');
    if (!v || !v.dataset.desenhado || Math.abs(larg - (p._larg || 0)) < 8) continue;
    p._larg = larg; clearTimeout(p._rt);
    p._rt = setTimeout(() => desenharVisor(v), 200);
  }
});
new MutationObserver(() => document.querySelectorAll('.notas-visor-paginas:not([data-rz])').forEach(p => { p.dataset.rz = '1'; p._larg = Math.round(p.clientWidth); redesenharVisor.observe(p); }))
  .observe(document.body, { childList:true, subtree:true });
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-visor-zoom]'); if (!b) return;
  const el = b.closest('.notas-visor'), z = Number(el.dataset.zoom || 1), acao = b.dataset.visorZoom;
  el.dataset.zoom = acao === 'ajustar' ? 1 : Math.min(3, Math.max(0.6, z * (acao === 'mais' ? 1.25 : 0.8)));
  desenharVisor(el);
});
let larguraAnterior = innerWidth;
addEventListener('resize', () => { if (Math.abs(innerWidth - larguraAnterior) < 40) return; larguraAnterior = innerWidth; document.querySelectorAll('.notas-visor[data-desenhado]').forEach(desenharVisor); });

function pagadorSuspensa(lista, marcados, id) {
  const escolhidos = lista.filter((p) => (marcados || []).includes(p));
  const opcoes = lista.map((p) => `<label><input type="checkbox" name="payer" value="${esc(p)}" ${escolhidos.includes(p) ? 'checked' : ''}>${esc(p)}</label>`).join('');
  return `<details class="notas-suspensa"${id ? ` id="${id}"` : ''}><summary>${escolhidos.length ? esc(escolhidos.join(', ')) : 'Escolher pagador'}</summary><div class="notas-suspensa-opcoes">${opcoes}</div></details>`;
}
function abrirPdfHtml(r) {
  if (!r.preview) return '<small class="notas-faint">Sem PDF</small>';
  return `<button type="button" class="cx-btn notas-btn sec peq" data-abrir-pdf="${esc(r.id)}">Abrir PDF</button>`;
}
function previewHtml(r) {
 if (!r.preview) return '<small class="notas-faint">Sem PDF local para prévia</small>';
 return `<div class="notas-previa"><div class="notas-mini-pdf">${visorHtml(arq('/files/'+encodeURIComponent(r.id)+'/'+encodeURIComponent(r.preview.id)),true)}<button type="button" data-open-note="${esc(r.id)}" class="notas-expandir" aria-label="Expandir PDF e preencher nota">Expandir e preencher</button></div></div>`;   // 18/11/2026: prévia já aberta
}
function pdfPanel(files,id) {
 const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)&&f.local);
 const href=f=>arq('/files/'+encodeURIComponent(id)+'/'+encodeURIComponent(f.id));
 if(!pdfs.length) return '<section class="notas-pdf-lateral" aria-label="PDF ao lado do preenchimento"><p>Sem PDF local para prévia. Consulte os links em Arquivos.</p></section>';
 const lista=pdfs.map(f=>({n:f.name,h:href(f)}));
 // Mesmo cabeçalho e barra do visor da Engenharia: nome do arquivo, ‹ 1 de N ›, Baixar.
 return `<section class="notas-pdf-lateral" aria-label="PDF ao lado do preenchimento" data-pdfs="${esc(JSON.stringify(lista))}" data-atual="0"><header class="notas-gav-topo"><div><b id="pdf-nome">${esc(pdfs[0].name)}</b><small>Documentos da nota</small></div></header><div class="notas-gav-barra">${pdfs.length>1 ? `<button type="button" class="cx-btn cx-mini" data-pdf-nav="-1" aria-label="Arquivo anterior">‹</button><span id="pdf-contagem" class="notas-faint">1 de ${pdfs.length}</span><button type="button" class="cx-btn cx-mini" data-pdf-nav="1" aria-label="Próximo arquivo">›</button>` : ''}<span style="flex:1"></span><a id="pdf-external" class="cx-btn cx-mini" href="${esc(href(pdfs[0]))}" download>Baixar</a></div>${visorHtml(href(pdfs[0]))}</section>`;
}
function applyPermissions() {
 document.querySelectorAll('[data-role],#note-form input,#note-form select,#note-form textarea,#note-form button,.notas-edicao input,.notas-edicao select,.notas-edicao textarea,.notas-edicao button').forEach(el=>{el.disabled=!S.actor.canEdit;});
 // 18/11/2026: a decisão (Aprovação Otávio e narrativa) é só do Otávio; para os demais aparece travada.
 document.querySelectorAll('[data-role="otavio"],[data-role="approverNotes"]').forEach(el=>{ if(!S.actor.canDecide){ el.disabled=true; el.title='Só o Otávio decide a aprovação'; } });
 // 19/11/2026 (Gustavo): aprovada uma vez, a Aprovação Otávio fica travada para a TAG (inclusive o Otávio); sobra só o Status. O administrador destrava.
 document.querySelectorAll('[data-role="otavio"]').forEach(el=>{ if(el.dataset.v==='Aprovado'&&!S.actor.canUnlock){ el.disabled=true; el.title='Nota aprovada: a decisão está travada. Só o Status pode ser alterado.'; } });
 if(S.actor.soNotasTag) document.querySelectorAll('#incluir-manual').forEach(el=>{ el.hidden=true; });
}
function renderSession() {
 $('#notasAcesso').innerHTML=(S.token||S.actor.canEdit) ? `<span>${esc(S.actor.email)} · ${S.actor.canEdit?'Edição':'Somente leitura'}</span>${(S.token||(tokenAtual()&&window.top===window.self))?'<button class="cx-btn cx-mini" id="logout">Sair</button>':''}` : `${S.actor.email?`<span>${esc(S.actor.email)} · Somente leitura</span>`:''}<button type="button" class="cx-btn" id="abrir-login">${S.actor.email?'Entrar para editar':'Entrar'}</button><dialog id="janela-login" aria-labelledby="login-titulo"><button type="button" id="fechar-login" aria-label="Fechar janela">×</button><aside class="login-lateral"><div class="cx-entrada-marca">administrativo <small>EMPRESA EXEMPLO</small></div><div class="cx-entrada-mensagem"><span>UM NOVO ESPAÇO DE TRABALHO</span><h1>Do primeiro<br> documento<br> ao próximo<br> <em>passo.</em></h1><p>Notas fiscais da TAG: aprovação, pagamento e comprovantes.</p></div><small>EMPRESA EXEMPLO · ADMINISTRATIVO</small></aside><section class="login-conteudo"><span class="login-selo">EMPRESA EXEMPLO</span><h2 id="login-titulo">Entrar no painel.</h2><p>Use seu e-mail e sua senha.</p><form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="cx-btn notas-btn" type="submit">Entrar no Sistema</button><button class="cx-btn cx-mini" type="button" id="primeiro-acesso">Primeiro acesso ou esqueci minha senha</button><small>Só as duas contas autorizadas da TAG editam; os demais consultam. No primeiro acesso, digite o e-mail acima e clique no botão: chega um link para criar sua senha.</small></form></section></dialog>`;
 const janela = $('#janela-login');
 if (janela) {
  if ($('#abrir-login')) $('#abrir-login').onclick = () => janela.showModal();   // 18/11: só existe quando a pessoa não está logada
  if ($('#fechar-login')) $('#fechar-login').onclick = () => janela.close();
 }
}

// 18/11/2026 (Gustavo): Aprovação Otávio com sinal visual. O valor gravado continua o mesmo (sem emoji).
const OTAVIO_EMOJI = { 'Aprovado': '✅ Aprovado', 'Reprovado': '❌ Reprovado', 'Em analise': '⏳ Em análise' };
function otavioOptions(current) {
  const trava = current === 'Aprovado' && !S.actor?.canUnlock;   // 19/11/2026: aprovada = travada
  return ['', ...S.meta.catalog.otavio].map((v) => `<option value="${esc(v)}" ${v === (current || '') ? 'selected' : ''}>${esc((trava && v === 'Aprovado' ? '🔒 Aprovado' : OTAVIO_EMOJI[v]) || v || '—')}</option>`).join('');
}
function selectOptions(list, current) {
  return ['', ...list].map((v) => `<option value="${esc(v)}" ${v === (current || '') ? 'selected' : ''}>${esc(v || '—')}</option>`).join('');
}

// Re-renderiza a visualização atual (sem mexer no formulário).
function refreshBoard() {
  if (S.route.name !== 'board' || S.route.view === 'formulario') return;
  const y = window.scrollY, area = $('#cxArea'), h = area ? area.offsetHeight : 0;
  if (area) area.style.minHeight = h + 'px';   // 18/11/2026: sem salto de altura (piscada) durante o redesenho
  renderBoardView(S.route.view);
  window.scrollTo(0, y);
  if (area) requestAnimationFrame(() => { area.style.minHeight = ''; });
}

// Mudança de coluna pela tabela ou pela gaveta: dispara as automações no servidor.
async function setColumn(id, column, value, el) {
  const before = rowById(id);
  try {
    const res = await api(`/api/items/${encodeURIComponent(id)}/set`, { method: 'POST', body: { column, value } });
    await refresh();
    const after = rowById(id);
    const colLabel = column === 'otavio' ? 'Aprovação Otávio' : 'Status';
    let msg = `${colLabel}: ${value || 'limpo'}`;
    if (before && after && before.group !== after.group) msg += ` · automação moveu para "${after.group}"`;
    toast(msg);
    refreshBoard();
    if (S.route.name !== 'board') render();
    return res;
  } catch (err) {
    if (el) el.value = el.dataset.v || '';
    toast(err.message, true);
  }
}

// ---------- gaveta de detalhe ----------
async function openDrawer(id) {
  S.drawerId = id;
  // 19/11/2026: a gaveta aparece no clique; antes a tela ficava parada até o servidor responder.
  const r = rowById(id);
  $('#drawer-root').innerHTML = `<div class="notas-veu" data-close></div><aside class="notas-gaveta" role="dialog" aria-label="Detalhe da nota"><div class="notas-gaveta-topo"><div><h2>${esc(r?.nf ? 'NF ' + r.nf : (r?.name || 'Nota'))}</h2><div class="sub">${esc(r?.supplierName || '')}</div></div><button class="cx-btn cx-mini" type="button" data-close>Fechar</button></div><p class="notas-faint" style="padding:24px">Abrindo a nota…</p></aside>`;
  await drawerRender();
}

function closeDrawer() {
  S.drawerId = null;
  $('#drawer-root').innerHTML = '';
}

async function drawerRender() {
  if (!S.drawerId) return;
  const pedido = S.drawerId;
  let data;
  try {
    data = await api(`/api/items/${encodeURIComponent(pedido)}`);
  } catch (err) {
    if (S.drawerId !== pedido) return;
    toast(err.message, true);
    closeDrawer();
    return;
  }
  if (S.drawerId !== pedido) return;   // a pessoa já fechou ou abriu outra nota
  const it = data.item;
  const blankOpt = (empty) => `<option value="" ${empty ? 'selected' : ''}>—</option>`;
  const depOpts = blankOpt(it.departmentId == null) + S.meta.catalog.departments.map((d) => `<option value="${d.id}" ${d.id === it.departmentId ? 'selected' : ''}>${esc(d.label)}</option>`).join('');
  const catOpts = blankOpt(!it.category) + S.meta.catalog.categories.map((c) => `<option ${c === it.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const payOpts = blankOpt(it.paymentId == null) + S.meta.catalog.payments.map((p) => `<option value="${p.id}" ${p.id === it.paymentId ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const payerChecks = pagadorSuspensa(S.meta.catalog.payers, it.payer, '');
  const dues = it.dues.map((d, i) => `<label class="cx-campo"${i >= 3 ? ' hidden' : ''}><span>Vencimento ${pad2(i + 1)}</span><input type="date" name="due" value="${esc(d || '')}"${i >= 3 ? ' hidden' : ''}></label>`).join('');
  const fileLink = (f, scope) => {
    const href = f.local ? arq(`/files/${encodeURIComponent(it.id)}/${encodeURIComponent(f.id)}`) : f.url;
    return `<div class="notas-arq"><span title="${esc(f.name)}">${esc(f.name)}</span>
      <span style="display:flex;gap:8px;flex:0 0 auto">
        ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">abrir</a>` : ''}
        ${scope === 'proofs' ? `<button class="cx-btn notas-btn perigo peq" type="button" data-remove-proof="${esc(f.id)}">remover</button>` : `<button class="cx-btn notas-btn perigo peq" type="button" data-remove-file="${esc(f.id)}">remover</button>`}
      </span></div>`;
  };
  const files = it.files.length ? it.files.map((f) => fileLink(f, 'files')).join('') : '<span class="notas-faint">Nenhuma nota anexada.</span>';
  const proofs = it.proofs.length ? it.proofs.map((f) => fileLink(f, 'proofs')).join('') : '<span class="notas-faint">Nenhum comprovante anexado.</span>';
  const history = data.events.length
    ? `<ul class="notas-hist">${data.events.map((e) => { const [t, d] = evLabel(e); return `<li><div class="t">${esc(new Date(e.at).toLocaleString('pt-BR'))} · ${esc(e.actor)}</div><div><b>${esc(t)}</b> ${esc(d)}</div></li>`; }).join('')}</ul>`
    : '<span class="notas-faint">Sem movimentações.</span>';

  $('#drawer-root').innerHTML = `
    <div class="notas-veu" data-close></div>
    <aside class="notas-gaveta" role="dialog" aria-label="Detalhe da nota">
      <div class="notas-alca" role="separator" aria-orientation="vertical" title="Arraste para ajustar a largura"></div>
      <div class="notas-gaveta-topo">
        <div>
          <h2>${esc(it.nf ? `NF ${it.nf}` : it.name || 'Sem número')}</h2>
          <div class="sub">${esc(it.supplierName || 'Fornecedor não informado')}${it.supplierDoc ? ` · ${esc(it.supplierDoc)}` : ''}</div>
        </div>
        <button class="cx-btn cx-mini" type="button" data-close>Fechar</button>
      </div>

      <div class="notas-detalhe-grade"><div class="notas-edicao">
      <div class="notas-bloco">
        <h4>Decisão e status</h4>
        <div class="notas-grade">
          <label class="cx-campo"><span>Aprovação Otávio</span><select id="d-otavio" class="notas-sel" data-role="otavio" data-v="${esc(it.otavio)}" style="width:100%">${otavioOptions(it.otavio)}</select></label>
          <label class="cx-campo"><span>Status</span><select id="d-status" class="notas-sel" data-v="${esc(it.status)}" style="width:100%">${selectOptions(S.meta.catalog.paymentStatus, it.status)}</select></label>
          <label class="cx-campo largo"><span>Grupo atual: <b>${esc(it.group)}</b></span>
            <div style="display:flex;gap:8px"><select id="d-group" style="flex:1">${S.meta.groups.map((g) => `<option value="${g.id}" ${g.id === it.groupId ? 'selected' : ''}${it.otavio === 'Aprovado' && !S.actor.canUnlock && g.company === 'TAG' && ['pending', 'rejected'].includes(g.stage) ? ' disabled' : ''}>${esc(g.title)}</option>`).join('')}</select>
            <button class="cx-btn notas-btn sec" type="button" id="d-move">Mover</button></div>
            <small class="notas-faint">Mover manualmente não dispara automações, igual ao arrastar no quadro da Monday.</small></label>
          ${S.actor.canEdit ? '<div class="largo" id="d-excluir-area" style="margin-top:6px"><button class="cx-btn notas-btn sec" type="button" id="d-excluir" style="color:#e05a5a">Excluir nota</button></div>' : ''}
        </div>
      </div>

      ${it.engineeringInfo ? `<div class="notas-bloco"><h4>Análise da engenharia</h4><div class="notas-grade">
        <div class="cx-campo largo"><span>Narrativa</span><div>${esc(it.engineeringInfo.narrativa || it.narrative || '—')}</div></div>
        <div class="cx-campo"><span>É contrato?</span><div>${esc(it.engineeringInfo.contrato || '—')}${it.engineeringInfo.contratoNome ? ' · ' + esc(it.engineeringInfo.contratoNome) : ''}</div></div>
        <div class="cx-campo"><span>Pertence à expansão?</span><div>${esc(it.engineeringInfo.expansao || '—')}</div></div>
        <div class="cx-campo"><span>Pedido (Datasul)</span><div>${esc(it.engineeringInfo.pedido || '—')}</div></div>
        <div class="cx-campo"><span>Dados bancários (lançamento)</span><div>${esc(it.bank || '—')}</div></div>
      </div>${(it.engineeringInfo.historico || []).length ? `<h4 style="margin-top:14px">Histórico da análise</h4><ul class="notas-hist">${it.engineeringInfo.historico.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      <div class="notas-bloco">
        <h4>Dados da nota</h4>
        <div class="notas-grade">
          <label class="cx-campo"><span>Número da NF</span><input name="nf" value="${esc(it.nf)}"></label>
          <label class="cx-campo"><span>Valor (R$)</span><input name="value" type="number" step="0.01" min="0" value="${esc(it.value ?? '')}"></label>
          <label class="cx-campo"><span>Fornecedor</span><input name="supplierName" value="${esc(it.supplierName)}"></label>
          <label class="cx-campo"><span>CNPJ / CPF</span><input name="supplierDoc" value="${esc(it.supplierDoc)}"></label>
          <label class="cx-campo"><span>Departamento / empresa</span><select name="departmentId">${depOpts}</select></label>
          <label class="cx-campo"><span>Categoria</span><select name="category">${catOpts}</select></label>
          <label class="cx-campo"><span>Pagamento</span><select name="paymentId">${payOpts}</select></label>
          <label class="cx-campo"><span>Emissão</span><input name="issueDate" type="date" value="${esc(it.issueDate || '')}"></label>
          <label class="cx-campo largo"><span>Endereço (imóvel)</span><input name="address" value="${esc(it.address.join('; '))}"></label>
          <label class="cx-campo largo"><span>Pagador</span>${payerChecks}</label>
          <label class="cx-campo largo"><span>Narrativa</span><textarea name="narrative">${esc(it.narrative)}</textarea></label>
          <label class="cx-campo largo"><span>Dados bancários</span><textarea name="bank">${esc(it.bank)}</textarea></label>
          <label class="cx-campo"><span>Observação - Pagamento</span><input name="paymentNotes" value="${esc(it.paymentNotes)}"></label>
          <label class="cx-campo"><span>Observações do aprovador</span><input name="approverNotes" value="${esc(it.approverNotes)}"></label>
        </div>
        <h4 style="margin-top:18px">Vencimentos</h4>
        <div class="notas-grade">${dues}</div>
        <div class="notas-acoes"><button class="cx-btn notas-btn" type="button" id="d-save">Salvar alterações</button><span class="notas-faint" style="font-size:12px">Só os campos alterados são gravados.</span></div>
      </div>

      <div class="notas-bloco">
        <h4>Arquivos</h4>
        <div class="notas-arquivos">${files}</div>
        <div class="notas-acoes">
          <input type="file" id="d-file-file" accept=".pdf,.png,.jpg,.jpeg,.xml" hidden>
          <button class="cx-btn notas-btn" type="button" id="d-file-btn">Incluir arquivo</button>
        </div>
        <small class="notas-faint" style="display:block;margin-top:8px">Para boleto ou nota que chega depois. Incluir ou remover arquivo fica no histórico e não muda o status.</small>
        <h4 style="margin-top:16px">Comprovantes</h4>
        <div class="notas-arquivos">${proofs}</div>
        <div class="notas-acoes">
          <input type="file" id="d-proof-file" accept=".pdf,.png,.jpg,.jpeg,.xml" hidden>
          <button class="cx-btn notas-btn" type="button" id="d-proof-btn">Incluir comprovante</button>
        </div>
        <small class="notas-faint" style="display:block;margin-top:8px">Anexar ou remover comprovante dispara a automação "Comprovantes alterado": Status = Pago e mover para TAG - Pagas.</small>
      </div>

      <div class="notas-bloco">
        <h4>Histórico desta nota</h4>
        ${history}
      </div>
      </div>${pdfPanel([...it.files,...it.proofs],it.id)}</div>
    </aside>`;
  applyPermissions();
}

// Lê arquivo em base64 (sem o prefixo data:).
function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

async function saveDrawer() {
  const data = await api(`/api/items/${encodeURIComponent(S.drawerId)}`);
  const it = data.item;
  const root = $('.notas-gaveta');
  const v = (n) => root.querySelector(`[name="${n}"]`)?.value ?? '';
  const order = S.meta.catalog.payers;
  const inOrder = (list) => order.filter((p) => list.includes(p));
  const payer = inOrder([...root.querySelectorAll('input[name="payer"]:checked')].map((i) => i.value));
  const dues = [...root.querySelectorAll('input[name="due"]')].map((i) => i.value || null);
  const next = {
    nf: v('nf'),
    value: v('value') === '' ? null : Number(v('value')),
    supplierName: v('supplierName'),
    supplierDoc: v('supplierDoc'),
    departmentId: v('departmentId') === '' ? null : Number(v('departmentId')),
    category: v('category'),
    paymentId: v('paymentId') === '' ? null : Number(v('paymentId')),
    issueDate: v('issueDate') || null,
    address: v('address') ? v('address').split(';').map((s) => s.trim()).filter(Boolean) : [],
    payer,
    narrative: v('narrative'),
    bank: v('bank'),
    paymentNotes: v('paymentNotes'),
    approverNotes: v('approverNotes'),
    dues,
  };
  const current = {
    nf: it.nf, value: it.value, supplierName: it.supplierName, supplierDoc: it.supplierDoc,
    departmentId: it.departmentId, category: it.category, paymentId: it.paymentId, issueDate: it.issueDate,
    address: it.address, payer: inOrder(it.payer), narrative: it.narrative, bank: it.bank,
    paymentNotes: it.paymentNotes, approverNotes: it.approverNotes, dues: it.dues,
  };
  const patch = {};
  for (const k of Object.keys(next)) {
    if (JSON.stringify(next[k]) !== JSON.stringify(current[k])) patch[k] = next[k];
  }
  if (!Object.keys(patch).length) { toast('Nada para salvar.'); return; }
  await api(`/api/items/${encodeURIComponent(S.drawerId)}`, { method: 'PATCH', body: { patch } });
  toast(`${Object.keys(patch).length} campo(s) salvo(s).`);
  await refresh();
  await drawerRender();
  refreshBoard();
}

// ---------- formulário de lançamento ----------
function formVis() {
  const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const dep = num(S.form.departmentId);
  const pay = num(S.form.paymentId);
  return {
    payer: [0, 1, 2, 3, 6, 7, 8].includes(dep),
    address: [1, 2, 8].includes(dep),
    bank: pay === 2,
    due: [1, 2, 3, 4].includes(pay),
    dueMore: pay === 3,
  };
}

function blankForm() {
  return { nf: '', supplierName: '', supplierDoc: '', departmentId: '', payer: [], address: '', category: '', issueDate: '', narrative: '', value: '', paymentId: '', bank: '', dues: Array(12).fill(''), file: null };
}

// Painel do formulário (o mesmo do quadro), sem as abas.
function formPanelHtml() {
  if (!S.form) S.form = blankForm();
  const f = S.form;
  const vis = formVis();
  const suppliers = [...new Set(S.rows.map((r) => r.supplierName).filter(Boolean))].sort();
  const addresses = [...new Set(S.rows.flatMap((r) => r.address).filter(Boolean))].sort();
  const err = (k) => (S.formNotice?.errors || []).find((e) => e.field === k)?.message;
  const campo = (key, label, input, extra = '', cls = '') => {
    const e = err(key);
    return `<label class="cx-campo notas-campo ${cls} ${e ? 'err' : ''}" data-field="${key}"><span>${label}</span>${input}${extra}${e ? `<div class="notas-erro">${esc(e)}</div>` : ''}</label>`;
  };
  const notice = S.formNotice?.success
    ? `<div class="notas-ok">${esc(S.formNotice.success)} <div class="notas-acoes" style="margin-top:10px"><button class="cx-btn notas-btn sec peq" type="button" id="f-another">Lançar outra</button><button class="cx-btn notas-btn peq" type="button" data-view="tag">Ver em Notas TAG</button></div></div>`
    : '';
  const dueFields = vis.due ? campo('dues', 'Vencimento 01', `<input type="date" data-f="dues.0" value="${esc(f.dues[0])}">`) : '';
  const moreDues = vis.dueMore
    ? f.dues.slice(1).map((d, i) => `<label class="cx-campo"><span>Vencimento ${pad2(i + 2)}</span><input type="date" data-f="dues.${i + 1}" value="${esc(d)}"></label>`).join('')
    : '';

  return `
    <section class="notas-painel" aria-label="Formulário">
      <div class="notas-painel-cabeca">
        <div>
          <h1>Formulário</h1>
          <p>Mesmo formulário do quadro. Ao enviar, a nota entra em <b>TAG · Pendentes de aprovação</b> e a automação de criação preenche o nome (NF - fornecedor) e o pagador TAG EXEMPLO.</p>
        </div>
      </div>
      <div class="notas-corpo">
        ${notice}
        ${S.formNotice?.message ? `<div class="notas-nota">${esc(S.formNotice.message)}</div>` : ''}
        <div class="notas-form-grade"><form id="note-form" novalidate>
          <h2 class="notas-secao">Nota</h2>
          <div class="notas-grade">
            ${campo('nf', 'Número da nota fiscal', `<input data-f="nf" value="${esc(f.nf)}" inputmode="numeric">`)}
            ${campo('issueDate', 'Data de emissão', `<input type="date" data-f="issueDate" value="${esc(f.issueDate)}">`)}
            ${campo('supplierName', 'Fornecedor', `<input data-f="supplierName" list="dl-suppliers" value="${esc(f.supplierName)}" autocomplete="off">`, '<small class="notas-faint">Escolha um fornecedor já cadastrado ou digite o nome.</small>', 'largo')}
            ${campo('supplierDoc', 'CNPJ / CPF do fornecedor', `<input data-f="supplierDoc" value="${esc(f.supplierDoc)}">`)}
            ${campo('departmentId', 'Departamento / empresa', `<select data-f="departmentId"><option value="">Selecione</option>${S.meta.catalog.departments.map((d) => `<option value="${d.id}" ${String(d.id) === String(f.departmentId) ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}</select>`)}
            ${campo('category', 'Categoria', `<select data-f="category"><option value="">Selecione</option>${S.meta.catalog.categories.map((c) => `<option ${c === f.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
            ${vis.payer ? campo('payer', 'Pagador', pagadorSuspensa(S.meta.catalog.payers, f.payer, 'f-payers'), '', 'largo') : ''}
            ${vis.address ? campo('address', 'Endereço do imóvel', `<input data-f="address" list="dl-addresses" value="${esc(f.address)}" autocomplete="off">`, '', 'largo') : ''}
            ${campo('file', 'Nota fiscal e boleto (PDF)', `<input type="file" id="f-file" accept=".pdf,.png,.jpg,.jpeg,.xml">`, f.file ? `<small class="notas-faint">${esc(f.file.name)}</small>` : '<small class="notas-faint">PDF, PNG, JPG ou XML até 10 MB.</small>', 'largo')}
          </div>

          <h2 class="notas-secao">Pagamento</h2>
          <div class="notas-grade">
            ${campo('narrative', 'Narrativa (finalidade do serviço)', `<textarea data-f="narrative">${esc(f.narrative)}</textarea>`, '', 'largo')}
            ${campo('value', 'Valor (R$)', `<input type="number" step="0.01" min="0" data-f="value" value="${esc(f.value)}">`)}
            ${campo('paymentId', 'Forma de pagamento', `<select data-f="paymentId"><option value="">Selecione</option>${S.meta.catalog.payments.map((p) => `<option value="${p.id}" ${String(p.id) === String(f.paymentId) ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>`)}
            ${vis.bank ? campo('bank', 'Dados bancários', `<textarea data-f="bank">${esc(f.bank)}</textarea>`, '', 'largo') : ''}
            ${dueFields}
            ${moreDues}
          </div>
          <div class="notas-acoes">
            <button class="cx-btn notas-btn" type="submit" id="f-submit">Enviar nota</button>
            <button class="cx-btn notas-btn sec" type="button" id="f-reset">Limpar formulário</button>
          </div>
        </form>${S.uploadUrl ? `<section class="notas-pdf-lateral"><h3>PDF para preenchimento</h3>${visorHtml(S.uploadUrl)}</section>` : ''}</div>
        <datalist id="dl-suppliers">${suppliers.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
        <datalist id="dl-addresses">${addresses.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      </div>
    </section>`;
}

// Re-renderiza o formulário com as abas (usado ao trocar campos que mudam a exibição).
function renderForm() {
  $('#cxArea').innerHTML = tabsRow('formulario') + formPanelHtml();
  applyPermissions();
}

function readFormInput(el) {
  const key = el.dataset.f;
  if (!key) return;
  if (key.startsWith('dues.')) { S.form.dues[Number(key.split('.')[1])] = el.value; return; }
  S.form[key] = el.value;
}

async function submitForm(ev) {
  ev.preventDefault();
  const btn = $('#f-submit');
  btn.disabled = true;
  try {
    const f = S.form;
    f.payer = [...document.querySelectorAll('#f-payers input[name="payer"]:checked')].map((i) => i.value);
    let file = null;
    if (f.file) file = { name: f.file.name, dataBase64: await readFileBase64(f.file) };
    const values = { ...f };
    delete values.file;
    const res = await api('/api/items', { method: 'POST', body: { values, file } });
    await refresh();
    S.formNotice = { success: `Nota ${res.item.nf ? 'NF ' + res.item.nf : ''} lançada em ${res.item.group}. Nome e pagador definidos pela automação de criação.`, errors: [] };
    S.form = blankForm();
    if (S.uploadUrl) URL.revokeObjectURL(S.uploadUrl);
    S.uploadUrl = null;
    renderNav();
    renderForm();
    toast('Nota lançada.');
  } catch (err) {
    S.formNotice = { message: err.details && err.details.length ? 'Revise os campos destacados.' : err.message, errors: err.details || [] };
    renderForm();
    toast(err.message, true);
  } finally {
    const b = $('#f-submit');
    if (b) b.disabled = false;
  }
}

// ---------- histórico ----------
function evLabel(e) {
  const val = (x) => (Array.isArray(x) ? x.join(', ') : x === null || x === undefined || x === '' ? '—' : String(x));
  const auto = e.automation || e.automationId ? ' (automação)' : '';
  switch (e.type) {
    case 'created': return ['Nota lançada', e.detail];
    case 'group_changed': return ['Movida de grupo', `${val(e.from)} → ${val(e.to)}${e.automation ? ' (automação)' : ''}`];
    case 'column_changed': return [`${e.column} alterado`, `${val(e.from)} → ${val(e.to)}${auto}`];
    case 'field_changed': return [`${e.field} alterado`, `${val(e.from)} → ${val(e.to)}`];
    case 'file_added': return ['Comprovante anexado', e.file];
    case 'file_removed': return ['Comprovante removido', e.file];
    case 'automation_run': return ['Automação executada', e.detail];
    case 'email_queued': return ['E-mail na fila (não enviado)', e.detail];
    case 'automation_toggled': return ['Automação alterada', e.detail];
    case 'automation_stopped': return ['Automação interrompida', e.detail];
    default: return [e.type, e.detail || ''];
  }
}

async function renderHistory() {
  const ev = await api('/api/events?limit=300');
  const nfOf = (id) => {
    if (!id) return '—';
    const r = rowById(id);
    return r ? (r.nf ? `NF ${r.nf}` : r.name || id) : id;
  };
  $('#cxArea').innerHTML = `
    <section class="notas-painel" aria-label="Histórico">
      <div class="notas-painel-cabeca">
        <div>
          <h1>Histórico</h1>
          <p>Últimas 300 movimentações desta cópia: lançamentos, alterações de campos, mudanças de grupo e automações. O histórico anterior da Monday não foi importado.</p>
        </div>
      </div>
      <div class="notas-tabela cx-quadro-rolagem">
        <table class="cx-quadro">
          <thead><tr><th>Quando</th><th>Nota</th><th>Evento</th><th>Detalhe</th><th>Por</th></tr></thead>
          <tbody>
            ${ev.events.map((e) => { const [t, d] = evLabel(e); return `<tr>
              <td class="notas-docs">${esc(new Date(e.at).toLocaleString('pt-BR'))}</td>
              <td>${esc(nfOf(e.itemId))}</td>
              <td>${esc(t)}</td>
              <td>${esc(d)}</td>
              <td class="notas-faint">${esc(e.actor)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="notas-vazio">Sem movimentações ainda.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;
}

// ---------- render geral ----------
async function render() {
  S.route = parseRoute();
  if (!S.meta) return;
  renderNav();
  if (S.route.name === 'board'){
    // Troca de aba (14/11): mostra 'Carregando…' e cede um quadro ao navegador antes de montar a tabela, em vez de congelar a tela.
    const area = $('#cxArea');
    if (area && area.dataset.vista !== S.route.view){ area.innerHTML = '<div class="cx-carregando-tela" role="status"><span class="cx-anel" aria-hidden="true"></span>Carregando…</div>'; await new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0))); area.dataset.vista = S.route.view; }
    renderBoardView(S.route.view);
  }
  else if (S.route.name === 'history') await renderHistory();
  else if (S.route.name === 'controle') await window.Controle?.render?.($('#cxArea'));
}

// Tema e recolher: mesma regra da Expansão (data-theme no html; classe no body).
function aplicarTema(claro) {
  if (claro) document.documentElement.setAttribute('data-theme', 'claro');
  else document.documentElement.removeAttribute('data-theme');
  $('#notasTema').textContent = claro ? 'Escuro' : 'Claro';
  $('#notasTema').setAttribute('aria-pressed', String(claro));
  try { localStorage.setItem('notas.tema', claro ? 'claro' : 'escuro'); } catch { /* sem armazenamento */ }
}

function wire() {
  $('#cxNavAlternar').addEventListener('click', () => {
    const fechada = document.body.classList.toggle('cx-nav-fechada');
    $('#cxNavAlternar').textContent = fechada ? '› Abrir' : '‹ Recolher';
    try { localStorage.setItem('notas.nav', fechada ? '1' : '0'); } catch { /* sem armazenamento */ }
  });
  try {
    if (localStorage.getItem('notas.nav') === '1') { document.body.classList.add('cx-nav-fechada'); $('#cxNavAlternar').textContent = '› Abrir'; }
  } catch { /* ignora */ }
  $('#notasTema').addEventListener('click', () => aplicarTema(document.documentElement.getAttribute('data-theme') !== 'claro'));
  try { aplicarTema(localStorage.getItem('notas.tema') === 'claro'); } catch { aplicarTema(false); }

  $('#cxAbas').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-go]');
    if (b) location.hash = b.dataset.go;
  });
  window.addEventListener('hashchange', () => { closeDrawer(); render().catch((e) => toast(e.message, true)); });
  window.addEventListener('notas:recarregar', () => { refresh().then(render).then(() => toast('Nova nota da Engenharia em TAG - Pendentes de aprovação.')).catch((e) => toast(e.message, true)); });

  const area = $('#cxArea');
  area.addEventListener('click', (ev) => {
    const zipBtn = ev.target.closest('[data-zip-grupo]');
    if (zipBtn) { baixarZipGrupo(zipBtn.dataset.zipGrupo).catch((e) => { marcarZip(zipBtn.dataset.zipGrupo, null); toast(e.message, true); }); return; }
    const abrir = ev.target.closest('[data-abrir-pdf]');
    if (abrir) { const r = rowById(abrir.dataset.abrirPdf); if (r && r.preview) window.open(arq('/files/' + encodeURIComponent(r.id) + '/' + encodeURIComponent(r.preview.id)), '_blank', 'noopener'); return; }
    if (ev.target.closest('[data-mais-cartoes]')) { S.cartoesLimite = (S.cartoesLimite || 24) + 48; refreshBoard(); return; }
    const preview=ev.target.closest('[data-preview]');
    if(preview){
      const panel=preview.nextElementSibling;panel.hidden=!panel.hidden;preview.setAttribute('aria-expanded',String(!panel.hidden));
      if(!panel.hidden&&!panel.querySelector('.notas-visor')){const r=rowById(preview.dataset.preview);panel.insertAdjacentHTML('afterbegin',visorHtml(arq('/files/'+encodeURIComponent(r.id)+'/'+encodeURIComponent(r.preview.id)),true));}
      return;
    }
    const presentation = ev.target.closest('[data-presentation]');
    if (presentation) {
      S.presentation = presentation.dataset.presentation;
      try { localStorage.setItem('notas.apresentacao', S.presentation); } catch {}
      refreshBoard();
      document.querySelector('[data-presentation="' + S.presentation + '"]')?.focus();
      return;
    }
    const open = ev.target.closest('[data-open-note]');
    if (open) { openDrawer(open.dataset.openNote).catch(e => toast(e.message,true)); return; }
    // Inclusão manual (16/11/2026): quem não está com login de edição é levado à tela de login; quem está, vai ao formulário.
    if (ev.target.closest('#exportar-excel')) { exportarExcel(); return; }
    if (ev.target.closest('#incluir-manual')) {
      if (!S.actor.canEdit) { toast('Entre com seu login de edição para incluir uma nota.', true); $('#abrir-login')?.click(); return; }
      location.hash = '#/formulario'; return;
    }
    const aba = ev.target.closest('.notas-abas button[data-view]') || ev.target.closest('button[data-view]');
    if (aba) { location.hash = `#/${aba.dataset.view}`; return; }
    if (ev.target.closest('#clear')) {
      S.filters = { ...S.filters, q: '', dept: '', cat: '', from: '', to: '', apFrom: '', apTo: '' };
      refreshBoard();
      return;
    }
    const grupo = ev.target.closest('[data-toggle]');
    if (grupo) {
      const chave = grupo.dataset.toggle;
      S.fechados[chave] = !S.fechados[chave];
      updateBoardDynamic();
      return;
    }
    if (ev.target.closest('#f-another') || ev.target.closest('#f-reset')) { S.formNotice = null; S.form = blankForm(); if(S.uploadUrl) URL.revokeObjectURL(S.uploadUrl); S.uploadUrl=null; renderForm(); return; }
    const row = ev.target.closest('tr.linha');
    if (row && !ev.target.closest('select')) { openDrawer(row.dataset.id).catch((e) => toast(e.message, true)); }
  });
  area.addEventListener('input', (ev) => {
    if (ev.target.id === 'q') { S.filters.q = ev.target.value; updateBoardDynamic(); return; }
    if (ev.target.closest('#note-form') && ev.target.dataset.f) {
      readFormInput(ev.target);
      if (ev.target.dataset.f === 'supplierName') {
        const hit = S.rows.find((r) => norm(r.supplierName) === norm(S.form.supplierName) && r.supplierDoc);
        if (hit && !S.form.supplierDoc) { S.form.supplierDoc = hit.supplierDoc; const d = $('[data-f="supplierDoc"]'); if (d) d.value = hit.supplierDoc; }
      }
    }
  });
  area.addEventListener('change', async (ev) => {
    const t = ev.target;
    const filtro = { sort: 'sort', dept: 'dept', cat: 'cat', from: 'from', to: 'to', apFrom: 'apFrom', apTo: 'apTo' };
    const chave = Object.keys(filtro).find((k) => filtro[k] === t.id);
    if (chave && S.route.view !== 'formulario') { S.filters[chave] = t.value; updateBoardDynamic(); return; }
    if (t.dataset.role === 'approverNotes') {
      try { await api(`/api/items/${encodeURIComponent(t.dataset.id)}`, { method: 'PATCH', body: { patch: { approverNotes: t.value } } }); const r = rowById(t.dataset.id); if (r) r.approverNotes = t.value; toast('Narrativa da decisão salva.'); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.role === 'otavio' || t.dataset.role === 'status') {
      await setColumn(t.dataset.id, t.dataset.role, t.value, t);
      return;
    }
    if(t.id==='f-file'){
      S.form.file=t.files[0]||null;
      if(S.uploadUrl)URL.revokeObjectURL(S.uploadUrl);
      S.uploadUrl=S.form.file?.type==='application/pdf'?URL.createObjectURL(S.form.file):null;
      renderForm();return;
    }
    if (t.closest('#note-form')) {
      if (t.name === 'payer') return;
      readFormInput(t);
      if (t.dataset.f === 'departmentId' || t.dataset.f === 'paymentId') renderForm();
      return;
    }
    if (t.id === 'f-file') {
      S.form.file = t.files[0] || null;
      const hint = t.closest('.notas-campo')?.querySelector('small');
      if (hint) hint.textContent = S.form.file ? S.form.file.name : 'PDF, PNG, JPG ou XML até 10 MB.';
    }
  });
  area.addEventListener('submit', (ev) => { if (ev.target.id === 'note-form') submitForm(ev); });

  const drawer = $('#drawer-root');
  drawer.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-close]')) { closeDrawer(); return; }
    try {
      if (ev.target.closest('#d-save')) { await saveDrawer(); return; }
      if (ev.target.closest('#d-excluir')) {
        $('#d-excluir-area').innerHTML = '<small class="notas-faint">Excluir esta nota? Fica uma cópia guardada no histórico.</small> <button class="cx-btn notas-btn" type="button" id="d-excluir-sim" style="background:#c0392b;color:#fff">Sim, excluir</button>';
        return;
      }
      if (ev.target.closest('#d-excluir-sim')) {
        await api(`/api/items/${encodeURIComponent(S.drawerId)}`, { method: 'DELETE' });
        closeDrawer();
        await refresh();
        toast('Nota excluída.');
        refreshBoard();
        return;
      }
      if (ev.target.closest('#d-move')) {
        const groupId = $('#d-group').value;
        await api(`/api/items/${encodeURIComponent(S.drawerId)}/move`, { method: 'POST', body: { groupId } });
        await refresh();
        toast('Nota movida.');
        await drawerRender();
        refreshBoard();
        return;
      }
      if (ev.target.closest('#d-proof-btn')) {
        const input = $('#d-proof-file');
        if (!input.files[0]) { input.click(); return; }
        const file = input.files[0];
        const dataBase64 = await readFileBase64(file);
        const res = await api(`/api/items/${encodeURIComponent(S.drawerId)}/proofs`, { method: 'POST', body: { file: { name: file.name, dataBase64 } } });
        await refresh();
        toast(`Comprovante anexado. Status: ${res.item.status || '—'} · grupo: ${res.item.group}`);
        await drawerRender();
        refreshBoard();
        return;
      }
      if (ev.target.closest('#d-file-btn')) {
        const input = $('#d-file-file');
        if (!input.files[0]) { input.click(); return; }
        const file = input.files[0];
        if (file.size > 15 * 1024 * 1024) { toast('Arquivo grande demais (máximo 15 MB).', true); return; }
        const dataBase64 = await readFileBase64(file);
        await api(`/api/items/${encodeURIComponent(S.drawerId)}/files`, { method: 'POST', body: { file: { name: file.name, dataBase64 } } });
        await refresh();
        toast('Arquivo anexado à nota.');
        await drawerRender();
        refreshBoard();
        return;
      }
      const confirmar = (botao) => {
        if (botao.dataset.confirmar === '1') return true;
        botao.dataset.confirmar = '1'; botao.textContent = 'confirmar remoção';
        setTimeout(() => { if (botao.isConnected) { botao.dataset.confirmar = ''; botao.textContent = 'remover'; } }, 5000);
        return false;
      };
      const rmArq = ev.target.closest('[data-remove-file]');
      if (rmArq) {
        if (!confirmar(rmArq)) return;
        await api(`/api/items/${encodeURIComponent(S.drawerId)}/files/${encodeURIComponent(rmArq.dataset.removeFile)}`, { method: 'DELETE' });
        await refresh();
        toast('Arquivo removido da nota.');
        await drawerRender();
        refreshBoard();
        return;
      }
      const rm = ev.target.closest('[data-remove-proof]');
      if (rm) {
        if (!confirmar(rm)) return;
        const res = await api(`/api/items/${encodeURIComponent(S.drawerId)}/proofs/${encodeURIComponent(rm.dataset.removeProof)}`, { method: 'DELETE' });
        await refresh();
        toast(`Comprovante removido. Status: ${res.item.status || '—'} · grupo: ${res.item.group}`);
        await drawerRender();
        refreshBoard();
      }
    } catch (err) { toast(err.message, true); }
  });
  drawer.addEventListener('change', ev => {
    if (ev.target.id === 'd-file-file' && ev.target.files[0]) $('#d-file-btn')?.click();
    if (ev.target.id === 'd-proof-file' && ev.target.files[0]) $('#d-proof-btn')?.click();
  });
  drawer.addEventListener('click', ev => {
    const b = ev.target.closest ? ev.target.closest('[data-pdf-nav]') : null; if (!b) return;
    const sec = b.closest('.notas-pdf-lateral'), lista = JSON.parse(sec.dataset.pdfs);
    const i = Math.max(0, Math.min(lista.length - 1, Number(sec.dataset.atual || 0) + Number(b.dataset.pdfNav)));
    sec.dataset.atual = i;
    sec.querySelector('#pdf-nome').textContent = lista[i].n;
    sec.querySelector('#pdf-contagem').textContent = (i + 1) + ' de ' + lista.length;
    sec.querySelector('#pdf-external').href = lista[i].h;
    const v = sec.querySelector('.notas-visor'); v.dataset.pdf = lista[i].h; v.dataset.zoom = 1; desenharVisor(v);
  });
  drawer.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.id === 'd-otavio') { await setColumn(S.drawerId, 'otavio', t.value, t); await drawerRender(); return; }
    if (t.id === 'd-status') { await setColumn(S.drawerId, 'status', t.value, t); await drawerRender(); }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.drawerId) closeDrawer(); });
}

function wireSession(){
 document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='login-form')return;ev.preventDefault();
  const form=ev.target,button=form.querySelector('button');button.disabled=true;
  // 19/11/2026: Controle de Lançamentos usa o login da Expansão; o mesmo e-mail e senha são tentados lá (só para os e-mails autorizados).
  const ctl=(window.Controle?.entrar?.(form.elements.email.value,form.elements.password.value)||Promise.resolve(false)).catch(()=>false);
  ctl.then(ok=>{if(ok&&S.meta)renderNav();});
  try{
   const response=await fetch(S.auth.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:S.auth.key,'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value.trim(),password:form.elements.password.value})});
   form.elements.password.value='';const data=await response.json();
   if(!response.ok||!data.access_token)throw new Error('Não foi possível entrar. Confira e-mail e senha.');
   S.token=data.access_token;
   // 17/11/2026: guarda a sessão como o painel guarda (mesma chave): o F5 não pede senha de novo e a sessão se renova sozinha.
   salvarSessaoLocal(data);
   S.actor=(await api('/api/session')).actor;
   closeDrawer();renderSession();
   if(S.actor.mustChange){telaEntrar('Crie sua senha para continuar.');telaCriarSenha(data,'Criar sua senha.','É o seu primeiro acesso: troque a senha inicial por uma senha sua, com pelo menos 8 caracteres.');return;}
   if(S.actor.canRead){window.Controle?.limparSo?.();await iniciar();}else if(await ctl&&window.Controle.podeSomente()){window.Controle.somente();return;}else{telaEntrar('Sua conta não tem acesso às notas da TAG.');}
   toast(S.actor.canEdit?'Edição liberada.':(S.actor.canRead?'Conta com acesso somente para leitura.':'Sem acesso às notas.'));
  }catch(err){if(await ctl&&window.Controle.podeSomente()){S.token=null;window.Controle.somente();return;}S.token=null;S.actor={canEdit:false,email:''};renderSession();applyPermissions();toast(err.message,true);}finally{button.disabled=false;}
 });
 // Primeiro acesso / senha esquecida (14/11): o link só chega para conta cadastrada no login do ecossistema e leva
 // à página onde a pessoa cria a própria senha. Quem libera a edição continua sendo o servidor (lib/access.mjs).
 document.addEventListener('click',async ev=>{
  const botao=ev.target.closest('#primeiro-acesso');if(!botao)return;
  const email=String($('#login-form')?.elements.email.value||'').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast('Digite seu e-mail no campo acima.',true);return;}
  botao.disabled=true;
  try{
   const r=await api('/api/primeiro-acesso',{method:'POST',body:{email}});
   toast(r.enviado==='convite'?'Convite enviado. Abra o e-mail e crie sua senha; depois entre aqui.':'Enviamos um link para você definir sua senha. Depois entre aqui.');
  }catch(err){toast(err.message,true);}finally{botao.disabled=false;}
 });
 document.addEventListener('click',async ev=>{
  if(!ev.target.closest('#logout'))return;const token=tokenAtual();
  S.token=null;try{const ref=new URL(S.auth.url).hostname.split('.')[0];localStorage.removeItem('sb-'+ref+'-auth-token');}catch{}await window.Controle?.sair?.();S.actor=(await api('/api/session')).actor;closeDrawer();renderSession();
  if(!S.actor.email){telaEntrar('Entre com seu e-mail e senha para ver as notas da TAG.');}else{await render();}
  if(token)fetch(S.auth.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:S.auth.key,Authorization:'Bearer '+token}}).catch(()=>{});
 });
}

async function boot() {
  try {
    let session=await api('/api/session');S.auth=session.auth;
    if (await garantirSessao()) session=await api('/api/session');   // sessão do painel renovada: entra direto
    if(!S.token&&tokenDoPainel())session=await api('/api/session');   // sessão aberta no painel de Engenharia
    S.actor=session.actor;
    renderSession();wireSession();
    const tokenSenha=new URLSearchParams(location.search).get('recuperar');
    if(tokenSenha){history.replaceState(null,'',location.pathname);if(await abrirLinkDeSenha(tokenSenha))return;}
    // 19/11/2026: abre direto só o Controle de Lançamentos apenas para quem entrou antes nesse modo (sem conta na TAG, ex.: Tatiana). Administração nunca.
    if((!S.actor.email||(!S.actor.mustChange&&!S.actor.canRead))&&await window.Controle?.temSessao?.()&&window.Controle.soControle()){window.Controle.somente();return;}
    if(!S.actor.email){telaEntrar('Entre com seu e-mail e senha para ver as notas da TAG.');return;}
    if(S.actor.mustChange){telaEntrar('Crie sua senha para continuar.');telaCriarSenha({access_token:tokenAtual()},'Criar sua senha.','É o seu primeiro acesso: troque a senha inicial por uma senha sua, com pelo menos 8 caracteres.');return;}
    if(!S.actor.canRead){telaEntrar('Sua conta não tem acesso às notas da TAG.');return;}
    await iniciar();
    // Notas novas (por exemplo, as enviadas pela Engenharia) aparecem sozinhas a cada minuto, sem atrapalhar quem está editando.
    setInterval(async()=>{
      if(document.hidden||S.drawerId||S.route.view==='formulario'||document.activeElement?.matches?.('input,textarea,select'))return;
      try{await garantirSessao();if(await refresh()&&S.route.name==='board')refreshBoard();}catch(e){/* tenta de novo no próximo minuto */}
    },15000);   // 15 s: rede de segurança; o tempo real abaixo atualiza na hora
    ligarTempoReal();
  } catch (err) {
    $('#cxArea').innerHTML = `<div class="notas-nota">Não foi possível carregar a tela: ${esc(err.message)}.</div>`;
  }
}
// Tempo real (16/11/2026): o banco avisa quando a TAG muda (sem dados no aviso) e a tela busca de novo pela API.
async function ligarTempoReal(){
  try {
    if (!window.supabase) await new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.js'; s.onload = ok; s.onerror = err; document.head.appendChild(s); });
    const cliente = window.supabase.createClient(S.auth.url, S.auth.key, { auth:{ persistSession:false, autoRefreshToken:false } });
    let agendado = null;
    const atualizar = () => {
      clearTimeout(agendado);
      agendado = setTimeout(async () => {
        if (document.hidden || S.drawerId || S.route.view === 'formulario' || document.activeElement?.matches?.('input,textarea,select')) { atualizar(); return; }   // não atrapalha quem está digitando
        try { await garantirSessao(); if (await refresh() && S.route.name === 'board') refreshBoard(); } catch (e) { /* tenta na próxima mudança */ }
      }, 600);
    };
    cliente.channel('tag').on('broadcast', { event:'mudou' }, atualizar).subscribe();
  } catch (e) { /* sem tempo real: a atualização de 15 s continua */ }
}
let iniciado=false;
async function iniciar(){
  await refresh();
  if(!iniciado){wire();iniciado=true;}
  await render();
}
// 17/11/2026 (Gustavo): Otávio e BO usam só este painel. Primeiro acesso e "nova senha" acontecem aqui mesmo, sem passar pela Engenharia.
// A sessão fica guardada como o painel guarda (mesma chave), com a validade calculada para a renovação automática funcionar.
function salvarSessaoLocal(sessao){
  try{
    if(!sessao?.access_token||!sessao.refresh_token)return;
    if(!sessao.expires_at&&sessao.expires_in)sessao.expires_at=Math.floor(Date.now()/1000)+Number(sessao.expires_in);
    const ref=new URL(S.auth.url).hostname.split('.')[0];
    localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify(sessao));
  }catch{}
}
function telaCriarSenha(sessao,titulo,texto){
  try{$('#janela-login')?.close();}catch{}
  $('#janela-senha')?.remove();
  $('#notasAcesso').insertAdjacentHTML('beforeend',`<dialog id="janela-senha" aria-labelledby="senha-titulo"><aside class="login-lateral"><div class="cx-entrada-marca">administrativo <small>EMPRESA EXEMPLO</small></div><div class="cx-entrada-mensagem"><span>UM NOVO ESPAÇO DE TRABALHO</span><h1>Do primeiro<br> documento<br> ao próximo<br> <em>passo.</em></h1><p>Notas fiscais da TAG: aprovação, pagamento e comprovantes.</p></div><small>EMPRESA EXEMPLO · ADMINISTRATIVO</small></aside><section class="login-conteudo"><span class="login-selo">EMPRESA EXEMPLO</span><h2 id="senha-titulo">${esc(titulo)}</h2><p>${esc(texto)}</p><form id="senha-form" novalidate><label>Nova senha<input name="s1" type="password" autocomplete="new-password" required></label><label>Repita a nova senha<input name="s2" type="password" autocomplete="new-password" required></label><small id="senha-msg" role="status"></small><button class="cx-btn notas-btn" type="submit">Salvar senha e entrar</button></form></section></dialog>`);
  const janela=$('#janela-senha'),form=$('#senha-form'),msg=$('#senha-msg');
  janela.addEventListener('cancel',ev=>ev.preventDefault());   // precisa terminar: Esc não fecha
  janela.showModal();form.elements.s1.focus();
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const s1=form.elements.s1.value,s2=form.elements.s2.value;
    if(s1.length<8){msg.textContent='A senha precisa ter pelo menos 8 caracteres.';return;}
    if(s1!==s2){msg.textContent='As duas senhas não são iguais.';return;}
    const botao=form.querySelector('button');botao.disabled=true;msg.textContent='Salvando…';
    try{
      // 19/11/2026: o link do e-mail só é confirmado aqui, quando a pessoa salva a senha. Antes era confirmado ao abrir a página,
      // e o antivírus do e-mail da empresa (que abre o link sozinho para conferir) gastava o link antes do clique (Otávio e BO).
      if(!sessao.access_token&&sessao.tokenHash){
        const v=await fetch(S.auth.url+'/auth/v1/verify',{method:'POST',headers:{apikey:S.auth.key,'Content-Type':'application/json'},body:JSON.stringify({type:'recovery',token_hash:sessao.tokenHash})});
        const nova=await v.json().catch(()=>({}));
        if(!v.ok||!nova.access_token)throw new Error('Este link expirou ou já foi usado. Peça outro em "Primeiro acesso" na tela de login.');
        sessao=nova;S.token=nova.access_token;
      }
      const r=await fetch(S.auth.url+'/auth/v1/user',{method:'PUT',headers:{apikey:S.auth.key,Authorization:'Bearer '+sessao.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:s1,data:{precisa_trocar_senha:false}})});
      const j=await r.json().catch(()=>({}));
      const erro=String(j.msg||j.error_description||j.message||'');
      if(!r.ok)throw new Error(/weak|easy to guess|pwned|leaked/i.test(erro) ? 'Essa senha é muito comum (aparece em listas de senhas vazadas) e o sistema não aceita. Escolha outra, por exemplo uma frase curta com números, como Notas-da-Tag-2026.' : /same|different/i.test(erro) ? 'A nova senha precisa ser diferente da anterior.' : /at least/i.test(erro) ? 'A senha precisa ter pelo menos 8 caracteres.' : (erro||'Não foi possível salvar a senha. Tente de novo.'));
      salvarSessaoLocal(sessao);
      msg.textContent='Senha salva. Abrindo o painel…';
      setTimeout(()=>location.replace(location.pathname),900);
    }catch(err){msg.textContent=err.message;botao.disabled=false;}
  });
}
async function abrirLinkDeSenha(tokenHash){
  telaEntrar('Crie sua senha para continuar.');
  telaCriarSenha({tokenHash},'Criar sua senha.','Escolha uma senha com pelo menos 8 caracteres. Depois é só entrar com seu e-mail e essa senha.');
  return true;
}
function telaEntrar(msg){
  $('#cxArea').innerHTML=`<div class="notas-nota" style="max-width:560px;margin:12vh auto;text-align:center"><p>${esc(msg)}</p><p><button type="button" class="cx-btn notas-btn" id="entrar-agora">Entrar</button></p></div>`;
  $('#entrar-agora').onclick=()=>$('#abrir-login')?.click();
  // 17/11/2026: sem sessão, a janela de login abre sozinha.
  if(!tokenAtual())setTimeout(()=>{if($('#janela-senha'))return;const j=$('#janela-login');if(j&&!j.open){try{j.showModal();}catch{}}},0);
}


// ---- Baixar os arquivos de um grupo em ZIP (19/11/2026, pedido do Gustavo para o Rodrigo da Invest TAG) ----
// Vale para o que está na tela: respeita a busca e os filtros. Uma pasta por nota, com a NF, o boleto e os comprovantes.
let jszipPronto = null;
function carregarJsZip() {
  if (window.JSZip) return Promise.resolve();
  if (jszipPronto) return jszipPronto;
  jszipPronto = new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = ok; s.onerror = () => { jszipPronto = null; erro(new Error('Não foi possível carregar o gerador de ZIP. Confira a internet e tente de novo.')); };
    document.head.appendChild(s);
  });
  return jszipPronto;
}
const nomeLimpo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const ROTULO_ZIP = '⬇ Baixar arquivos (ZIP)';
function textoZip(groupId, padrao) { return S.zip && S.zip.grupo === groupId ? S.zip.texto : padrao; }
function marcarZip(groupId, texto) {
  S.zip = texto ? { grupo: groupId, texto } : null;
  const b = document.querySelector('[data-zip-grupo="' + groupId + '"]');
  if (b) { b.disabled = !!texto; b.textContent = texto || ROTULO_ZIP; }
}
async function baixarZipGrupo(groupId) {
  if (S.zip) { toast('Já existe um download em andamento. Aguarde terminar.', true); return; }
  const g = groupById(groupId);
  const notas = boardRows(S.route.view).filter((r) => r.groupId === groupId);
  if (!notas.length) { toast('Nenhuma nota neste grupo com os filtros atuais.', true); return; }
  marcarZip(groupId, 'Preparando…');
  try {
    await carregarJsZip();
    const lista = (await api('/api/arquivos-lista', { method: 'POST', body: { ids: notas.map((r) => r.id) } })).notas;
    const semCopia = [], itens = [];
    const pastasUsadas = new Set();
    for (const n of lista) {
      let pasta = nomeLimpo((n.nf ? 'NF ' + n.nf : n.nome || n.id) + (n.fornecedor ? ' - ' + n.fornecedor : ''));
      while (pastasUsadas.has(pasta.toLowerCase())) pasta += ' (' + String(n.id).slice(-4) + ')';
      pastasUsadas.add(pasta.toLowerCase());
      const nomes = new Set();
      for (const a of n.arquivos) {
        if (!a.local) { semCopia.push((n.nf ? 'NF ' + n.nf : n.nome) + ' · ' + a.nome); continue; }
        let nome = (a.tipo === 'comprovante' ? 'Comprovante - ' : '') + (nomeLimpo(a.nome) || 'arquivo');
        while (nomes.has(nome.toLowerCase())) nome = '2 - ' + nome;
        nomes.add(nome.toLowerCase());
        itens.push({ nota: n.id, id: a.id, caminho: pasta + '/' + nome, tamanho: a.tamanho || 0 });
      }
    }
    if (!itens.length) { toast('Este grupo não tem arquivos com cópia no painel para baixar.', true); return; }
    const mb = itens.reduce((s, i) => s + i.tamanho, 0) / 1048576;
    if (mb > 600) { toast('Este grupo tem cerca de ' + Math.round(mb) + ' MB. Use os filtros (por exemplo, datas) para baixar em partes.', true); return; }
    if (mb > 150 && !confirm('São ' + itens.length + ' arquivos, cerca de ' + Math.round(mb) + ' MB. Pode demorar alguns minutos. Continuar?')) return;
    const zip = new JSZip(), falhas = [];
    let feitos = 0;
    const fila = itens.slice();
    const baixar = async (it) => {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const r = await fetch(arq('/files/' + encodeURIComponent(it.nota) + '/' + encodeURIComponent(it.id)));
          if (!r.ok) throw new Error('HTTP ' + r.status);
          zip.file(it.caminho, await r.arrayBuffer(), { compression: 'STORE' });   // PDF já é comprimido
          return;
        } catch (e) { if (tentativa) falhas.push(it.caminho + ' (' + e.message + ')'); }
      }
    };
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (fila.length) { await baixar(fila.shift()); feitos++; marcarZip(groupId, 'Baixando ' + feitos + '/' + itens.length + '…'); }
    }));
    if (semCopia.length || falhas.length) {
      zip.file('LEIA-ME.txt', [
        'Grupo: ' + g.title, 'Gerado em: ' + new Date().toLocaleString('pt-BR'), '',
        ...(semCopia.length ? ['Arquivos que ainda não têm cópia no painel (só existem como link na Monday) e por isso NÃO estão neste ZIP:', ...semCopia.map((x) => ' - ' + x), ''] : []),
        ...(falhas.length ? ['Arquivos que falharam no download (tente de novo):', ...falhas.map((x) => ' - ' + x), ''] : []),
      ].join('\r\n'));
    }
    marcarZip(groupId, 'Montando o ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeLimpo(g.title) + ' - ' + new Date().toLocaleDateString('sv-SE') + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('ZIP pronto: ' + (itens.length - falhas.length) + ' arquivos de ' + notas.length + ' notas.' + (semCopia.length ? ' ' + semCopia.length + ' sem cópia no painel (veja o LEIA-ME.txt).' : '') + (falhas.length ? ' ' + falhas.length + ' falharam.' : ''), !!falhas.length);
  } finally { marcarZip(groupId, null); }
}

boot();


// ---- Largura da gaveta e das colunas (16/11/2026): mesmo comportamento dos painéis (Expansão e Engenharia) ----
(function () {
  const MIN_COL = 60, LARG_MIN = 360;
  const lerJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sem armazenamento */ } };

  // Gaveta: a borda esquerda muda a largura; a largura fica guardada neste navegador.
  let arrastandoGaveta = false;
  const aplicarGaveta = (px) => {
    const w = Math.max(LARG_MIN, Math.min(Math.round(window.innerWidth * 0.85), px));
    document.body.style.setProperty('--cx-drawer', w + 'px');
    return w;
  };
  if (window.innerWidth > 600) { const salvo = lerJson('tagLarguraGaveta'); if (typeof salvo === 'number') aplicarGaveta(salvo); }
  document.addEventListener('pointerdown', (e) => {
    const alca = e.target.closest && e.target.closest('.notas-alca');
    if (!alca || e.button !== 0 || window.innerWidth <= 600) return;
    arrastandoGaveta = true; alca.setPointerCapture?.(e.pointerId); document.body.classList.add('cx-ajustando-gaveta'); e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => { if (arrastandoGaveta) aplicarGaveta(window.innerWidth - e.clientX); });
  const fimGaveta = () => {
    if (!arrastandoGaveta) return;
    arrastandoGaveta = false; document.body.classList.remove('cx-ajustando-gaveta');
    gravar('tagLarguraGaveta', parseInt(document.body.style.getPropertyValue('--cx-drawer'), 10) || null);
  };
  document.addEventListener('pointerup', fimGaveta); document.addEventListener('pointercancel', fimGaveta);
  document.addEventListener('dblclick', (e) => {
    if (e.target.closest && e.target.closest('.notas-alca')) { document.body.style.removeProperty('--cx-drawer'); try { localStorage.removeItem('tagLarguraGaveta'); } catch (_) { /* nada a limpar */ } }
  });

  // Colunas das tabelas: arrasta-se a borda do cabeçalho. Guardado por tabela (pelos títulos das colunas).
  const chaveColunas = (t) => 'tagColunas:' + [...(t.tHead?.rows[0]?.cells || [])].map((c) => c.textContent.trim()).join('|').slice(0, 300);
  const ajustarTabela = (t) => { const ths = [...t.tHead.rows[0].cells]; t.style.setProperty('table-layout', 'fixed', 'important'); t.style.setProperty('min-width', '0', 'important'); t.style.width = ths.reduce((a, th) => a + th.offsetWidth, 0) + 'px'; };
  const fixarMedidas = (t) => { [...t.tHead.rows[0].cells].forEach((th) => { th.style.width = Math.round(th.getBoundingClientRect().width) + 'px'; }); ajustarTabela(t); };
  function preparar(t) {
    if (!t.tHead || !t.tHead.rows[0] || t.dataset.redim) return;
    t.dataset.redim = '1';
    const k = chaveColunas(t), salvas = lerJson(k);
    if (Array.isArray(salvas) && salvas.length === t.tHead.rows[0].cells.length) {
      [...t.tHead.rows[0].cells].forEach((th, i) => { th.style.width = salvas[i] + 'px'; });
      ajustarTabela(t);
    }
    [...t.tHead.rows[0].cells].forEach((th) => {
      if (th.querySelector('.cx-redim')) return;
      const alca = document.createElement('span'); alca.className = 'cx-redim'; alca.title = 'Arraste para ajustar a largura da coluna';
      alca.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
        if (!t.style.tableLayout) fixarMedidas(t);
        const x0 = e.clientX, w0 = th.getBoundingClientRect().width;
        alca.setPointerCapture?.(e.pointerId); document.body.classList.add('cx-ajustando-coluna');
        const mover = (ev) => { th.style.width = Math.max(MIN_COL, Math.round(w0 + ev.clientX - x0)) + 'px'; ajustarTabela(t); };
        const soltar = () => {
          alca.removeEventListener('pointermove', mover); alca.removeEventListener('pointerup', soltar); alca.removeEventListener('pointercancel', soltar);
          document.body.classList.remove('cx-ajustando-coluna');
          gravar(k, [...t.tHead.rows[0].cells].map((c) => c.offsetWidth));
        };
        alca.addEventListener('pointermove', mover); alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
      });
      alca.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        [...t.tHead.rows[0].cells].forEach((c) => { c.style.width = ''; });
        t.style.tableLayout = ''; t.style.width = ''; t.style.minWidth = '';
        try { localStorage.removeItem(k); } catch (_) { /* nada a limpar */ }
      });
      th.appendChild(alca);
    });
  }
  const varrer = () => document.querySelectorAll('.notas-tabela table:not([data-redim])').forEach(preparar);
  new MutationObserver(varrer).observe(document.body, { childList: true, subtree: true });
  varrer();
})();

// Pagador (16/11/2026): o resumo da lista suspensa acompanha as opções marcadas.
document.addEventListener('change', (e) => {
  if (!e.target || e.target.name !== 'payer') return;
  const d = e.target.closest('details.notas-suspensa'); if (!d) return;
  const sel = [...d.querySelectorAll('input[name="payer"]:checked')].map((i) => i.value);
  d.querySelector('summary').textContent = sel.length ? sel.join(', ') : 'Escolher pagador';
});
