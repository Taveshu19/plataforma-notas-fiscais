// ler-documento — Edge Function do Supabase (cópia-fonte; a que roda está no projeto
// seu-projeto-expansao, publicada com verify_jwt = true).
//
// O painel manda o PDF que acabou de chegar na pasta (em base64) e recebe de volta os
// campos lidos pelo Gemini. Existe só pra chave nunca sair do Supabase: o index.html é
// público, qualquer coisa escrita nele é de todo mundo.
//
// O Gemini é chamado pelo OpenRouter, não direto no Google (out/2026): a chave gratuita do
// Google dava 503 o tempo todo e estourou a cota com ~20 notas, e o faturamento pago do
// Google pedia um mínimo que o Gustavo não tinha no Pix. O OpenRouter já tinha crédito.
// `data_collection: "deny"` restringe a provedores que não guardam nem treinam com o que
// mandamos — são notas fiscais da empresa.
//
// verify_jwt = true: só quem está logado no painel consegue chamar.
//
// Secrets:
//   OPENROUTER_API_KEY  — obrigatório
//   GEMINI_MODEL        — opcional, padrão abaixo. Trocar de modelo é só mudar o secret.
//   GEMINI_MODEL_RESERVA — opcional; o OpenRouter cai nele sozinho se o principal falhar.

const MODELO_PADRAO = "google/gemini-3.8-flash";
const MODELO_RESERVA_PADRAO = "google/gemini-3.7-flash"; // mesmo preço, outro modelo estável
const LIMITE_BYTES = 14 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const nulo = (t: string) => ({ type: [t, "null"] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: ["NF", "BOLETO", "OUTRO"] },
    subtipo: { type: "string", enum: ["DANFE", "CTE", "NFSE", "FATURA", "BOLETO", "RECIBO", "OUTRO"] },
    nf: nulo("string"),
    fornecedor: nulo("string"),
    cnpj_fornecedor: nulo("string"),
    valor: nulo("number"),
    valor_liquido: nulo("number"),
    emissao: nulo("string"),
    vencimento: nulo("string"),
    linha_digitavel: nulo("string"),
    notas_referenciadas: { type: "array", items: { type: "string" } },
    banco: nulo("string"),
    agencia: nulo("string"),
    conta_corrente: nulo("string"),
    chave_pix: nulo("string"),
    cnpj_tomador: nulo("string"),
    telefone_fornecedor: nulo("string"),
    email_fornecedor: nulo("string"),
    natureza: { type: "string", enum: ["Serviço", "Material", "CTE", "Fatura", "Remessa", "Nota de Débito", "INDEFINIDA"] },
    forma_pagamento_impressa: { type: "string", enum: ["BOLETO", "DEPOSITO_OU_PIX", "SEM_COBRANCA", "NAO_INFORMADA"] },
    campos_incertos: { type: "array", items: { type: "string" } },
  },
  required: [
    "tipo", "subtipo", "nf", "fornecedor", "cnpj_fornecedor", "valor", "valor_liquido", "emissao", "vencimento",
    "linha_digitavel", "notas_referenciadas", "banco", "agencia", "conta_corrente", "campos_incertos",
    "chave_pix", "natureza", "forma_pagamento_impressa", "cnpj_tomador",
    "telefone_fornecedor", "email_fornecedor",
  ],
};

