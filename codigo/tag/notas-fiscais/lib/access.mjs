import { AsyncLocalStorage } from 'node:async_hooks';
export const requestActor = new AsyncLocalStorage();
export const auth = { url: 'https://seu-projeto-ecossistema.supabase.co', key: 'sb_publishable_SUA_CHAVE_PUBLICA' };
export const editors = new Set(['otavio.reis@holding.exemplo', 'backoffice@investidora.exemplo']);
function fail(status, message) { throw Object.assign(new Error(message), {status}); }
export async function identity(authorization, fetcher = fetch) {
 if (!authorization) return { email: '', canEdit: false };
 if (!/^Bearer \S+$/i.test(authorization)) fail(401,'Sessão inválida. Entre novamente.');
 const headers={apikey:auth.key,Authorization:authorization};
 const r=await fetcher(auth.url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
 if (!r.ok) fail(401,'Sessão expirada. Entre novamente.');
 const u=await r.json(),email=String(u.email||'').trim().toLowerCase();
 if (!u.id||!u.email_confirmed_at||u.is_anonymous||!editors.has(email)) return {email,canEdit:false};
 const profile=await fetcher(auth.url+'/rest/v1/profiles?select=must_change_password&id=eq.'+encodeURIComponent(u.id),{headers,signal:AbortSignal.timeout(10000)});
 if (!profile.ok) fail(403,'Não foi possível verificar o acesso.');
 if ((await profile.json())[0]?.must_change_password) fail(403,'Defina sua senha pessoal no primeiro acesso do ecossistema.');
 return {id:u.id,email,canEdit:true};
}
export function requireEditor(actor) { if (!actor.canEdit) fail(403,'Entre com a conta do Otávio ou backoffice@investidora.exemplo para editar.'); }
