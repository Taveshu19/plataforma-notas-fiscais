// Adaptador de produção da Engenharia (16/11/2026): Aprovações e Contratos ligados ao banco REAL da Engenharia.
// Derivado do adaptador da Expansão, sem Compras, Projetos, Portfólio e Atividades. Lê o banco com o login de quem está no painel;
// as permissões valem no servidor (RLS). No banco, a equipe 'expansao' significa "engenheiros" (o painel mostra "Engenharia").
// Pagador, Categoria e Endereço da obra são preenchidos na análise (colunas próprias da Engenharia).
(function(){
  'use strict';
  /* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */
  const cliente = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
  const PERFIL = { admin:'admin', administrativo:'equipe', expansao:'engenharia', tag:'tag' };   // 'tag' = Otávio e BO: só a aba Administrativo (TAG)
  const avisos = [];
  const monEtapa = new Map();   // etapa de cada nota na Monday; a análise do painel só vale enquanto a Monday a mantém na engenharia
  const estado = { lancamentos:[], fluxo:{}, PESSOAS:[], contratos:[] };
  let pessoa = null;

  const conferir = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  // Arquivo que está na Monday: a função arquivo-monday busca na hora (o link da Monday expira) e só entrega se a pessoa pode ver a nota/contrato.
  async function lerDaMonday(assetId){
    const sessao = (await cliente.auth.getSession()).data.session;
    if (!sessao) throw new Error('Entre novamente para ver este arquivo.');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/arquivo-monday`, { method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + sessao.access_token, apikey:SUPABASE_ANON_KEY }, body:JSON.stringify({ asset_id:assetId }) });
    if (!r.ok){ const j = await r.json().catch(() => ({})); throw new Error(j.erro || 'Não foi possível abrir o arquivo da Monday.'); }
    return r.blob();
  }
  // Busca em lotes de 4 páginas ao mesmo tempo (o espelho tem mais de mil linhas; uma página por vez deixava a entrada lenta).
  async function todas(consulta){
    // 19/11/2026 (painel lento): tabela pequena (contratos, anexos…) vem num pedido só; as grandes seguem em lotes de 4 páginas.
    const primeira = conferir(await consulta().range(0, 999));
    if (primeira.length < 1000) return primeira;
    const linhas = [...primeira], LOTE = 4;
    for (let de = 1000; ; de += 1000 * LOTE){
      const partes = (await Promise.all(Array.from({ length:LOTE }, (_, i) => consulta().range(de + i * 1000, de + i * 1000 + 999)))).map(conferir);
      for (const parte of partes){ linhas.push(...parte); if (parte.length < 1000) return linhas; }
    }
  }
  // 19/11/2026 (André: "o painel está travando"): cada tela aberta relia TUDO a cada minuto, inclusive o que quase não muda
  // (cópia e histórico da Monday, tamanho dos arquivos: ~1 s de banco por leitura). Agora isso é lido uma vez e reaproveitado:
  // a cópia da Monday é relida quando o tempo real avisa mudança nela; histórico e tamanhos, a cada 30 minutos.
  const GUARDADO = new Map();
  async function guardado(chave, minutos, ler){
    const g = GUARDADO.get(chave);
    if (g && Date.now() - g.em < minutos * 60000) return g.dados;
    const dados = await ler(); GUARDADO.set(chave, { em:Date.now(), dados }); return dados;
  }
  const quando = v => new Date(v).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  const fornecedorDoNome = nome => String(nome || '—').replace(/\s*-\s*NOTA\b.*$/i, '').trim() || '—';

  // ---- Esqueci minha senha (16/11/2026) ----
  // O botão pede à função recuperar-senha um e-mail com o link de troca (enviado pela caixa da escrituração).
  // Quem abre o link chega com ?recuperar=<token>: o painel pede a nova senha, confirma o token (verifyOtp) e grava a senha.
  function ligarEsqueci(){
    const b = document.getElementById('gateEsqueci'), recado = document.getElementById('gateRecado');
    if (!b || !recado || b.dataset.ligado) return;
    b.dataset.ligado = '1';
    b.addEventListener('click', async () => {
      const campo = document.getElementById('loginEmail'), email = (campo?.value || '').trim().toLowerCase();
      const erro = document.getElementById('loginErro'); if (erro) erro.textContent = '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ recado.textContent = 'Digite o seu e-mail no campo acima e clique de novo em "Esqueci minha senha".'; campo?.focus(); return; }
      b.disabled = true; recado.textContent = 'Enviando…';
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/recuperar-senha`, { method:'POST', headers:{ 'Content-Type':'application/json', apikey:SUPABASE_ANON_KEY }, body:JSON.stringify({ email }) });
        recado.textContent = `Se ${email} tiver acesso ao painel, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o lixo eletrônico. O link vale por 1 hora.`;
      } catch (e) { recado.textContent = 'Não foi possível pedir agora. Verifique a internet e tente de novo.'; }
      finally { setTimeout(() => { b.disabled = false; }, 30000); }
    });
  }
  function telaNovaSenha(token){
    const fundo = document.createElement('div');
    fundo.id = 'cxNovaSenha';
    fundo.setAttribute('style', 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgb(10 14 20 / .82);padding:16px;font:14px/1.5 system-ui,sans-serif');
    const campo = id => `<input type="password" id="${id}" autocomplete="new-password" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #c9d1dc;border-radius:6px;font:inherit">`;
    fundo.innerHTML = `<form style="width:min(420px,100%);background:#fff;color:#17202f;border-radius:10px;padding:26px" novalidate>
      <h2 style="margin:0 0 6px;font-size:22px">Criar nova senha</h2>
      <p style="margin:0 0 16px;color:#596473">Escolha uma senha com pelo menos 8 caracteres.</p>
      <label style="display:block;margin-bottom:10px">Nova senha${campo('cxNs1')}</label>
      <label style="display:block;margin-bottom:10px">Repita a nova senha${campo('cxNs2')}</label>
      <p id="cxNsMsg" role="status" style="min-height:20px;margin:6px 0 12px;color:#ae202b"></p>
      <button type="submit" style="width:100%;padding:10px;border:0;border-radius:6px;background:#b94a0b;color:#fff;font:inherit;cursor:pointer">Salvar nova senha</button>
    </form>`;
    document.body.appendChild(fundo);
    const msg = fundo.querySelector('#cxNsMsg'), botao = fundo.querySelector('button');
    fundo.querySelector('#cxNs1').focus();
    fundo.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const s1 = fundo.querySelector('#cxNs1').value, s2 = fundo.querySelector('#cxNs2').value;
      if (s1.length < 8){ msg.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
      if (s1 !== s2){ msg.textContent = 'As duas senhas não são iguais.'; return; }
      botao.disabled = true; msg.style.color = '#596473'; msg.textContent = 'Salvando…';
      try {
        const v = await cliente.auth.verifyOtp({ type:'recovery', token_hash:token });
        if (v.error) throw new Error('Este link expirou ou já foi usado. Peça outro em "Esqueci minha senha".');
        const u = await cliente.auth.updateUser({ password:s1, data:{ precisa_trocar_senha:false } });
        if (u.error) throw new Error(/weak|easy to guess|pwned|leaked/i.test(u.error.message) ? 'Essa senha é muito comum (aparece em listas de senhas vazadas) e o sistema não aceita. Escolha outra, por exemplo uma frase curta com números, como Notas-da-Tag-2026.' : /same|different/i.test(u.error.message) ? 'A nova senha precisa ser diferente da anterior.' : /at least/i.test(u.error.message) ? 'A senha precisa ter pelo menos 8 caracteres.' : u.error.message);
        msg.style.color = '#1b7a3d'; msg.textContent = 'Senha alterada. Abrindo o painel…';
        setTimeout(() => location.replace(location.pathname), 1200);
      } catch (erro) { msg.style.color = '#ae202b'; msg.textContent = erro.message; botao.disabled = false; }
    });
  }
  const tokenRecuperacao = new URLSearchParams(location.search).get('recuperar');
  if (tokenRecuperacao){ history.replaceState(null, '', location.pathname); telaNovaSenha(tokenRecuperacao); }
  ligarEsqueci(); document.addEventListener('DOMContentLoaded', ligarEsqueci);

  // 19/11/2026 (painel lento): depois de uma ação da própria pessoa, relê tudo o que muda; pelo tempo real e pela checagem de 1 minuto, usa o
  // que está guardado e busca só o que mudou (a nota alterada, os lançamentos novos). Antes, cada mudança de qualquer pessoa fazia todas as
  // telas abertas relerem todas as tabelas (30 a 40 pedidos ao banco por mudança).
  const notasMudadas = new Set();
  const invalidarMutaveis = () => { for (const k of ['lancs', 'analises', 'contratos', 'anexos', 'extras']) GUARDADO.delete(k); notasMudadas.clear(); };
  async function analisesAtuais(){
    const g = GUARDADO.get('analises');
    if (g && Date.now() - g.em < 5 * 60000){
      if (!notasMudadas.size) return g.dados;
      const ids = [...notasMudadas]; notasMudadas.clear();
      const novas = [];
      for (let i = 0; i < ids.length; i += 100) novas.push(...conferir(await cliente.from('aprovacoes_notas').select('*').in('nota_id', ids.slice(i, i + 100))));
      const porId = new Map(g.dados.map(x => [x.nota_id, x])); for (const id of ids) porId.delete(id); for (const x of novas) porId.set(x.nota_id, x);
      g.dados = [...porId.values()];
      return g.dados;
    }
    notasMudadas.clear();
    return guardado('analises', 5, () => todas(() => cliente.from('aprovacoes_notas').select('*').order('nota_id')));
  }
  const GUARDADO_DA_TABELA = { aprovacoes_anexos:'anexos', contratos:'contratos', monday_espelho:'espelho', compras_requisicoes:'compras', compras_anexos:'compras', compras_historico:'compras', compras_avisos:'compras' };
  function mudouNoBanco(tabela, payload){
    if (tabela === 'aprovacoes_notas'){
      const novo = payload?.new?.nota_id, velho = payload?.old?.nota_id;
      if (novo) notasMudadas.add(novo);
      if (velho) notasMudadas.add(velho);
      if (!novo && !velho) GUARDADO.delete('analises');
    } else if (GUARDADO_DA_TABELA[tabela]) GUARDADO.delete(GUARDADO_DA_TABELA[tabela]);
  }
  async function carregarAprovacoes(){ invalidarMutaveis(); return carregarAprovacoesLeve(); }
  async function carregarAprovacoesLeve(){
    if (!['admin','equipe','engenharia'].includes(pessoa.perfil)) return;
    const [espelho, lancs, eventos, analiseBanco, contratosBanco, tamanhos] = await Promise.all([
      guardado('espelho', 10, () => todas(() => cliente.from('monday_espelho').select('item_id,board_nome,grupo_nome,etapa,nome,documento,unidade,natureza,valor,narrativa,contrato,expansao,pedido,status,emissao,vencimento,data_envio,codigo_emitente,lancamento_id,atualizado_monday,cnpj,arquivos,pagador,categoria,endereco,cod_fornecedor,criacao_pedido,aprovacao_pedido,pre_nota,envio_fiscal,motivo_reprovacao').neq('etapa','excluida').order('item_id'))),
      guardado('lancs', 5, () => todas(() => cliente.from('lancamentos').select('id,nf,fornecedor,unidade,natureza,valor,emissao,vencimento,pagamento,cnpj_fornecedor,arquivo_nf_nome,arquivo_nf_path,arquivo_boleto_nome,arquivo_boleto_path,criado_em,atualizado_em,monday_item_id,banco,agencia,conta_corrente,chave_pix,pagador,categoria,endereco,data_recebimento,codigo_fornecedor').eq('status','Enviado').order('id'))),
      guardado('eventos', 30, () => todas(() => cliente.from('monday_espelho_eventos').select('item_id,quando,descricao').in('tipo',['create_pulse','move_pulse_from_group','move_pulse_from_board','delete_pulse','archive_pulse']).order('id'))),
      analisesAtuais(),
      guardado('contratos', 5, () => todas(() => cliente.from('contratos').select('*').order('nome'))),
      guardado('tamanhos', 30, () => cliente.rpc('lancamento_arquivos_tamanhos').then(r => r.error ? [] : (r.data || []))),   // sem a função, só não deduplica pelo tamanho
    ]);
    // 19/11/2026: o 2º boleto (ou mais) vinculado no lançamento fica em arquivos_processados; antes só o 1º aparecia e ia no envio.
    const extrasLanc = new Map();
    try {
      (await guardado('extras', 5, () => todas(() => cliente.from('arquivos_processados').select('id,lancamento_id,nome_arquivo,path_storage,hash,criado_em').eq('tipo','BOLETO').not('lancamento_id','is',null).order('id')))).forEach(a => {
        if (!a.path_storage) return;
        if (!extrasLanc.has(a.lancamento_id)) extrasLanc.set(a.lancamento_id, []);
        extrasLanc.get(a.lancamento_id).push(a);
      });
    } catch (_) { /* sem permissão de leitura: segue só com o boleto principal */ }
    // Anexos incluídos no painel (administrativo): ficam junto dos arquivos da nota.
    const anexosNota = new Map();
    (await guardado('anexos', 5, () => todas(() => cliente.from('aprovacoes_anexos').select('*').order('em')))).forEach(x => {
      if (!anexosNota.has(x.nota_id)) anexosNota.set(x.nota_id, []);
      anexosNota.get(x.nota_id).push({ id:'anx-' + x.id, nome:x.nome, bucket:'documentos', caminho:x.caminho, tamanho:x.tamanho || null, por:x.por_nome || 'Painel', em:x.em, anexoPainel:x.id });
    });
    const tamanhoLanc = new Map(tamanhos.map(t => [t.lancamento_id + '|' + t.tipo, Number(t.tamanho)]));
    const porLanc = new Map(lancs.map(l => [l.id, l])), usados = new Set(), hist = new Map();
    for (const e of eventos){ if (!hist.has(e.item_id)) hist.set(e.item_id, []); hist.get(e.item_id).push(`${quando(e.quando)} · ${e.descricao}`); }
    const analises = new Map(analiseBanco.map(x => [x.nota_id, x])), idDoItem = new Map(); monEtapa.clear();
    const arquivoMonday = (a, em) => a.bucket ? { id:a.id, nome:a.nome || 'Arquivo', bucket:a.bucket, caminho:a.caminho, tamanho:a.tamanho || null, por:a.por || 'Painel', em:a.em || em }
      : { id:'mon-' + a.id, nome:a.nome || 'Arquivo', monday:String(a.id), tamanho:a.tamanho || null, por:'Monday', em };
    // Arquivos de uma nota = os do lançamento (guardados aqui) + os do item na Monday (buscados na hora). Mesmo tamanho = mesmo arquivo, uma vez só.
    const arquivosDe = (l, m) => {
      const doLancamento = [
        ...(l?.arquivo_nf_path ? [{ id:'nf-' + l.id, nome:l.arquivo_nf_nome || 'Nota fiscal', caminho:l.arquivo_nf_path, bucket:'documentos', tamanho:tamanhoLanc.get(l.id + '|nf') || null, por:'Lançamento', em:l.criado_em }] : []),
        ...(l?.arquivo_boleto_path ? [{ id:'bol-' + l.id, nome:l.arquivo_boleto_nome || 'Boleto', caminho:l.arquivo_boleto_path, bucket:'documentos', tamanho:tamanhoLanc.get(l.id + '|boleto') || null, por:'Lançamento', em:l.criado_em }] : []),
      ];
      // Boletos extras do lançamento (2º boleto da mesma nota), sem repetir o principal.
      for (const a of (l ? extrasLanc.get(l.id) || [] : [])) if (![l.arquivo_nf_path, l.arquivo_boleto_path, ...doLancamento.map(x => x.caminho)].includes(a.path_storage))
        doLancamento.push({ id:'bolx-' + a.id, nome:a.nome_arquivo || 'Boleto', caminho:a.path_storage, bucket:'documentos', tamanho:null, por:'Lançamento', em:a.criado_em || l.criado_em });
      const nomesLanc = new Set(doLancamento.map(x => String(x.nome || '').toLowerCase()));
      const jaUsado = new Set();
      const daMonday = (m?.arquivos || []).filter(a => {
        if (nomesLanc.has(String(a.nome || '').toLowerCase())) return false;   // mesmo nome = mesma cópia do lançamento
        const igual = doLancamento.find(x => x.tamanho && Number(a.tamanho) === x.tamanho && !jaUsado.has(x.id));
        if (igual){ jaUsado.add(igual.id); return false; }
        return true;
      });
      return [...doLancamento, ...daMonday.map(a => arquivoMonday(a, m.atualizado_monday))];
    };
    // 19/11/2026: arquivo removido da nota ("Remover da nota") sai da lista e vai para "Removidos da nota" (dá para devolver).
    const chaveArquivo = a => a.caminho || (a.monday ? 'monday:' + a.monday : String(a.id));
    const arquivosDaNota = (id, lista) => { const fora = new Set((analises.get(id)?.arquivos_ocultos || []).map(String));
      return { arquivos:lista.filter(a => !fora.has(chaveArquivo(a))), arquivosRemovidos:lista.filter(a => fora.has(chaveArquivo(a))) }; };
    const lancamentos = [], fluxo = {};
    const incluir = (id, l, m, etapa, historico) => {
      const an = analises.get(id);
      const ov = an?.campos || {};   // correções feitas no painel (administrativo) valem sobre os dados originais
      lancamentos.push({ id, status:'Enviado', nf: ov.nf ?? (l?.nf || m?.documento || '—'), fornecedor: ov.fornecedor ?? (l?.fornecedor || fornecedorDoNome(m?.nome)),
        unidade: ov.unidade ?? (l?.unidade || m?.unidade || '—'), natureza: ov.natureza ?? (l?.natureza || m?.natureza || '—'), valor: ov.valor != null ? Number(ov.valor) : (l?.valor ?? m?.valor ?? null),
        emissao: ov.emissao ?? (l?.emissao || m?.emissao || null), vencimento: ov.vencimento ?? (l?.vencimento || m?.vencimento || null), pagamento: ov.pagamento ?? (l?.pagamento || '—'),
        cnpj_fornecedor: ov.cnpj_fornecedor ?? (l?.cnpj_fornecedor || m?.cnpj || '—'),
        // Dados bancários (17/11/2026, igual à Expansão): se a correção limpou o campo, vale vazio (não volta o valor do lançamento).
        banco: 'banco' in ov ? (ov.banco || '') : (l?.banco || ''), agencia: 'agencia' in ov ? (ov.agencia || '') : (l?.agencia || ''),
        conta_corrente: 'conta_corrente' in ov ? (ov.conta_corrente || '') : (l?.conta_corrente || ''), chave_pix: 'chave_pix' in ov ? (ov.chave_pix || '') : (l?.chave_pix || ''),
        // 19/11/2026: Data de recebimento (do lançamento) e Cód. Fornecedor (correção do painel > lançamento > Monday), como colunas do quadro.
        dataRecebimento: l?.data_recebimento || null,
        codigo_emitente: ov.codigo_emitente ?? (l?.codigo_fornecedor || m?.cod_fornecedor || m?.codigo_emitente || ''),
        ...arquivosDaNota(id, [...arquivosDe(l, m), ...(anexosNota.get(id) || [])]),
        monday:m ? { board_nome:m.board_nome, grupo_nome:m.grupo_nome, status:m.status, data_envio:m.data_envio, atualizado:m.atualizado_monday,
          criacao_pedido:m.criacao_pedido, aprovacao_pedido:m.aprovacao_pedido, pre_nota:m.pre_nota, envio_fiscal:m.envio_fiscal, motivo_reprovacao:m.motivo_reprovacao } : {} });
      // Pagador, Categoria, Endereço e Cód. Fornecedor: o preenchido no painel vale; senão, o que está na Monday.
      fluxo[id] = { etapa, narrativa:m?.narrativa || '', contrato:m?.contrato || '', expansao:m?.expansao || '', pedido:m?.pedido || '', emitente:m?.codigo_emitente || '', historico, historicoMonday:historico, vinculo:null, versao:null,
        pagador:an?.pagador || l?.pagador || m?.pagador || '', categoria:an?.categoria || l?.categoria || m?.categoria || '', endereco:an?.endereco_obra || l?.endereco || m?.endereco || '', cod_fornecedor:ov.codigo_emitente || l?.codigo_fornecedor || m?.cod_fornecedor || m?.codigo_emitente || '',
        // 19/11/2026: o que veio do lançamento (ou da Monday), para não sumir da tela quando a análise salva outro campo.
        orig:{ pagador:l?.pagador || m?.pagador || '', categoria:l?.categoria || m?.categoria || '', endereco:l?.endereco || m?.endereco || '' } };
      monEtapa.set(id, m ? m.etapa : null);
      if (an){
        Object.assign(fluxo[id], { narrativa:an.narrativa || m?.narrativa || '', contrato:an.contrato || m?.contrato || '', expansao:an.expansao || m?.expansao || '', versao:an.versao, decisao:an.decisao || null, historico:[...historico, ...(an.historico || [])] });
        fluxo[id].etapa = an.etapa;   // a etapa do painel vale (a Monday não é mais usada)
        fluxo[id].pedido = ov.pedido || an.pedido || fluxo[id].pedido; fluxo[id].contratoRef = an.contrato_ref || null;
        // Data de envio gravada pelo botão Enviar para escriturar (17/11/2026); substitui a da Monday.
        if (an.data_envio){ const ln = lancamentos[lancamentos.length - 1]; if (ln && ln.id === id) ln.dataEnvio = an.data_envio; }
        // Devolvida e reenviada pelo lançamento (Enviado de novo, alterado depois da devolução): volta para a engenharia. O banco aplica a mesma regra.
        if (an.etapa === 'devolvida' && l && Date.parse(l.atualizado_em) > Date.parse(an.atualizado_em)){ fluxo[id].etapa = 'engenharia'; fluxo[id].historico.push('Reenviada pelo lançamento · volta para a engenharia'); }
      }
    };
    for (const m of espelho){
      const l = m.lancamento_id ? porLanc.get(m.lancamento_id) : null;
      if (l) usados.add(l.id);
      // Nota devolvida ao lançamento (lançamento "Pendente") continua com o mesmo id do lançamento, para manter a análise e o histórico dela.
      const idNota = l ? l.id : (m.lancamento_id || 'M' + m.item_id);
      idDoItem.set(String(m.item_id), idNota);
      incluir(idNota, l, m, m.etapa, hist.get(m.item_id) || ['Importada da Monday']);
    }
    // Enviada pelo lançamento e ainda não vista na Monday: entra na engenharia se for recente.
    const recente = Date.now() - 2 * 864e5;
    for (const l of lancs){
      if (usados.has(l.id)) continue;
      // A partir de 16/11/2026 a Monday não recebe mais as notas: toda nota enviada pelo lançamento fica no painel e permanece em Aprovações.
      if (new Date(l.criado_em).getTime() <= recente && new Date(l.criado_em).getTime() < Date.parse('2026-11-16T00:00:00-03:00')) continue;
      // 19/11/2026 (Gustavo): Remessa não passa por análise, pedido nem aprovação: vai direto para a Escrituração (o banco grava isso no envio).
      incluir(l.id, l, null, l.natureza === 'Remessa' ? 'escrituracao' : 'engenharia', ['Enviada pelo lançamento']);
    }
    estado.lancamentos = lancamentos; estado.fluxo = fluxo;
    // 19/11/2026: endereços digitados como "novo endereço" (no lançamento ou na análise) entram na lista de todos.
    window.__enderecosExtras = [...new Set([...lancs.map(l => l.endereco), ...analiseBanco.map(a => a.endereco_obra)].map(v => String(v || '').trim()).filter(Boolean))];
    estado.contratos = contratosBanco.map(c => ({ id:c.item_id, origem:c.origem || 'monday', criadoEm:c.criado_em || null, nome:c.nome || '—', grupo:c.grupo_nome || '', unidade:c.unidade || '', tipologia:c.tipologia || '', tipo:c.tipo || '', status:c.status || '', aprovador:c.aprovador || '', referencia:c.referencia || '', narrativa:c.narrativa || '', valorFechado:Number(c.valor_fechado || 0), pagoHistorico:Number(c.pago_historico || 0), aceite:c.aceite, cnpj:c.cnpj || '', inclusao:c.inclusao, aditivos:c.aditivos || [], notas:(c.notas || []).map(n => idDoItem.get(String(n))).filter(Boolean), subitens:(c.subitens || []).map(s => ({ ...s, lista:(s.lista || []).map(a => arquivoMonday(a, c.atualizado_monday)) })), arquivos:(c.arquivos_itens || []).map(a => arquivoMonday(a, c.atualizado_monday)) }));
  }

  // 18/11/2026 (Gustavo): processo da TAG. Nota com Pagador Tag que chega à Escrituração (aprovação da Beatriz) vai na hora para o
  // painel da TAG, aba "Otávio - Aprovação", como "Em analise". Não espera mais o botão "Enviar para escriturar".
  // Vão para a TAG: só Pagador Tag. 19/11/2026 (Gustavo): Remessa NÃO vai para a TAG; fica na Escrituração da Engenharia.
  const ehTag = notaId => /^tag$/i.test(String(estado.fluxo[notaId]?.pagador || '').trim()) && estado.lancamentos.find(n => n.id === notaId)?.natureza !== 'Remessa';
  async function mandarParaTag(notaId){
    try { await cliente.functions.invoke('escriturar-painel', { body:{ nota_id:notaId, preparar:true } }); } catch (_) { /* segue com o que já estiver copiado */ }
    conferir(await cliente.rpc('tag_receber_nota', { p_nota:notaId }));
  }
  async function paraTagSeAprovada(notaId, r){
    if (!r || r.etapa !== 'escrituracao' || !ehTag(notaId)) return r;
    await mandarParaTag(notaId);
    return { ...r, etapa:'encaminhada', historico:[...(r.historico || []), 'Enviada ao painel da TAG (Otávio - Aprovação, em análise)'] };
  }
  // Notas Tag que já estavam paradas na Escrituração: vão para a TAG quando a equipe administrativa abre o painel.
  async function enviarTagPendentes(){
    if (!['admin','equipe'].includes(pessoa?.perfil)) return 0;
    const ids = Object.keys(estado.fluxo).filter(id => estado.fluxo[id].etapa === 'escrituracao' && ehTag(id));
    let n = 0; for (const id of ids){ try { await mandarParaTag(id); n++; } catch (e) { console.warn('TAG', id, e.message); } }
    if (n) await carregarAprovacoes();
    return n;
  }
  // Resultado de uma gravação da análise, já no formato que a tela usa. Também atualiza Pagador, Categoria e Endereço da nota.
  function resultadoAnalise(notaId, r){
    const f = estado.fluxo[notaId] || {}, mon = monEtapa.get(notaId);
    const terminal = ['encaminhada','fiscal','arquivada','cancelada'].includes(mon);
    // 19/11/2026 (Beatriz/Camila): campo da análise ainda vazio mostra o que veio do lançamento (antes sumia ao salvar outro campo e era preenchido de novo).
    const o = f.orig || {};
    if (estado.fluxo[notaId]) Object.assign(estado.fluxo[notaId], { pagador:r.pagador || o.pagador || '', categoria:r.categoria || o.categoria || '', endereco:r.endereco_obra || o.endereco || '' });
    return { etapa:r.etapa, narrativa:r.narrativa || '', contrato:r.contrato || '', expansao:r.expansao || '', pedido:r.pedido || '', contratoRef:r.contrato_ref || null, versao:r.versao, decisao:r.decisao ?? null, historico:[...(f.historicoMonday || []), ...(r.historico || [])] };
  }

  window.ExpansaoDados = {
    modoValidacao: true,
    get PESSOAS(){ return estado.PESSOAS; },
    get lancamentos(){ return estado.lancamentos; },
    get fluxo(){ return estado.fluxo; },
    get requisicoes(){ return []; },   // a Engenharia não tem Compras (16/11/2026): sem esta propriedade a tela de Aprovações falhava
    get contratos(){ return estado.contratos; },
    // Contratos são editados no painel (só o Marcos: o banco confere) e exigem o contrato do aditivo.
    async criarContrato(d){
      const r = conferir(await cliente.rpc('contratos_criar', { p_nome:d.nome, p_tipo:d.tipo, p_unidade:d.unidade, p_valor:d.valorFechado, p_aceite:d.aceite || null, p_cnpj:d.cnpj || null, p_referencia:d.referencia || null, p_tipologia:d.tipologia || null, p_aprovador:d.aprovador || null }));
      await carregarAprovacoes();
      return { id:r.item_id };
    },
    async criarAditivo(contratoId, d, descricao){
      const r = conferir(await cliente.rpc('contratos_criar_aditivo', { p_contrato:contratoId, p_descricao:descricao || null, p_valor:d.valorFechado, p_aceite:d.aceite || null }));
      await carregarAprovacoes();
      return { id:r.item_id };
    },
    async anexarContrato(contratoId, arquivo, recarregar = true){
      const caminho = `${contratoId}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
      conferir(await cliente.storage.from('contratos').upload(caminho, arquivo, { contentType:arquivo.type || undefined }));
      const r = await cliente.rpc('contratos_registrar_arquivo', { p_contrato:contratoId, p_nome:arquivo.name, p_caminho:caminho, p_tamanho:arquivo.size });
      if (r.error){ await cliente.storage.from('contratos').remove([caminho]); throw new Error(r.error.message); }
      if (recarregar) await carregarAprovacoes();
    },
    async recarregarContratos(){ await carregarAprovacoes(); },
    async excluirContrato(id){ const nome = conferir(await cliente.rpc('contratos_excluir', { p_id:id })); await carregarAprovacoes(); return nome; },
    async editarContrato(id, d){
      conferir(await cliente.rpc('contratos_editar', { p_id:id, p_nome:d.nome, p_tipo:d.tipo, p_unidade:d.unidade, p_valor:d.valorFechado, p_status:d.status, p_aceite:d.aceite || null,
        p_cnpj:d.cnpj || null, p_referencia:d.referencia || null, p_tipologia:d.tipologia || null, p_aprovador:d.aprovador || null, p_contrato_pai:d.contratoPai || null }));
      await carregarAprovacoes();
    },
    cliente,
    salvar(){ /* nada local para gravar: cada ação vai ao banco */ },
    aoMudar: fn => avisos.push(fn),
    arquivos: {
      ler: async a => {
        if (a.monday) return lerDaMonday(a.monday);
        const r = await cliente.storage.from(a.bucket || 'documentos').download(a.caminho); if (r.error) throw new Error(r.error.message); return r.data;
      },
      guardar: async () => { throw new Error('Anexar arquivos a notas não é feito por aqui.'); },
      apagar: async () => {},
    },
    // Mesmo envio do botão Enviar da Monday, pedido pelo servidor com a permissão de quem clicou.
    // Envio em lote por base (18/11/2026): simular=true só mostra o que sairia; simular=false envia (uma tabela por base).
    async enviarLote(base, simular, excluir){
      const r = await cliente.functions.invoke('escriturar-painel', { body:{ lote:base, simular:!!simular, excluir:Array.isArray(excluir) ? excluir : [] } });
      if (r.error){ let msg = r.error.message; try { msg = (await r.error.context.json()).erro || msg; } catch (_) { /* mantém */ } throw new Error(msg); }
      return r.data;
    },
    async escriturar(notaId, emitente){
      // Nota com Pagador Tag: em vez da escrituração, vai para o painel da TAG (pendente de aprovação do Otávio).
      if (ehTag(notaId)){
        // 18/11/2026: antes, traz para o painel os arquivos da nota que ainda só estavam na Monday (a TAG lê as cópias).
        try { await cliente.functions.invoke('escriturar-painel', { body:{ nota_id:notaId, preparar:true } }); } catch (_) { /* segue com o que já estiver copiado */ }
        conferir(await cliente.rpc('tag_receber_nota', { p_nota:notaId }));
        await carregarAprovacoes();
        return { mensagem:'Nota enviada ao painel da TAG (pendente de aprovação do Otávio). Ela já aparece lá.' };
      }
      const r = await cliente.functions.invoke('escriturar-painel', { body:{ nota_id:notaId, emitente:String(emitente || '').trim() } });
      if (r.error){ let msg = r.error.message; try { msg = (await r.error.context.json()).erro || msg; } catch (_) { /* mantém a mensagem */ } throw new Error(msg); }
      return r.data;
    },
    // Análise da engenharia (narrativa, contrato, pertence, pagador, categoria, endereço): grava no banco, sem tocar na Monday.
    analise: {
      // 19/11/2026: Cód. Fornecedor editado no quadro ou no bloco de envio grava como correção (codigo_emitente).
      async salvarCodigo(notaId, codigo, base){
        const r = resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_editar_campos', { p_nota:notaId, p_campos:{ codigo_emitente:codigo }, p_base:base })));
        const f = estado.fluxo[notaId], n = estado.lancamentos.find(x => x.id === notaId);
        if (f) f.cod_fornecedor = codigo; if (n) n.codigo_emitente = codigo;
        return r;
      },
      async salvar(notaId, campos, base){
        const r = conferir(await cliente.rpc('aprovacoes_salvar', { p_nota:notaId, p_narrativa:campos.narrativa ?? null, p_contrato:campos.contrato ?? null, p_expansao:campos.expansao ?? null, p_base:base,
          p_pagador:campos.pagador ?? null, p_categoria:campos.categoria ?? null, p_endereco:campos.endereco ?? null }));
        return resultadoAnalise(notaId, r);
      },
      async aprovar(notaId, base){ return await paraTagSeAprovada(notaId, resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_aprovar', { p_nota:notaId, p_base:base })))); },
      async vincularContrato(notaId, contratoId, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_vincular_contrato', { p_nota:notaId, p_contrato:contratoId, p_base:base }))); },
      // Devolve a nota ao painel de lançamento (volta a Pendente, com o motivo). Não toca na Monday.
      async devolver(notaId, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_devolver', { p_nota:notaId, p_motivo:motivo, p_base:base }))); },
      async editarCampos(notaId, campos, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_editar_campos', { p_nota:notaId, p_campos:campos, p_base:base }))); },
      async registrarRetorno(notaId, resultado, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_registrar_retorno', { p_nota:notaId, p_resultado:resultado, p_motivo:motivo, p_base:base }))); },
      async reabrirEscrituracao(notaId, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_reabrir_escrituracao', { p_nota:notaId, p_motivo:motivo, p_base:base }))); },
      async mover(notaId, etapa, motivo, base){ return await paraTagSeAprovada(notaId, resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_mover', { p_nota:notaId, p_etapa:etapa, p_motivo:motivo || null, p_base:base })))); },
      async anexarArquivo(notaId, arquivo, base){
        const caminho = `anexos/${notaId}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
        conferir(await cliente.storage.from('documentos').upload(caminho, arquivo, { contentType:arquivo.type || undefined }));
        const r = await cliente.rpc('aprovacoes_anexo_registrar', { p_nota:notaId, p_nome:arquivo.name, p_caminho:caminho, p_tamanho:arquivo.size });
        if (r.error){ await cliente.storage.from('documentos').remove([caminho]); throw new Error(r.error.message); }
        return true;
      },
      async removerAnexo(anexoId){ const caminho = conferir(await cliente.rpc('aprovacoes_anexo_remover', { p_id:anexoId })); await cliente.storage.from('documentos').remove([caminho]); return true; },
      async removerArquivoNota(notaId, chave, nome, remover, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_arquivo_remover', { p_nota:notaId, p_chave:chave, p_nome:nome || null, p_remover:remover !== false, p_base:base ?? null }))); },
      async semContrato(notaId, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_sem_contrato', { p_nota:notaId, p_base:base }))); },
      async registrarPedido(notaId, pedido, base){ return await paraTagSeAprovada(notaId, resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_registrar_pedido', { p_nota:notaId, p_pedido:pedido, p_base:base })))); },
      async confirmarPedido(notaId, base){ return await paraTagSeAprovada(notaId, resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_confirmar_pedido', { p_nota:notaId, p_base:base })))); },
    },
    async salvarVinculo(){ return null; },   // vínculo entre engenheiros desligado por enquanto
  };

  // ---- Primeiro acesso: a pessoa escolhe a equipe. Escolha única; só a administração corrige. ----
  function escolherEquipe(email){
    const caixa = document.createElement('div');
    caixa.id = 'cxEscolhaEquipe';
    caixa.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="cxEscolhaTitulo"><h2 id="cxEscolhaTitulo">De qual equipe você faz parte?</h2>
      <p>Esta escolha define as telas que você vai usar. Ela só pode ser alterada pela administração.</p>
      <div class="cx-escolhas">${[['expansao','Engenharia','Análise das notas em Aprovações'],['administrativo','Lançamento e aprovações','Lançamento de notas e Aprovações']]
        .map(([v, t, d]) => `<button type="button" data-equipe="${v}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
      <p class="cx-escolha-confirma" hidden></p><div class="cx-escolha-erro" role="alert"></div></section>`;
    document.body.appendChild(caixa);
    let escolhida = null;
    caixa.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.equipe){
        escolhida = b.dataset.equipe;
        caixa.querySelectorAll('[data-equipe]').forEach(x => x.setAttribute('aria-pressed', x === b));
        const c = caixa.querySelector('.cx-escolha-confirma');
        c.hidden = false; c.innerHTML = `Confirmar <b>${b.querySelector('b').textContent}</b>? <button type="button" data-confirmar>Confirmar</button>`;
        c.querySelector('[data-confirmar]').focus();
        return;
      }
      if (b.hasAttribute('data-confirmar') && escolhida){
        b.disabled = true;
        const r = await cliente.from('painel_perfis').insert({ email:String(email).toLowerCase(), equipe:escolhida, origem:'escolha no primeiro acesso' });
        if (r.error){ b.disabled = false; caixa.querySelector('.cx-escolha-erro').textContent = 'Não foi possível salvar: ' + r.error.message; return; }
        location.reload();
      }
    });
    caixa.querySelector('[data-equipe]').focus();
  }

  // Chamado pelo painel antes de carregar o lançamento. Devolve false enquanto não houver equipe.
  window.__expansaoAntes = async email => {
    const r = await cliente.rpc('painel_equipe');
    if (r.error){ alert('Não foi possível ler sua equipe: ' + r.error.message); return false; }
    if (!r.data){ escolherEquipe(email); return false; }
    // 17/11/2026 (Gustavo): Otávio e BO (equipe 'tag') usam só o painel Notas TAG. Quem é da TAG e entra por aqui vai direto para lá
    // (mesmo endereço do site: a sessão já aberta vale na TAG, sem pedir senha de novo).
    if (r.data === 'tag'){ location.replace('/tag/'); return false; }
    window.__expansaoEquipe = r.data;
    window.__expansaoSemLancamento = ['expansao', 'tag'].includes(r.data);
    return true;
  };

  // 19/11/2026 (Beatriz): no Lançamento, "＋ Adicionar novo endereço…" troca a lista por um campo de texto. Enter grava (pelo próprio
  // salvamento da lista, que trava a linha e registra no histórico); Esc desiste. O endereço novo passa a aparecer na lista de todos.
  document.addEventListener('change', e => {
    const sel = e.target;
    if (!sel.matches?.('select[data-espelho="endereco"]') || sel.value !== '__novo__') return;
    e.stopPropagation();
    const rec = (typeof LANCAMENTOS !== 'undefined' ? LANCAMENTOS : []).find(r => r.id === sel.getAttribute('data-id'));
    const anterior = rec?.endereco || '';
    const campo = document.createElement('input');
    campo.type = 'text'; campo.className = 'campo-extra-select'; campo.placeholder = 'Digite o novo endereço e tecle Enter'; campo.autocomplete = 'off';
    campo.setAttribute('aria-label', 'Novo endereço da obra'); campo.style.minWidth = '220px';
    sel.style.display = 'none'; sel.after(campo); campo.focus();
    let feito = false;
    const concluir = salvar => {
      if (feito) return; feito = true;
      const v = campo.value.trim();
      campo.remove(); sel.style.display = '';
      if (!salvar || !v){ sel.value = anterior; return; }
      if (![...sel.options].some(o => o.value === v)){ const o = document.createElement('option'); o.value = v; o.textContent = v; sel.insertBefore(o, sel.querySelector('option[value="__novo__"]')); }
      if (!(window.__enderecosExtras || []).includes(v)) (window.__enderecosExtras ||= []).push(v);
      sel.value = v; sel.focus();
      sel.dispatchEvent(new Event('change', { bubbles:true }));
    };
    campo.addEventListener('keydown', ev => { if (ev.key === 'Enter'){ ev.preventDefault(); ev.stopPropagation(); concluir(true); } else if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); concluir(false); } });
    campo.addEventListener('blur', () => concluir(true));
  }, true);

  async function carregarTudo(){ await carregarAprovacoesLeve(); }
  window.__expansaoAoEntrar = async (email, nome) => {
    pessoa = { email:String(email).toLowerCase(), nome:nome || String(email).split('@')[0], perfil:PERFIL[window.__expansaoEquipe] };
    if (['admin','engenharia','equipe'].includes(pessoa.perfil)){
      const r = await cliente.rpc('painel_engenheiros');
      estado.PESSOAS = [...(r.data || []).map(p => ({ email:p.email, nome:p.nome, perfil:'engenharia' }))];
    }
    if (!estado.PESSOAS.some(p => p.email === pessoa.email)) estado.PESSOAS.push(pessoa);
    try { await carregarTudo(); } catch (e) { alert('Erro ao carregar Aprovações: ' + e.message); }
    try { await enviarTagPendentes(); } catch (_) { /* tenta de novo na próxima abertura */ }
    window.ExpansaoUI.entrar(pessoa);
    // Tempo real (16/11/2026): quando qualquer pessoa muda uma nota, um contrato ou um anexo, a tela atualiza sozinha.
    // Não atrapalha quem está digitando ou com uma janela aberta: a atualização espera e acontece assim que a pessoa termina.
    const ocupadoAgora = () => document.hidden || !document.getElementById('cxModal').hidden || document.activeElement?.matches('input,textarea,select');
    let agendado = null;
    const atualizarTela = async () => { try { await carregarTudo(); avisos.forEach(fn => fn()); } catch (e) { /* tenta de novo na próxima mudança */ } };
    const quandoMudar = () => {
      clearTimeout(agendado);
      agendado = setTimeout(() => { if (ocupadoAgora()) { quandoMudar(); return; } atualizarTela(); }, 700);   // várias mudanças seguidas viram uma atualização
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden){ GUARDADO.delete('lancs'); GUARDADO.delete('extras'); quandoMudar(); } });
    try {
      let canal = cliente.channel('painel-tempo-real');
      for (const tabela of ['aprovacoes_notas', 'aprovacoes_anexos', 'contratos', 'monday_espelho', 'compras_requisicoes', 'compras_anexos', 'compras_historico', 'compras_avisos']) {
        canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, payload => { mudouNoBanco(tabela, payload); quandoMudar(); });
      }
      canal.subscribe();
    } catch (e) { /* sem tempo real: a rede de segurança abaixo ainda atualiza */ }
    // Rede de segurança: se o tempo real cair, a tela ainda se atualiza a cada minuto.
    // Checagem de 1 minuto: lançamentos e boletos novos; a cada 5 minutos relê tudo o que muda (rede de segurança se o tempo real cair).
    let voltas = 0;
    setInterval(() => { if (ocupadoAgora()) return; voltas++; GUARDADO.delete('lancs'); GUARDADO.delete('extras'); if (voltas % 5 === 0){ invalidarMutaveis(); GUARDADO.delete('compras'); GUARDADO.delete('projetos'); } atualizarTela(); }, 60000);
  };
})();
