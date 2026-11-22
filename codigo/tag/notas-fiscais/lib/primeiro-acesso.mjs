// Primeiro acesso das duas contas que editam o painel da TAG (14/11/2026).
// O cadastro livre do login do ecossistema está desligado (disable_signup). Por isso o "criar conta" passa por aqui:
// só os e-mails de EDITORES recebem convite; quem já tem conta recebe o link de troca de senha. Nos dois casos o
// Supabase manda um e-mail e a pessoa cria a própria senha na página de primeiro acesso do ecossistema.
// A chave administrativa vem só do ambiente (ECOSSISTEMA_ADMIN_KEY) e nunca vai para o navegador.
import { auth, editors } from './access.mjs';

export const PRIMEIRO_ACESSO_URL = 'https://seu-painel-projetos.netlify.app/primeiro-acesso.html';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export async function pedirPrimeiroAcesso(emailBruto, { adminKey, fetcher = fetch } = {}) {
  const email = String(emailBruto || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Digite seu e-mail.');
  if (!editors.has(email)) fail(403, 'Só as duas contas autorizadas da TAG criam acesso de edição. Os demais consultam sem entrar.');
  if (!adminKey) fail(503, 'O cadastro de primeiro acesso ainda não foi ativado no servidor. Fale com o administrador.');
  const destino = '?redirect_to=' + encodeURIComponent(PRIMEIRO_ACESSO_URL);
  const convite = await fetcher(auth.url + '/auth/v1/invite' + destino, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { apikey: adminKey, Authorization: 'Bearer ' + adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (convite.ok) return { enviado: 'convite' };
  const erro = await convite.json().catch(() => ({}));
  const jaExiste = convite.status === 422 || /already|registered|exists/i.test(String(erro.msg || erro.message || erro.error_code || ''));
  if (!jaExiste) fail(502, 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
  // Conta já existe (ex.: Otávio, criado com troca de senha obrigatória): manda o link para definir a senha.
  const rec = await fetcher(auth.url + '/auth/v1/recover' + destino, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { apikey: auth.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (rec.status === 429) fail(429, 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.');
  if (!rec.ok) fail(502, 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
  return { enviado: 'senha' };
}