const INSTRUCOES = `Você lê documentos fiscais brasileiros recebidos pelo contas a pagar da empresa
compradora (HOLDING / Empresa Exemplo). A empresa compradora é quem PAGA: ela NUNCA é o fornecedor.

Classifique o documento:
- tipo "NF" para DANFE (NF-e), DACTE (CT-e), NFS-e (nota de serviço), fatura ou recibo;
  tipo "BOLETO" para boleto bancário / ficha de compensação; "OUTRO" se não for nenhum desses.
- subtipo: DANFE, CTE, NFSE, FATURA, BOLETO, RECIBO ou OUTRO.
Se o PDF tem uma nota E um boleto juntos, classifique pelo documento da PRIMEIRA página.

Campos:
- nf: número do documento fiscal, só dígitos, sem zeros à esquerda e sem série
  (ex.: "Nº 000.042.126 Série 1" -> "42126"). Nunca use chave de acesso, protocolo, RPS ou
  código de verificação. Em BOLETO: o número da nota que o boleto paga, se estiver escrito
  (campo "Nº do documento" ou instruções); se não houver, null.
- fornecedor: razão social de quem EMITIU a nota / do BENEFICIÁRIO do boleto, como impressa.
- cnpj_fornecedor: CNPJ (ou CPF) desse emitente/beneficiário, só dígitos.
- valor: valor total a pagar, como número (ex.: 1234.56). Em NF, o valor total da nota
  (para NFS-e, o valor BRUTO do serviço, antes das retenções de impostos — é o que a
  equipe lança; teste de 06/10/2026: a Fornecedora I de R$ 850,00 tinha líquido de R$ 817,96).
  Em BOLETO, o "valor do documento".
- valor_liquido: só em NF. O valor LÍQUIDO a pagar depois das retenções de impostos (ISS, INSS,
  IR, PIS/COFINS/CSLL), quando a nota imprime esse valor ("Valor líquido", "Valor líquido da
  NFS-e") ou imprime as retenções. É o valor que o boleto dessa nota cobra. Se a nota não tem
  retenção, repita o valor total. Em BOLETO, null. (Teste de 29/10/2026: 16 de 16 notas tiveram o
  líquido igual ao boleto, ao centavo.)
- emissao: data de emissão, DD/MM/AAAA. vencimento: data de vencimento, DD/MM/AAAA.
- linha_digitavel: só em boleto, os 47 (ou 48) dígitos, só dígitos.
- notas_referenciadas: em boleto que paga VÁRIAS notas (lista de números nas instruções ou no documento),
  a lista COMPLETA com TODOS os números de todas as notas pagas (incluindo a que estiver no campo
  'Nº do documento' ou 'nf', sem omitir nenhuma); senão [].
- banco, agencia, conta_corrente: dados para depósito/TED impressos no documento, se houver.
- chave_pix: chave PIX impressa para pagamento, se houver; senão null.
- cnpj_tomador: CNPJ da empresa COMPRADORA (HOLDING / Empresa Exemplo) como impresso no campo
  destinatário / tomador do serviço / pagador / sacado — só dígitos. É a filial que recebeu a
  nota; cada filial tem um CNPJ diferente (11.444.777/XXXX-YY), então copie os 14 dígitos exatos.
  Se não aparecer, null.
- telefone_fornecedor: telefone do EMITENTE / BENEFICIÁRIO (o fornecedor), como impresso no bloco
  dele — com DDD, só dígitos (ex.: "(11) 99999-9999" -> "11999999999"). Se houver mais de um,
  prefira celular. NUNCA o telefone da HOLDING / Empresa Exemplo (destinatário/tomador/pagador),
  nem de banco, prefeitura ou transportadora. Se não aparecer, null.
- email_fornecedor: e-mail do EMITENTE / BENEFICIÁRIO, como impresso, em minúsculas. NUNCA um e-mail
  da HOLDING / Empresa Exemplo nem de prefeitura/portal de NFS-e. Se não aparecer, null.
- natureza (como a equipe classifica; na dúvida, "INDEFINIDA"):
  "Serviço" = NFS-e / nota de prestação de serviço; "Material" = DANFE de venda de
  produtos/mercadorias; "CTE" = conhecimento de transporte (DACTE/CT-e); "Fatura" = fatura ou
  cobrança de locação/serviço que não é DANFE nem NFS-e; "Remessa" = nota cuja natureza da
  operação é remessa/retorno (conserto, comodato, demonstração, empréstimo...), sem cobrança;
  "Nota de Débito" = nota de débito. Em BOLETO, use "INDEFINIDA".
- forma_pagamento_impressa: "BOLETO" se o documento é um boleto ou diz que o pagamento é por
  boleto; "DEPOSITO_OU_PIX" se indica pagamento por depósito, TED ou PIX (dados bancários ou
  chave PIX para pagar); "SEM_COBRANCA" se é remessa/retorno sem valor a pagar;
  "NAO_INFORMADA" se não diz.

Regras de precisão — isto vai direto para pagamento:
- Copie exatamente o que está impresso. NUNCA invente, complete ou deduza um valor.
- Se um campo não existe no documento, use null.
- Se um campo existe mas você não tem certeza absoluta de algum dígito (imagem borrada,
  cortada, sobreposta), preencha seu melhor palpite E coloque o nome do campo em
  campos_incertos.`;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);

  const chave = Deno.env.get("OPENROUTER_API_KEY");
  if (!chave) return resposta({ ok: false, erro: "OPENROUTER_API_KEY não configurada" }, 500);
  const modelos = [
    Deno.env.get("GEMINI_MODEL") || MODELO_PADRAO,
    Deno.env.get("GEMINI_MODEL_RESERVA") || MODELO_RESERVA_PADRAO,
  ];

  let pdf: string;
  try {
    const corpo = await req.json();
    pdf = String(corpo?.pdf_base64 || "");
  } catch {
    return resposta({ ok: false, erro: "corpo inválido" }, 400);
  }
  if (!pdf) return resposta({ ok: false, erro: "pdf_base64 vazio" }, 400);
  if (pdf.length * 0.75 > LIMITE_BYTES) return resposta({ ok: false, erro: "arquivo grande demais para o Gemini" }, 413);

  // 429/5xx são passageiros: tenta de novo, dentro de um prazo que cabe nos 90s que o
  // painel espera. O resto (sem crédito, pedido inválido) não melhora repetindo.
  const prazo = Date.now() + 70000;
  let ultimo: Response | null = null;
  for (let i = 0; i < 3 && Date.now() < prazo; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * i));
    const r = await chamarGemini(chave, modelos, pdf);
    if (r.status !== 503) return r;
    ultimo = r;
  }
  return ultimo ?? resposta({ ok: false, erro: "Gemini sem resposta no prazo" }, 504);
});

