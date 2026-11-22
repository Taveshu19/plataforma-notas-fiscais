import test from 'node:test';
import assert from 'node:assert/strict';
import { pedirPrimeiroAcesso } from '../lib/primeiro-acesso.mjs';

const resposta = (status, corpo = {}) => ({ ok: status < 300, status, json: async () => corpo });
const registrar = respostas => { const chamadas = []; const fetcher = async (url, init) => { chamadas.push({ url, init }); return respostas.shift(); }; return { chamadas, fetcher }; };

test('e-mail fora da lista não chama o servidor de login', async () => {
  const { chamadas, fetcher } = registrar([]);
  await assert.rejects(pedirPrimeiroAcesso('camila.torres@empresa.exemplo', { adminKey: 'x', fetcher }), { status: 403 });
  assert.equal(chamadas.length, 0);
});
test('sem chave administrativa no servidor falha fechado', async () => {
  await assert.rejects(pedirPrimeiroAcesso('backoffice@investidora.exemplo', { adminKey: '', fetcher: async () => { throw Error('não deveria chamar'); } }), { status: 503 });
});
test('conta nova recebe convite por e-mail', async () => {
  const { chamadas, fetcher } = registrar([resposta(200)]);
  assert.deepEqual(await pedirPrimeiroAcesso(' backoffice@investidora.exemplo ', { adminKey: 'k', fetcher }), { enviado: 'convite' });
  assert.match(chamadas[0].url, /\/auth\/v1\/invite\?redirect_to=/);
  assert.equal(JSON.parse(chamadas[0].init.body).email, 'backoffice@investidora.exemplo');
  assert.equal(chamadas[0].init.headers.Authorization, 'Bearer k');
});
test('conta existente recebe link para definir a senha', async () => {
  const { chamadas, fetcher } = registrar([resposta(422, { msg: 'A user with this email address has already been registered' }), resposta(200)]);
  assert.deepEqual(await pedirPrimeiroAcesso('otavio.reis@holding.exemplo', { adminKey: 'k', fetcher }), { enviado: 'senha' });
  assert.match(chamadas[1].url, /\/auth\/v1\/recover\?redirect_to=/);
  assert.equal(chamadas[1].init.headers.Authorization, undefined);
});
test('erro desconhecido do convite não vira link de senha', async () => {
  const { chamadas, fetcher } = registrar([resposta(500, { msg: 'falha' })]);
  await assert.rejects(pedirPrimeiroAcesso('otavio.reis@holding.exemplo', { adminKey: 'k', fetcher }), { status: 502 });
  assert.equal(chamadas.length, 1);
});
