const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('./regras-expansao.js');
const {criar}=require('./reservas.js');
const eng={nome:'Rafael',email:'rafael@exemplo.invalid',perfil:'engenharia'};
test('Engenheiro só vê as próprias requisições e o próprio contador',()=>{
  const rs=[{solicitanteEmail:eng.email},{solicitanteEmail:'outro@exemplo.invalid'},{solicitante:'Rafael'},{solicitante:'Bruno'}];
  assert.equal(rs.filter(r=>R.podeVerReq(eng,r)).length,2);
  assert.ok(rs.every(r=>R.podeVerReq({...eng,perfil:'compras'},r)));
});
test('E-mail de proprietário prevalece sobre nome coincidente',()=>assert.equal(R.podeVerReq(eng,{solicitante:'Rafael',solicitanteEmail:'outro@exemplo.invalid'}),false));
test('Pesquisa considera descrição do item, sem diferenciar acentos',()=>{
  assert.ok(R.texto({itens:[{descricao:'Instalação elétrica'}]}).includes('instalacao eletrica'));
  assert.ok(R.filtrar({descricao:'Mão de obra na cobertura',unidade:'ARARAQUARA',etapa:'Em cotação',prioridade:'Urgente'},{busca:'mao',unidade:'ARARAQUARA',status:'Pendentes',prioridade:'Urgente'},true));
});
test('Filtros se combinam sem misturar situação e etapa',()=>{
  assert.equal(R.filtrar({unidade:'IPATINGA',etapa:'Aprovada'},{unidade:'ARARAQUARA',status:'Aprovados'},true),false);
  assert.equal(R.statusCompra({etapa:'Recusada'}),'Recusados');
  assert.equal(R.statusCompra({etapa:'Aprovada'}),'Aprovados');
  assert.equal(R.statusCompra({etapa:'Em cotação'}),'Pendentes');
  assert.ok(R.filtrar({etapa:'fiscal'},{status:'fiscal'},false));
});
function cenario(){
  const m=new Map(),storage={getItem:k=>m.get(k) ?? null,setItem:(k,v)=>m.set(k,v)};
  let fila=Promise.resolve(),tempo=1000;
  const executar=(_,fn)=>{const r=fila.then(fn);fila=r.catch(()=>{});return r;};
  const novo=(nome,token)=>criar({usuario:{nome,email:nome+'@exemplo.invalid'},storage,executar,token,agora:()=>tempo,ttl:100});
  return {a:novo('Rafael','a'),b:novo('Bruno','b'),avancar:n=>tempo+=n};
}
test('Aquisição concorrente concede somente uma reserva',async()=>{
  const {a,b}=cenario(),rs=await Promise.all([a.adquirir('nota:1'),b.adquirir('nota:1')]);
  assert.equal(rs.filter(r=>r.ok).length,1);assert.equal(rs[1].reserva.nome,'Rafael');
});
test('Notas diferentes podem ser preenchidas ao mesmo tempo',async()=>{
  const {a,b}=cenario();assert.ok((await a.adquirir('nota:1')).ok);assert.ok((await b.adquirir('nota:2')).ok);
  await a.salvar('nota:1',{narrativa:'Nota A'},0);await b.salvar('nota:2',{narrativa:'Nota B'},0);
  assert.equal(a.dados()['nota:1'].valor.narrativa,'Nota A');assert.equal(a.dados()['nota:2'].valor.narrativa,'Nota B');
});
test('Outro usuário não salva nem libera a reserva alheia',async()=>{
  const {a,b}=cenario();await a.adquirir('nota:1');await b.liberar('nota:1');
  assert.ok(a.validar('nota:1'));await assert.rejects(b.salvar('nota:1',{},0),/reserva/);
});
test('Reserva expirada não aceita gravação; próximo editor recebe versão atual',async()=>{
  const {a,b,avancar}=cenario();await a.adquirir('nota:1');await a.salvar('nota:1',{narrativa:'Salvo'},0);
  avancar(101);assert.equal(await a.renovar('nota:1'),false);await assert.rejects(a.salvar('nota:1',{},1),/reserva/);
  const r=await b.adquirir('nota:1');assert.ok(r.ok);assert.equal(r.dados.valor.narrativa,'Salvo');
});
test('Versão antiga nunca sobrescreve uma gravação já confirmada',async()=>{
  const {a}=cenario();await a.adquirir('nota:1');await a.salvar('nota:1',{narrativa:'Nova'},0);
  await assert.rejects(a.salvar('nota:1',{narrativa:'Antiga'},0),/outra sessão/);
  assert.equal(a.dados()['nota:1'].valor.narrativa,'Nova');
});
test('Só quem abriu a requisição decide; Compras não decide; administração decide',()=>{
  const r={solicitante:'Rafael',solicitanteEmail:eng.email};
  assert.ok(R.podeDecidirReq(eng,r));
  assert.equal(R.podeDecidirReq({nome:'Bruno',email:'g@exemplo.invalid',perfil:'engenharia'},r),false);
  assert.equal(R.podeDecidirReq({...eng,perfil:'compras'},r),false);
  assert.equal(R.podeDecidirReq({...eng,perfil:'admin'},r),true);
});
test('Engenharia corrige análise e vínculo só até antes de escriturar',()=>{
  for(const etapa of ['contrato','pedido','aprovacao','fora'])assert.ok(R.podeCorrigirAnalise(eng,{etapa}),etapa);
  for(const etapa of ['engenharia','escrituracao','encaminhada','fiscal'])assert.equal(R.podeCorrigirAnalise(eng,{etapa}),false,etapa);
  assert.equal(R.podeCorrigirAnalise({...eng,perfil:'equipe'},{etapa:'pedido'}),false);
  assert.ok(R.podeEditarVinculo({etapa:'engenharia'}));assert.equal(R.podeEditarVinculo({etapa:'escrituracao'}),false);
});
test('Filtros de fornecedor, natureza e período de emissão',()=>{
  const n={fornecedor:'Sul Materiais',natureza:'Material',emissao:'2026-11-03',etapa:'pedido'};
  assert.ok(R.filtrar(n,{fornecedor:'Sul Materiais',natureza:'Material',de:'2026-11-01',ate:'2026-11-03'},false));
  assert.equal(R.filtrar(n,{de:'2026-11-04'},false),false);
  assert.equal(R.filtrar(n,{ate:'2026-11-02'},false),false);
  assert.equal(R.filtrar({...n,emissao:null},{ate:'2026-12-31'},false),false);
});
test('Cor de unidade é a mesma da Monday para todos',()=>{
  assert.equal(R.corUnidade('ARARAQUARA'),R.corUnidade('araraquara'));
  assert.match(R.corUnidade('UNIDADE NOVA'),/^#[0-9a-f]{6}$/);
  // Cores iguais às da Monday (coluna Unidade dos quadros Aprovações e Notas).
  assert.equal(R.corUnidade('020 - ARARAQUARA'),'#ff6d3b');
  assert.equal(R.corUnidade('006 - PELOTAS'),'#00c875');
  assert.equal(R.corUnidade('009 - NITERÓI'),'#037f4c');
  assert.equal(R.corUnidade('PINHAL'),'#66ccff');
});

test('Nome da unidade sai sempre como "código - NOME"',()=>{
  assert.equal(R.nomeUnidade('010'),'010 - CASCAVEL');
  assert.equal(R.nomeUnidade('018 - MARINGÁ'),'018 - MARINGÁ');
  assert.equal(R.nomeUnidade('ARARAQUARA'),'020 - ARARAQUARA');
  assert.equal(R.nomeUnidade('009 - NITEROI'),'009 - NITERÓI');
  assert.equal(R.nomeUnidade(''),'—');
});
test('Unidades do filtro são sempre as fixas, com ou sem nome nos dados',()=>{
  R.configurarUnidades(['001 - SOROCABA','SOROCABA','03/09/2026']);
  const opcoes = R.opcoesUnidade(['03/09/2026','08/09/2026']).map(x=>x[0]);
  assert.equal(opcoes.length,20);
  assert.ok(opcoes.includes('001') && opcoes.includes('099'));
  assert.ok(!opcoes.some(c=>/\//.test(c)));
  assert.equal(R.unidadeChave('SOROCABA'),'001');
  assert.equal(R.unidadeChave('001 - SOROCABA'),R.unidadeChave('001'));
  assert.equal(R.filtrar({unidade:'SOROCABA'},{unidade:'001'},false),true);
  assert.equal(R.filtrar({unidade:'03/09/2026'},{unidade:'001'},false),false);
});