async function chamarGemini(chave: string, modelos: string[], pdf: string): Promise<Response> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${chave}`,
      "X-Title": "Painel Expansao - leitura de notas",
    },
    body: JSON.stringify({
      models: modelos,
      messages: [
        { role: "system", content: INSTRUCOES },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os campos deste documento." },
            { type: "file", file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${pdf}` } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "documento_fiscal", strict: true, schema: SCHEMA } },
      temperature: 0,
      plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
      provider: { require_parameters: true, data_collection: "deny" },
    }),
  });
  const texto = await r.text();
  if (!r.ok) {
    const passageiro = r.status === 429 || r.status >= 500;
    return resposta({ ok: false, erro: `OpenRouter ${r.status}: ${texto.slice(0, 500)}` }, passageiro ? 503 : 422);
  }
  try {
    const j = JSON.parse(texto);
    if (j.error) {
      const cod = Number(j.error.code) || 0;
      return resposta({ ok: false, erro: `OpenRouter: ${JSON.stringify(j.error).slice(0, 500)}` }, cod === 429 || cod >= 500 ? 503 : 422);
    }
    const conteudo = j?.choices?.[0]?.message?.content;
    if (!conteudo) return resposta({ ok: false, erro: "Gemini não devolveu texto", detalhe: texto.slice(0, 500) }, 503);
    const dados = JSON.parse(String(conteudo).replace(/^s*```(?:json)?|```s*$/g, ""));
    return resposta({ ok: true, modelo: j.model, custo_usd: j?.usage?.cost ?? null, dados });
  } catch (e) {
    return resposta({ ok: false, erro: "resposta fora do formato: " + String(e) }, 503);
  }
}
