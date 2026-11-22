  // ---- Projetos e Atividades: criar, editar e exportar planilha (Gustavo, 14/11). Só quem mexe no Portfólio (Marcos e Gustavo) salva. ----
  const dadosQuadro = chave => chave === 'atividades' ? D.atividades : D.projetos;
  const NOME_ITEM = { projetos:'projeto', atividades:'atividade' }, CRIADO = { projetos:'Projeto criado.', atividades:'Atividade criada.' };
  const acoesQuadro = chave => { const pode = podeMexerPortfolio(pessoa);
    return `<div class="cx-visoes cx-acoes-contratos"><button class="cx-btn forte" data-quadro-novo="${chave}" ${pode ? '' : 'disabled'} title="${pode ? '' : 'Só o Marcos e o Gustavo criam e editam'}">+ Nov${chave === 'atividades' ? 'a' : 'o'} ${NOME_ITEM[chave]}</button><button class="cx-btn" data-quadro-exportar="${chave}">Exportar planilha</button></div>`; };
  const COLUNAS_EDITAVEIS = ['text', 'numbers', 'status', 'color', 'date', 'timeline', 'people', 'long_text', 'dropdown', 'email', 'phone', 'link'];
  function campoColuna(c, v){
    const id = 'cxQc_' + c.id, val = String(v ?? '');
    if (['status', 'color'].includes(c.tipo)) return `<label class="cx-campo">${esc(c.titulo)}<select id="${id}"><option value="">—</option>${[...(val && !Object.keys(c.cores || {}).includes(val) ? [val] : []), ...Object.keys(c.cores || {})].map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (c.tipo === 'numbers') return `<label class="cx-campo">${esc(c.titulo)}<input id="${id}" inputmode="decimal" value="${esc(val)}" autocomplete="off"></label>`;
    if (c.tipo === 'date') return `<label class="cx-campo">${esc(c.titulo)}<input type="date" id="${id}" value="${esc(val.slice(0, 10))}"></label>`;
    if (c.tipo === 'timeline'){ const [a, b] = val.split(' - '); return `<div class="cx-campo">${esc(c.titulo)}<div class="cx-duas"><label class="cx-campo">Início<input type="date" id="${id}_ini" value="${esc((a || '').slice(0, 10))}"></label><label class="cx-campo">Fim<input type="date" id="${id}_fim" value="${esc((b || '').slice(0, 10))}"></label></div></div>`; }
    return `<label class="cx-campo">${esc(c.titulo)}<input id="${id}" value="${esc(val)}" autocomplete="off"></label>`;
  }
  function valorCampo(c){
    if (c.tipo === 'timeline'){ const a = $('#cxQc_' + c.id + '_ini').value, b = $('#cxQc_' + c.id + '_fim').value; return a || b ? `${a || b} - ${b || a}` : ''; }
    let v = ($('#cxQc_' + c.id)?.value || '').trim();
    if (c.tipo === 'numbers' && v){ const n = numeroBR(v); if (!isNaN(n)) v = String(n); }
    return v;
  }
  function abrirItemQuadro(chave, id){
    const P = dadosQuadro(chave); if (!P?.quadro) return aviso('Quadro ainda não carregado.');
    const item = id ? P.itens.find(i => i.item_id === id) : null, pode = podeMexerPortfolio(pessoa);
    const cols = P.quadro.colunas.filter(c => COLUNAS_EDITAVEIS.includes(c.tipo)), grupoAtual = item?.grupo_id || P.quadro.grupos[0]?.id;
    abrirDialogo((item ? 'Editar ' : (chave === 'atividades' ? 'Nova ' : 'Novo ')) + NOME_ITEM[chave] + (item ? ' · ' + item.nome : ''), `${pode ? '' : '<p class="cx-sub">Somente visualização: só o Marcos e o Gustavo criam e editam.</p>'}
      <label class="cx-campo">Nome<input id="cxQcNome" value="${esc(item?.nome || '')}" autocomplete="off"></label>
      <label class="cx-campo">Grupo<select id="cxQcGrupo">${P.quadro.grupos.map(g => `<option value="${esc(g.id)}"${grupoAtual === g.id ? ' selected' : ''}>${esc(g.titulo)}</option>`).join('')}</select></label>
      <div class="cx-campos-quadro">${cols.map(c => campoColuna(c, item?.valores?.[c.id]?.t)).join('')}</div>
      <div class="cx-acoes"><button class="cx-btn forte" data-quadro-salvar="${chave}|${esc(id || '')}" ${pode ? '' : 'disabled'}>${item ? 'Salvar alterações' : 'Criar ' + NOME_ITEM[chave]}</button></div>`);
    if (!pode) $$('#cxModal input, #cxModal select').forEach(el => { el.disabled = true; });
    $('#cxQcNome').focus();
  }
  function exportarQuadro(chave){
    const P = dadosQuadro(chave); if (!P?.quadro) return aviso('Nada para exportar.');
    const cols = P.quadro.colunas.filter(c => !['name', 'subtasks'].includes(c.tipo)), grupoNome = new Map(P.quadro.grupos.map(g => [g.id, g.titulo]));
    const ordem = new Map(P.quadro.grupos.map((g, i) => [g.id, i]));
    const itens = [...P.itens].sort((a, b) => (ordem.get(a.grupo_id) ?? 99) - (ordem.get(b.grupo_id) ?? 99) || a.ordem - b.ordem);
    const linhas = itens.map(i => Object.assign({ Grupo:grupoNome.get(i.grupo_id) || i.grupo_nome || '', Nome:i.nome }, Object.fromEntries(cols.map(c => { const t = i.valores?.[c.id]?.t ?? ''; return [c.titulo, c.tipo === 'numbers' && t !== '' && !isNaN(Number(t)) ? Number(t) : t]; }))));
    const nome = `${String(P.quadro.nome || chave).replace(/[\\/:*?"<>|]+/g, '').trim()} - ${new Date().toISOString().slice(0, 10)}`;
    if (window.XLSX){ const ws = XLSX.utils.json_to_sheet(linhas), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, String(P.quadro.nome || chave).slice(0, 31)); XLSX.writeFile(wb, nome + '.xlsx'); }
    else {
      const cab = Object.keys(linhas[0] || { Grupo:'', Nome:'' }), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const blob = new Blob(['﻿' + [cab.map(q).join(';'), ...linhas.map(l => cab.map(k => q(l[k])).join(';'))].join('\n')], { type:'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    aviso(`Planilha exportada: ${linhas.length} linha(s).`);
  }
  document.addEventListener('click', async e => {
    const novo = e.target.closest?.('[data-quadro-novo]'); if (novo) return abrirItemQuadro(novo.dataset.quadroNovo, null);
    const ed = e.target.closest?.('[data-quadro-editar]'); if (ed){ const [ch, id] = ed.dataset.quadroEditar.split('|'); return abrirItemQuadro(ch, id); }
    const ex = e.target.closest?.('[data-quadro-exportar]'); if (ex) return exportarQuadro(ex.dataset.quadroExportar);
    const sv = e.target.closest?.('[data-quadro-salvar]'); if (!sv) return;
    if (!podeMexerPortfolio(pessoa)) return aviso('Só o Marcos e o Gustavo criam e editam.');
    const [chave, id] = sv.dataset.quadroSalvar.split('|'), P = dadosQuadro(chave);
    const nome = $('#cxQcNome').value.trim(); if (!nome) return aviso('Informe o nome.');
    const valores = {}; for (const c of P.quadro.colunas.filter(c => COLUNAS_EDITAVEIS.includes(c.tipo))) valores[c.id] = { t:valorCampo(c) };
    sv.disabled = true;
    try { await D.salvarItemQuadro(chave, id || null, { grupo:$('#cxQcGrupo').value, nome, valores }); fechar(); desenhar(); aviso(id ? 'Alterações salvas.' : CRIADO[chave]); }
    catch (erro) { sv.disabled = false; aviso(erro.message); }
  });
  if (!document.getElementById('cxQuadrosEstilo')){ const st = document.createElement('style'); st.id = 'cxQuadrosEstilo';
    st.textContent = '.cx-campos-quadro{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.cx-campos-quadro .cx-campo{margin:10px 0}@media(max-width:700px){.cx-campos-quadro{grid-template-columns:1fr}}';
    document.head.appendChild(st); }
