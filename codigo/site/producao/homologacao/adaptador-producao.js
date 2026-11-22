// Adaptador de produção para Aprovações e Compras (09/11/2026).
// Lê o banco real com o login de quem está no painel. As permissões valem no servidor (RLS);
// esta tela só organiza o que o banco devolve.
// Período de validação: Aprovações acompanha a Monday (monday_espelho) e não move notas.
(function(){
  'use strict';
  /* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */
  const cliente = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
  const PERFIL = { admin:'admin', administrativo:'equipe', expansao:'engenharia', compras:'compras' };
  const avisos = [];
  const monEtapa = new Map();   // etapa de cada nota na Monday; a análise do painel só vale enquanto a Monday a mantém na engenharia
  const estado = { lancamentos:[], fluxo:{}, requisicoes:[], PESSOAS:[], contratos:[], projetos:null, projetosAcesso:false, portfolioAcesso:false, portfolioEdita:false };
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
  // Busca em lotes de 4 páginas ao mesmo tempo (14/11: o espelho tem ~4 mil linhas; uma página por vez deixava a entrada lenta).
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

  // ---- Esqueci minha senha (Gustavo, 14/11/2026) ----
  // O botão "Esqueci minha senha" pede à função recuperar-senha um e-mail com o link de troca (enviado pela caixa da escrituração).
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
      <button type="submit" style="width:100%;padding:10px;border:0;border-radius:6px;background:#1f4fd1;color:#fff;font:inherit;cursor:pointer">Salvar nova senha</button>
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
  const fornecedorDoNome = nome => String(nome || '—').replace(/\s*-\s*NOTA\b.*$/i, '').trim() || '—';

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
    const comVinculo = false;   // vínculo entre engenheiros desligado por enquanto
    const [espelho, lancs, eventos, vinculos, analiseBanco, contratosBanco, tamanhos] = await Promise.all([
      guardado('espelho', 10, () => todas(() => cliente.from('monday_espelho').select('item_id,board_nome,grupo_nome,etapa,nome,documento,unidade,natureza,valor,narrativa,contrato,expansao,pedido,status,emissao,vencimento,data_envio,codigo_emitente,lancamento_id,atualizado_monday,cnpj,arquivos').neq('etapa','excluida').order('item_id'))),
      guardado('lancs', 5, () => todas(() => cliente.from('lancamentos').select('id,nf,fornecedor,unidade,natureza,valor,emissao,vencimento,pagamento,cnpj_fornecedor,arquivo_nf_nome,arquivo_nf_path,arquivo_boleto_nome,arquivo_boleto_path,criado_em,atualizado_em,monday_item_id,banco,agencia,conta_corrente,chave_pix').eq('status','Enviado').order('id'))),
      guardado('eventos', 30, () => todas(() => cliente.from('monday_espelho_eventos').select('item_id,quando,descricao').in('tipo',['create_pulse','move_pulse_from_group','move_pulse_from_board','delete_pulse','archive_pulse']).order('id'))),
      comVinculo ? todas(() => cliente.from('engenharia_vinculos').select('*').order('nota_id')) : Promise.resolve([]),
      analisesAtuais(),
      guardado('contratos', 5, () => todas(() => cliente.from('contratos').select('*').order('nome'))),
      guardado('tamanhos', 30, () => todas(() => cliente.rpc('lancamento_arquivos_tamanhos').order('lancamento_id'))),
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
    const vinc = new Map(vinculos.map(v => [v.nota_id, { notaDe:v.nota_de || '', cartaoDe:v.cartao_de || '', por:v.por_nome || v.por_email, em:v.em }]));
    // Arquivos de uma nota = os do lançamento (guardados aqui) + os do item na Monday (buscados na hora).
    // A Monday guarda uma cópia do que o lançamento enviou, com outro nome: mesmo tamanho = mesmo arquivo, aparece uma vez só (a versão do lançamento).
    // Arquivo da Monday sem igual no lançamento (ex.: anexado depois, certificado, comprovante) sempre aparece.
    const arquivoMonday = (a, em) => a.bucket ? { id:a.id, nome:a.nome || 'Arquivo', bucket:a.bucket, caminho:a.caminho, tamanho:a.tamanho || null, por:a.por || 'Painel', em:a.em || em }
      : { id:'mon-' + a.id, nome:a.nome || 'Arquivo', monday:String(a.id), tamanho:a.tamanho || null, por:'Monday', em };
    const arquivosDe = (l, m) => {
      const doLancamento = [
        ...(l?.arquivo_nf_path ? [{ id:'nf-' + l.id, nome:l.arquivo_nf_nome || 'Nota fiscal', caminho:l.arquivo_nf_path, bucket:'documentos', tamanho:tamanhoLanc.get(l.id + '|nf') || null, por:'Lançamento', em:l.criado_em }] : []),
        ...(l?.arquivo_boleto_path ? [{ id:'bol-' + l.id, nome:l.arquivo_boleto_nome || 'Boleto', caminho:l.arquivo_boleto_path, bucket:'documentos', tamanho:tamanhoLanc.get(l.id + '|boleto') || null, por:'Lançamento', em:l.criado_em }] : []),
      ];
      // Boletos extras do lançamento (2º boleto da mesma nota), sem repetir o principal.
      for (const a of (l ? extrasLanc.get(l.id) || [] : [])) if (![l.arquivo_nf_path, l.arquivo_boleto_path, ...doLancamento.map(x => x.caminho)].includes(a.path_storage))
        doLancamento.push({ id:'bolx-' + a.id, nome:a.nome_arquivo || 'Boleto', caminho:a.path_storage, bucket:'documentos', tamanho:null, por:'Lançamento', em:a.criado_em || l.criado_em });
      const nomesLanc = new Set(doLancamento.map(x => String(x.nome || '').toLowerCase()));
      const usados = new Set();   // cada arquivo do lançamento cobre no máximo um da Monday
      const daMonday = (m?.arquivos || []).filter(a => {
        if (nomesLanc.has(String(a.nome || '').toLowerCase())) return false;   // mesmo nome = mesma cópia do lançamento
        const igual = doLancamento.find(x => x.tamanho && Number(a.tamanho) === x.tamanho && !usados.has(x.id));
        if (igual){ usados.add(igual.id); return false; }
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
      const ov = (analises.get(id)?.campos) || {};   // correções feitas no painel (administrativo) valem sobre os dados originais
      lancamentos.push({ id, status:'Enviado', nf: ov.nf ?? (l?.nf || m?.documento || '—'), fornecedor: ov.fornecedor ?? (l?.fornecedor || fornecedorDoNome(m?.nome)),
        unidade: ov.unidade ?? (l?.unidade || m?.unidade || '—'), natureza: ov.natureza ?? (l?.natureza || m?.natureza || '—'), valor: ov.valor != null ? Number(ov.valor) : (l?.valor ?? m?.valor ?? null),
        emissao: ov.emissao ?? (l?.emissao || m?.emissao || null), vencimento: ov.vencimento ?? (l?.vencimento || m?.vencimento || null), pagamento: ov.pagamento ?? (l?.pagamento || '—'),
        cnpj_fornecedor: ov.cnpj_fornecedor ?? (l?.cnpj_fornecedor || m?.cnpj || '—'),
        // Dados bancários (17/11/2026): se a correção limpou o campo, vale vazio (não volta o valor do lançamento).
        banco: 'banco' in ov ? (ov.banco || '') : (l?.banco || ''), agencia: 'agencia' in ov ? (ov.agencia || '') : (l?.agencia || ''),
        conta_corrente: 'conta_corrente' in ov ? (ov.conta_corrente || '') : (l?.conta_corrente || ''), chave_pix: 'chave_pix' in ov ? (ov.chave_pix || '') : (l?.chave_pix || ''),
        ...arquivosDaNota(id, [...arquivosDe(l, m), ...(anexosNota.get(id) || [])]),
        monday:m ? { board_nome:m.board_nome, grupo_nome:m.grupo_nome, status:m.status, data_envio:m.data_envio, atualizado:m.atualizado_monday } : {} });
      fluxo[id] = { etapa, narrativa:m?.narrativa || '', contrato:m?.contrato || '', expansao:m?.expansao || '', pedido:m?.pedido || '', emitente:m?.codigo_emitente || '', historico, historicoMonday:historico, vinculo:vinc.get(id) || null, versao:null };
      monEtapa.set(id, m ? m.etapa : null);
      const an = analises.get(id);
      if (an){
        Object.assign(fluxo[id], { narrativa:an.narrativa || m?.narrativa || '', contrato:an.contrato || m?.contrato || '', expansao:an.expansao || m?.expansao || '', versao:an.versao, decisao:an.decisao || null, historico:[...historico, ...(an.historico || [])] });
        fluxo[id].etapa = an.etapa;   // a etapa do painel vale (a Monday não é mais usada)
        fluxo[id].pedido = ov.pedido || an.pedido || fluxo[id].pedido; // correção do pedido feita no painel vale sobre o pedido da análise
        fluxo[id].contratoRef = an.contrato_ref || null;
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
      // 12/11/2026: lançamento cujo item a Monday apagou/arquivou não aparece mais (a Monday também não o mostra).
      // Só a nota recém-enviada (2 dias) aparece, enquanto o item não chega na Monday.
      // A partir de 16/11/2026 a Monday não recebe mais as notas: toda nota enviada pelo lançamento fica no painel e permanece em Aprovações.
      if (new Date(l.criado_em).getTime() <= recente && new Date(l.criado_em).getTime() < Date.parse('2026-11-16T00:00:00-03:00')) continue;
      incluir(l.id, l, null, 'engenharia', ['Enviada pelo lançamento']);
    }
    // Removida do painel (17/11/2026): sai do quadro e de todas as abas. O banco guarda a nota e o histórico.
    for (const id of Object.keys(fluxo)) if (fluxo[id].etapa === 'removida') delete fluxo[id];
    estado.lancamentos = lancamentos.filter(x => fluxo[x.id]); estado.fluxo = fluxo;
    estado.contratos = contratosBanco.map(c => ({ id:c.item_id, origem:c.origem || 'monday', criadoEm:c.criado_em || null, criadoPor:c.criado_por || '', nome:c.nome || '—', grupo:c.grupo_nome || '', unidade:c.unidade || '', tipologia:c.tipologia || '', tipo:c.tipo || '', status:c.status || '', aprovador:c.aprovador || '', referencia:c.referencia || '', narrativa:c.narrativa || '', valorFechado:Number(c.valor_fechado || 0), aceite:c.aceite, cnpj:c.cnpj || '', inclusao:c.inclusao, aditivos:c.aditivos || [], notas:(c.notas || []).map(n => idDoItem.get(String(n))).filter(Boolean), subitens:(c.subitens || []).map(s => ({ ...s, lista:(s.lista || []).map(a => arquivoMonday(a, c.atualizado_monday)) })), arquivos:(c.arquivos_itens || []).map(a => arquivoMonday(a, c.atualizado_monday)) }));
  }

  // Quadro de Projetos (cópia da Monday) e Portfólio: o banco decide (14/11/2026). Projetos: administração, equipe de lançamento e engenheiros.
  // Portfólio: Marcos e Gustavo mexem; engenheiros só veem. Para os demais, nada é pedido e as abas nem aparecem.
  async function carregarProjetos(){ GUARDADO.delete('projetos'); return carregarProjetosLeve(); }
  async function carregarProjetosLeve(){
    const gp = GUARDADO.get('projetos'); if (gp && Date.now() - gp.em < 5 * 60000) return;   // o estado já foi montado com o que foi lido há pouco
    try {
      const [pode, ver, edita] = await Promise.all([cliente.rpc('painel_projetos_pode'), cliente.rpc('painel_portfolio_pode'), cliente.rpc('painel_portfolio_edita')]);
      estado.portfolioAcesso = !ver.error && ver.data === true; estado.portfolioEdita = !edita.error && edita.data === true;
      estado.projetosAcesso = !pode.error && pode.data === true;
      if (!estado.projetosAcesso){ estado.projetos = null; estado.atividades = null; GUARDADO.set('projetos', { em:Date.now(), dados:false }); return; }
      const [q, itens] = await Promise.all([cliente.from('projetos_quadro').select('*').eq('id', 1).maybeSingle(), todas(() => cliente.from('projetos_itens').select('*').order('ordem'))]);
      const quadro = conferir(q);
      estado.projetos = quadro ? { quadro:{ nome:quadro.nome, colunas:quadro.colunas || [], grupos:quadro.grupos || [], subColunas:quadro.sub_colunas || [], espelhadoEm:quadro.espelhado_em }, itens } : null;
      // Atividades (quadro Monday 18397191835, importado em 14/11): mesma regra de leitura de Projetos.
      const [qa, itensA] = await Promise.all([cliente.from('atividades_quadro').select('*').eq('id', 1).maybeSingle(), todas(() => cliente.from('atividades_itens').select('*').order('ordem'))]);
      const qA = conferir(qa);
      estado.atividades = qA ? { quadro:{ nome:qA.nome, colunas:qA.colunas || [], grupos:qA.grupos || [], subColunas:qA.sub_colunas || [], espelhadoEm:qA.espelhado_em }, itens:itensA } : null;
      GUARDADO.set('projetos', { em:Date.now(), dados:true });
    } catch (e) { console.warn('Projetos:', e.message); }
  }

  async function carregarCompras(){ GUARDADO.delete('compras'); return carregarComprasLeve(); }
  async function carregarComprasLeve(){
    if (!['admin','engenharia','compras'].includes(pessoa.perfil)) return;
    const [reqs, anexos, hist, avisosEmail] = await guardado('compras', 5, () => Promise.all([
      todas(() => cliente.from('compras_requisicoes').select('*').order('criada_em')),
      todas(() => cliente.from('compras_anexos').select('*').order('em')),
      todas(() => cliente.from('compras_historico').select('*').order('em')),
      todas(() => cliente.from('compras_avisos').select('*').order('criado_em')),
    ]));
    const lista = reqs.map(r => ({ id:r.numero, uuid:r.id, nome:r.nome, descricao:r.descricao || '', unidade:r.unidade || '—', tipo:r.tipo,
      prioridade:r.prioridade, sla:r.sla_dias, etapa:r.etapa, comprador:r.comprador || '', solicitante:r.solicitante_nome || r.solicitante_email,
      solicitanteEmail:r.solicitante_email, terceiros:r.terceiros, motivoRecusa:r.motivo_recusa, criadaEm:r.criada_em, prazoDesejado:r.prazo_desejado || '', dataEntrega:r.data_entrega || null,
      anexos:{ rm:[], propostas:[], certificados:[] }, emails:[], historico:[], eventos:[] }));
    const porId = new Map(lista.map(r => [r.uuid, r]));
    for (const a of anexos) porId.get(a.requisicao_id)?.anexos[a.tipo]?.push({ id:a.id, nome:a.nome, caminho:a.caminho, bucket:'compras', por:a.por_nome || a.por_email, em:a.em });
    for (const h of hist){ porId.get(h.requisicao_id)?.historico.push(`${h.texto} · ${quando(h.em)} · ${h.por_nome || h.por_email}`); porId.get(h.requisicao_id)?.eventos.push({ texto:h.texto, em:h.em }); }
    for (const m of avisosEmail) porId.get(m.requisicao_id)?.emails.push({ assunto:m.assunto, corpo:m.corpo, responderPara:m.responder_para, para:m.para, quando:m.criado_em, enviado:!!m.enviado_em, erro:m.erro && !/^Anexado por link/.test(m.erro) ? m.erro : null });
    estado.requisicoes = lista;
  }

  async function anexarArquivo(uuid, tipo, arquivo){
    const caminho = `${uuid}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
    conferir(await cliente.storage.from('compras').upload(caminho, arquivo, { contentType:arquivo.type || undefined }));
    const r = await cliente.rpc('compras_registrar_anexo', { p_id:uuid, p_tipo:tipo, p_nome:arquivo.name, p_caminho:caminho });
    if (r.error){ await cliente.storage.from('compras').remove([caminho]); throw new Error(r.error.message); }
  }

  // Resultado de uma gravação da análise, já no formato que a tela usa.
  function resultadoAnalise(notaId, r){
    const f = estado.fluxo[notaId] || {}, mon = monEtapa.get(notaId);
    const terminal = ['encaminhada','fiscal','arquivada','cancelada'].includes(mon);
    return { etapa:r.etapa, narrativa:r.narrativa || '', contrato:r.contrato || '', expansao:r.expansao || '', pedido:r.pedido || '', contratoRef:r.contrato_ref || null, versao:r.versao, decisao:r.decisao ?? null, historico:[...(f.historicoMonday || []), ...(r.historico || [])] };
  }

  window.ExpansaoDados = {
    modoValidacao: true,
    get PESSOAS(){ return estado.PESSOAS; },
    get lancamentos(){ return estado.lancamentos; },
    get fluxo(){ return estado.fluxo; },
    get requisicoes(){ return estado.requisicoes; },
    get contratos(){ return estado.contratos; },
    get projetos(){ return estado.projetos; },
    get projetosAcesso(){ return estado.projetosAcesso; },
    get atividades(){ return estado.atividades; },
    async salvarItemQuadro(quadro, id, d){ conferir(await cliente.rpc('quadro_salvar', { p_quadro:quadro, p_item:id || null, p_grupo:d.grupo, p_nome:d.nome, p_valores:d.valores })); await carregarProjetos(); },
    get portfolioAcesso(){ return estado.portfolioAcesso; },
    get portfolioEdita(){ return estado.portfolioEdita; },
    // Contratos são do painel desde 14/11/2026 (espelho da Monday desligado). O banco só aceita o Marcos e exige o contrato do aditivo.
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
    // Anexo de contrato/aditivo (14/11): só o Marcos envia (o banco confere). O arquivo vai ao bucket privado 'contratos'.
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
      guardar: async () => { throw new Error('Use as ações de Compras para anexar.'); },
      apagar: async () => {},
    },
    // Mesmo envio do botão Enviar da Monday, pedido pelo servidor com a permissão de quem clicou.
    // Envio em lote por unidade (18/11/2026): simular=true só mostra a prévia; simular=false envia (só no modo real).
    async enviarLote(base, simular, excluir){
      const r = await cliente.functions.invoke('escriturar-painel', { body:{ lote:base, simular:!!simular, excluir:Array.isArray(excluir) ? excluir : [] } });
      if (r.error){ let msg = r.error.message; try { msg = (await r.error.context.json()).erro || msg; } catch (_) { /* mantém */ } throw new Error(msg); }
      return r.data;
    },
    async escriturar(notaId, emitente){
      const r = await cliente.functions.invoke('escriturar-painel', { body:{ nota_id:notaId, emitente:emitente || '' } });
      if (r.error){ let msg = r.error.message; try { msg = (await r.error.context.json()).erro || msg; } catch (_) { /* mantém a mensagem */ } throw new Error(msg); }
      return r.data;
    },
    // Análise da engenharia (narrativa, contrato, pertence à expansão): grava no banco, sem tocar na Monday.
    analise: {
      async salvar(notaId, campos, base){
        const r = conferir(await cliente.rpc('aprovacoes_salvar', { p_nota:notaId, p_narrativa:campos.narrativa ?? null, p_contrato:campos.contrato ?? null, p_expansao:campos.expansao ?? null, p_base:base }));
        return resultadoAnalise(notaId, r);
      },
      async aprovar(notaId, base){
        const r = conferir(await cliente.rpc('aprovacoes_aprovar', { p_nota:notaId, p_base:base }));
        return resultadoAnalise(notaId, r);
      },
      async vincularContrato(notaId, contratoId, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_vincular_contrato', { p_nota:notaId, p_contrato:contratoId, p_base:base }))); },
      // Devolve a nota ao painel de lançamento (volta a Pendente, com o motivo). Não toca na Monday.
      async registrarRetorno(notaId, resultado, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_registrar_retorno', { p_nota:notaId, p_resultado:resultado, p_motivo:motivo, p_base:base }))); },
      async reabrirEscrituracao(notaId, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_reabrir_escrituracao', { p_nota:notaId, p_motivo:motivo, p_base:base }))); },
      async editarCampos(notaId, campos, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_editar_campos', { p_nota:notaId, p_campos:campos, p_base:base }))); },
      async mover(notaId, etapa, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_mover', { p_nota:notaId, p_etapa:etapa, p_motivo:motivo || null, p_base:base }))); },
      removerSuportado:true,   // "Remover do painel" (etapa removida): depende do SQL 2026-11-17_40 aplicado no banco da Expansão
      async anexarArquivo(notaId, arquivo, base){
        const caminho = `anexos/${notaId}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
        conferir(await cliente.storage.from('documentos').upload(caminho, arquivo, { contentType:arquivo.type || undefined }));
        const r = await cliente.rpc('aprovacoes_anexo_registrar', { p_nota:notaId, p_nome:arquivo.name, p_caminho:caminho, p_tamanho:arquivo.size });
        if (r.error){ await cliente.storage.from('documentos').remove([caminho]); throw new Error(r.error.message); }
        return true;
      },
      async removerAnexo(anexoId){ const caminho = conferir(await cliente.rpc('aprovacoes_anexo_remover', { p_id:anexoId })); await cliente.storage.from('documentos').remove([caminho]); return true; },
      async removerArquivoNota(notaId, chave, nome, remover, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_arquivo_remover', { p_nota:notaId, p_chave:chave, p_nome:nome || null, p_remover:remover !== false, p_base:base ?? null }))); },
      async devolver(notaId, motivo, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_devolver', { p_nota:notaId, p_motivo:motivo, p_base:base }))); },
      async semContrato(notaId, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_sem_contrato', { p_nota:notaId, p_base:base }))); },
      async registrarPedido(notaId, pedido, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_registrar_pedido', { p_nota:notaId, p_pedido:pedido, p_base:base }))); },
      async confirmarPedido(notaId, base){ return resultadoAnalise(notaId, conferir(await cliente.rpc('aprovacoes_confirmar_pedido', { p_nota:notaId, p_base:base }))); },
    },
    async salvarVinculo(notaId, { notaDe, cartaoDe }){
      const linha = { nota_id:notaId, nota_de:notaDe || null, cartao_de:cartaoDe || null, por_email:pessoa.email, por_nome:pessoa.nome, em:new Date().toISOString() };
      conferir(await cliente.from('engenharia_vinculos').upsert(linha, { onConflict:'nota_id' }));
      return { notaDe, cartaoDe, por:pessoa.nome, em:linha.em };
    },
    compras: {
      async criar(d){
        const comArquivos = !!(d.arquivos || []).length;
        const r = conferir(await cliente.rpc('compras_criar', { p_nome:d.nome, p_descricao:d.descricao, p_unidade:d.unidade, p_tipo:d.tipo, p_prioridade:d.prioridade, p_prazo:d.prazo, p_avisar:!comArquivos }));
        try { for (const f of d.arquivos) await anexarArquivo(r.id, 'rm', f); }
        finally { if (comArquivos) conferir(await cliente.rpc('compras_avisar_abertura', { p_id:r.id })); }
        await carregarCompras();
      },
      async mover(uuid, acao, x){
        conferir(await cliente.rpc('compras_mover', { p_id:uuid, p_acao:acao, p_comprador:x.comprador, p_terceiros:x.terceiros, p_motivo:x.motivo, p_data:x.data || null }));
        await carregarCompras();
      },
      async excluir(uuid){ const num = conferir(await cliente.rpc('compras_excluir', { p_req:uuid })); await carregarCompras(); return num; },
      async anexar(uuid, tipo, arquivo){ await anexarArquivo(uuid, tipo, arquivo); await carregarCompras(); },
      async removerAnexo(id){
        const caminho = conferir(await cliente.rpc('compras_remover_anexo', { p_anexo:id }));
        await cliente.storage.from('compras').remove([caminho]);
        await carregarCompras();
      },
    },
  };

  // ---- Primeiro acesso: a pessoa escolhe a equipe (Gustavo, 09/11). Escolha única; só a administração corrige.
  function escolherEquipe(email){
    const caixa = document.createElement('div');
    caixa.id = 'cxEscolhaEquipe';
    caixa.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="cxEscolhaTitulo"><h2 id="cxEscolhaTitulo">De qual equipe você faz parte?</h2>
      <p>Esta escolha define as telas que você vai usar. Ela só pode ser alterada pela administração.</p>
      <div class="cx-escolhas">${[['expansao','Expansão','Engenharia: Aprovações e Compras'],['administrativo','Administrativo','Lançamento de notas e Aprovações'],['compras','Compras','Requisições e cotações']]
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
    window.__expansaoEquipe = r.data;
    window.__expansaoSemLancamento = ['expansao','compras'].includes(r.data);
    return true;
  };

  async function carregarTudo(){ await Promise.all([carregarAprovacoesLeve(), carregarComprasLeve(), carregarProjetosLeve()]); }
  window.__expansaoAoEntrar = async (email, nome) => {
    pessoa = { email:String(email).toLowerCase(), nome:nome || String(email).split('@')[0], perfil:PERFIL[window.__expansaoEquipe] };
    if (['admin','engenharia'].includes(pessoa.perfil)){
      const r = await cliente.rpc('painel_engenheiros');
      estado.PESSOAS = [...(r.data || []).map(p => ({ email:p.email, nome:p.nome, perfil:'engenharia' }))];
    }
    if (!estado.PESSOAS.some(p => p.email === pessoa.email)) estado.PESSOAS.push(pessoa);
    try { await carregarTudo(); } catch (e) { alert('Erro ao carregar Aprovações e Compras: ' + e.message); }
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
