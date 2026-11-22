// Adaptador da prévia: reserva e versão de cada nota entre abas do MESMO navegador.
// Em produção substituir por um adaptador de servidor com o mesmo contrato atômico.
(function(root){
  'use strict';
  function criar({usuario,storage,executar,agora=Date.now,token,ttl=45000,namespace='expansao_colaboracao_v1'}){
    const key = namespace, ler = () => { try { return JSON.parse(storage.getItem(key)) || {reservas:{},dados:{}}; } catch { throw Error('Não foi possível ler as reservas.'); } };
    const mudar = fn => executar(key, () => { const b=ler(), r=fn(b); storage.setItem(key,JSON.stringify(b)); return r; });
    const minha = r => r && r.token === token && r.expira > agora();
    return {
      token,
      adquirir:id=>mudar(b=>{const r=b.reservas[id];if(r && r.expira>agora() && r.token!==token)return {ok:false,reserva:r};const nova={token,nome:usuario.nome,email:usuario.email,expira:agora()+ttl};b.reservas[id]=nova;return {ok:true,reserva:nova,dados:b.dados[id] || null};}),
      renovar:id=>mudar(b=>{if(!minha(b.reservas[id]))return false;b.reservas[id].expira=agora()+ttl;return true;}),
      liberar:id=>mudar(b=>{if(b.reservas[id]?.token===token)delete b.reservas[id];}),
      validar:id=>minha(ler().reservas[id]),
      listar:()=>Object.fromEntries(Object.entries(ler().reservas).filter(([,r])=>r.expira>agora())),
      dados:()=>ler().dados,
      salvar:(id,valor,versao)=>mudar(b=>{if(!minha(b.reservas[id]))throw Error('A reserva desta nota expirou ou pertence a outra pessoa.');const atual=b.dados[id]?.versao || 0;if(atual!==versao)throw Error('A nota foi atualizada em outra sessão. Reabra antes de salvar.');const novo={versao:atual+1,valor};b.dados[id]=novo;return novo;}),
    };
  }
  const api = {criar};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.ExpansaoReservas=api;
})(typeof window!=='undefined'?window:null);
