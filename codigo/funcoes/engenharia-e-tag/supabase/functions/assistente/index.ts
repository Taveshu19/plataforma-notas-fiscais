// assistente — Edge Function do Supabase (cópia-fonte; a que roda está no projeto
// seu-projeto-engenharia, verify_jwt = true: só quem está logado no painel chama).
//
// Copiada da Expansão (seu-projeto-expansao) em 23/10/2026. Diferenças: o manual (MANUAL.md,
// escrito para a Engenharia), rastrear_nota sem a tabela `furos` (não existe aqui) e o X-Title.
// manual.ts é gerado do MANUAL.md:
//   node -e "const fs=require('fs');fs.writeFileSync('manual.ts','export const MANUAL = '+JSON.stringify(fs.readFileSync('MANUAL.md','utf8'))+';\n')"
// Papéis e tabelas: ../../migracao-2026-10-23-recopia-build132.sql. Senhas dos papéis em
// ~/.painel-nf/assistente-engenharia.env.
//
// Um agente que investiga o banco (papel assistente_leitura: só SELECT) e PROPÕE mudanças. Nada é
// alterado sem a pessoa clicar em Confirmar no painel; a proposta confirmada roda com o papel
// assistente_escrita, e um gatilho guarda a linha "antes" pra o Desfazer. As travas de verdade são os
// GRANTs desses papéis — este código pode errar e ainda assim não passar deles.
//
// Secrets:
//   ASSISTENTE_OPENROUTER_KEY  — chave própria, limite US$ 3 (não é a da leitura de notas)
//   ASSISTENTE_MODEL           — opcional, padrão abaixo
//   ASSISTENTE_DB_LEITURA_URL / ASSISTENTE_DB_ESCRITA_URL — conexões com os papéis (pooler)
//   SUPABASE_DB_URL            — padrão do Supabase; registro, propostas e desfazer

import postgres from "npm:postgres@3.4.5";
import { validarProposta, cortarResultado } from "./regras.ts";
import { MANUAL } from "./manual.ts";

const MODELO_PADRAO = "anthropic/claude-sonnet-5.5";
const MAX_PASSOS = 10;
const MAX_LINHAS_PROPOSTA = 50;
const VALIDADE_PROPOSTA_MIN = 15;
const MAX_CARACTERES_RESULTADO = 20000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const conexao = (url: string) => postgres(url, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });
let _leitura: ReturnType<typeof postgres> | null = null;
let _escrita: ReturnType<typeof postgres> | null = null;
let _servico: ReturnType<typeof postgres> | null = null;
const leitura = () => (_leitura ??= conexao(Deno.env.get("ASSISTENTE_DB_LEITURA_URL")!));
const escrita = () => (_escrita ??= conexao(Deno.env.get("ASSISTENTE_DB_ESCRITA_URL")!));
const servico = () => (_servico ??= conexao(Deno.env.get("SUPABASE_DB_URL")!));

// verify_jwt = true: o gateway já validou a assinatura; aqui só lemos quem é.
function quemChamou(req: Request): string | null {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return p.email || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);
  const usuario = quemChamou(req);
  if (!usuario) return resposta({ ok: false, erro: "sem usuário" }, 401);
  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: "corpo inválido" }, 400); }

  try {
    // O nome vem do painel (o mesmo "Operando como" que vai pro histórico). Só serve pra exibição e
    // histórico; quem é dono da proposta é decidido pelo e-mail do JWT.
    const nome = String(corpo.nome || "").trim().slice(0, 60) || usuario;
    const sessao = /^[0-9a-f-]{36}$/i.test(String(corpo.sessao || "")) ? String(corpo.sessao) : null;
    if (corpo.acao === "perguntar") return resposta(await perguntar(usuario, nome, corpo.mensagens, sessao));
    if (corpo.acao === "confirmar") return resposta(await confirmar(usuario, nome, Number(corpo.proposta_id)));
    if (corpo.acao === "desfazer") return resposta(await desfazer(usuario, nome, Number(corpo.proposta_id)));
    if (corpo.acao === "cancelar") return resposta(await cancelar(usuario, Number(corpo.proposta_id)));
    return resposta({ ok: false, erro: "ação desconhecida" }, 400);
  } catch (e) {
    console.error("[assistente]", e);
    return resposta({ ok: false, erro: "falha interna: " + String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});

// ---------------------------------------------------------------- conversa

const FERRAMENTAS = [
  {
    type: "function",
    function: {
      name: "rastrear_nota",
      description: "Linha do tempo de uma nota: linhas do painel, histórico, exclusões, arquivos recebidos e modo sombra. Comece por aqui quando houver número de nota ou fornecedor.",
      parameters: {
        type: "object",
        properties: {
          nf: { type: "string", description: "número da nota (com ou sem zeros à esquerda)" },
          fornecedor: { type: "string", description: "parte do nome do fornecedor" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_banco",
      description: "Roda um SELECT no banco do painel (somente leitura, até 5 s, até 200 linhas). Use para o que rastrear_nota não cobre.",
      parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_mudanca",
      description: "Prepara uma mudança para a pessoa confirmar com UM clique. Não executa nada. Só use se a pessoa pediu a correção. Uma mudança pode ter até 5 comandos, que rodam juntos, na ordem, tudo ou nada (ex.: restaurar = linha + registro do arquivo + tirar a marca).",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "o que muda e por quê, em português simples" },
          comandos: {
            type: "array", minItems: 1, maxItems: 5,
            items: { type: "string", description: "um INSERT/UPDATE/DELETE, filtrando pelo id exato" },
          },
        },
        required: ["descricao", "comandos"],
      },
    },
  },
];

type Msg = { role: string; content: any; tool_calls?: any[]; tool_call_id?: string; name?: string };

async function perguntar(usuario: string, nome: string, mensagens: { role: string; content: string }[], sessao: string | null) {
  let historico = (Array.isArray(mensagens) ? mensagens : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12);
  const pergunta = historico.filter((m) => m.role === "user").pop()?.content || "";
  if (!pergunta) return { ok: false, erro: "pergunta vazia" };
  // Histórico vindo do REGISTRO, não do navegador (build110): o navegador só tem o texto das
  // respostas, e sem saber que tinha consultado o banco (e quando) o modelo concluía "respondi sem
  // consultar" e pedia desculpas por números que estavam certos — "últimos 20 minutos" às 13:13 e
  // às 13:29 são janelas diferentes. Cada resposta anterior volta com a hora e as consultas feitas.
  if (sessao) {
    const anteriores = await servico()`
      select pergunta, resposta, passos, criado_em from assistente_conversas
      where usuario = ${usuario} and sessao = ${sessao} and resposta is not null
      order by criado_em desc limit 6`;
    if (anteriores.length) {
      historico = [];
      for (const a of [...anteriores].reverse()) {
        const hora = new Date(a.criado_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const ferramentas = (Array.isArray(a.passos) ? a.passos : []).map((p: any) => p.ferramenta).filter(Boolean);
        const nota = ferramentas.length
          ? `[registro interno: respondida às ${hora}, depois de consultar: ${ferramentas.join(", ")}]`
          : `[registro interno: respondida às ${hora}, sem consultar o banco]`;
        historico.push({ role: "user", content: a.pergunta });
        historico.push({ role: "assistant", content: `${a.resposta}

${nota}` });
      }
      historico.push({ role: "user", content: pergunta });
    }
  }

  const [{ id: conversaId }] = await servico()`
    insert into assistente_conversas (usuario, pergunta, modelo, sessao)
    values (${usuario}, ${pergunta}, ${modelo()}, ${sessao}) returning id`;

  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const msgs: Msg[] = [
    {
      role: "system",
      content: [
        { type: "text", text: MANUAL, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Agora são ${agora} (Brasília). Quem pergunta: ${nome} (${usuario}). No histórico e nas exclusões a equipe aparece pelo nome (ex.: \"Beatriz\"); se o nome bater com quem pergunta, diga \"foi você\".` },
      ],
    },
    ...historico.map((m) => ({ role: m.role, content: m.content })),
  ];

  const passos: unknown[] = [];
  const propostas: any[] = [];
  let custo = 0;
  let texto = "";
  let erro: string | null = null;

  try {
    for (let passo = 0; passo <= MAX_PASSOS; passo++) {
      const ultimo = passo === MAX_PASSOS;
      const r = await chamarModelo(msgs, ultimo);
      custo += r.custo;
      const m = r.mensagem;
      if (!m.tool_calls?.length || ultimo) {
        // O modelo às vezes imita a anotação "[registro interno: ...]" do histórico; ela não é pra tela.
        texto = String(m.content || "").replace(/\n*\[registro interno:[\s\S]*$/i, "").trim();
        if (ultimo && m.tool_calls?.length && !texto) texto = "Não consegui terminar a investigação no limite de passos.";
        break;
      }
      msgs.push({ role: "assistant", content: m.content || "", tool_calls: m.tool_calls });
      for (const call of m.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* args vazios */ }
        const saida = await rodarFerramenta(call.function.name, args, { usuario, conversaId, propostas });
        const conteudo = JSON.stringify(saida).slice(0, MAX_CARACTERES_RESULTADO);
        passos.push({ ferramenta: call.function.name, args, resultado: conteudo.slice(0, 2000) });
        msgs.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: conteudo });
      }
    }
  } catch (e) {
    erro = String((e as Error)?.message || e);
  }

  await servico()`
    update assistente_conversas set resposta = ${texto || null}, passos = ${servico().json(passos as any)},
      propostas = ${propostas.map((p) => p.id)}, custo_usd = ${custo}, erro = ${erro}
    where id = ${conversaId}`;

  if (erro === "limite") {
    return { ok: false, erro: "limite", mensagem: "Limite de uso do assistente atingido este mês — fale com o Gustavo.", conversa_id: conversaId };
  }
  if (erro) return { ok: false, erro: "Não consegui responder agora (" + erro.slice(0, 200) + "). Tente de novo.", conversa_id: conversaId };
  return { ok: true, resposta: texto, propostas, conversa_id: conversaId, custo_usd: custo };
}

function modelo() { return Deno.env.get("ASSISTENTE_MODEL") || MODELO_PADRAO; }

async function chamarModelo(msgs: Msg[], semFerramentas: boolean) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("ASSISTENTE_OPENROUTER_KEY")}`,
      "X-Title": "Painel Engenharia - assistente",
    },
    body: JSON.stringify({
      model: modelo(),
      messages: msgs,
      tools: FERRAMENTAS,
      tool_choice: semFerramentas ? "none" : "auto",
      temperature: 0,
      max_tokens: 2000,
      usage: { include: true },
      provider: { data_collection: "deny" },
    }),
  });
  const texto = await r.text();
  // Sem crédito / limite da chave estourado. 429 (muitas requisições) NÃO é isso — cai no erro comum.
  if (!r.ok && (r.status === 402 || r.status === 403 || /insufficient credits|key limit|credit limit/i.test(texto))) {
    throw new Error("limite");
  }
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${texto.slice(0, 300)}`);
  const j = JSON.parse(texto);
  if (j.error) {
    const cod = Number(j.error.code) || 0;
    if (cod === 402 || cod === 403) throw new Error("limite");
    throw new Error(`OpenRouter: ${JSON.stringify(j.error).slice(0, 300)}`);
  }
  return { mensagem: j.choices?.[0]?.message || {}, custo: Number(j.usage?.cost) || 0 };
}

// ---------------------------------------------------------------- ferramentas

async function rodarFerramenta(nome: string, args: any, ctx: { usuario: string; conversaId: number; propostas: any[] }) {
  try {
    if (nome === "consultar_banco") return await consultarBanco(String(args.sql || ""));
    if (nome === "rastrear_nota") return await rastrearNota(args.nf, args.fornecedor);
    if (nome === "propor_mudanca") {
      const comandos = Array.isArray(args.comandos) ? args.comandos.map(String) : args.sql ? [String(args.sql)] : [];
      return await proporMudanca(String(args.descricao || ""), comandos, ctx);
    }
    return { erro: `ferramenta desconhecida: ${nome}` };
  } catch (e) {
    return { erro: String((e as Error)?.message || e).slice(0, 500) };
  }
}

async function consultarBanco(sql: string) {
  if (!/^\s*(select|with)\b/i.test(sql)) return { erro: "consultar_banco só aceita SELECT (para mudar algo, use propor_mudanca)" };
  const linhas = await leitura().unsafe(sql);
  const { linhas: l, cortado } = cortarResultado([...linhas]);
  return { linhas: l, total: linhas.length, cortado };
}

async function rastrearNota(nfBruto?: string, fornecedorBruto?: string) {
  const nf = String(nfBruto || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const forn = String(fornecedorBruto || "").trim();
  if (!nf && forn.length < 3) return { erro: "informe o número da nota ou pelo menos 3 letras do fornecedor" };
  const db = leitura();
  const padraoForn = `%${forn}%`;
  const padraoNf = nf.length >= 3 ? `%${nf}%` : null;

  const linhas = await db`
    select id, nf, fornecedor, cnpj_fornecedor, unidade, valor, emissao, vencimento, status, natureza, pagamento,
      travado_por, enviado_por, data_envio, monday_item_id, monday_nf_enviado, monday_boletos_enviados,
      arquivo_nf_nome, arquivo_boleto_nome, boleto_grupo_notas, possivel_duplicata, requer_revisao,
      link_portal is not null as veio_por_link, observacoes, criado_em, atualizado_em,
      extracao_original->>'fonte' as lido_por, extracao_original->'_alertasGemini' as alertas_gemini,
      extracao_original->'bruto_gemini'->>'tipo' as tipo_gemini
    from lancamentos
    where (${nf} <> '' and ltrim(regexp_replace(coalesce(nf,''), '\\D', '', 'g'), '0') = ltrim(${nf}, '0'))
       or (${forn} <> '' and ${nf} = '' and fornecedor ilike ${padraoForn})
       or (${forn} <> '' and ${nf} <> '' and fornecedor ilike ${padraoForn} and coalesce(nf,'') ilike ${"%" + nf + "%"})
    order by criado_em desc limit 30`;
  const ids = linhas.map((l: any) => l.id);

  const [historico, fotos, marcas, arquivos, sombra] = await Promise.all([
    ids.length ? db`select lancamento_id, status, usuario, criado_em, detalhes from historico_status
      where lancamento_id = any(${ids}) order by criado_em limit 150` : [],
    db`select id, lancamento_id, excluido_por, excluido_em, foto - 'linha' - 'ledger' as foto,
         foto ? 'linha' as pode_restaurar_completo
       from exclusoes_foto
       where (${nf} <> '' and ltrim(regexp_replace(coalesce(foto->>'nf',''), '\\D', '', 'g'), '0') = ltrim(${nf}, '0'))
          or (${forn} <> '' and foto->>'fornecedor' ilike ${padraoForn})
       order by excluido_em desc limit 20`,
    padraoNf ? db`select hash_arquivo, nome_arquivo, excluido_por, excluido_em, lancamento_id from exclusoes_recentes
      where nome_arquivo ilike ${padraoNf} order by excluido_em desc limit 20` : [],
    db`select hash, nome_arquivo, tipo, lancamento_id, path_storage, criado_em from arquivos_processados
       where lancamento_id = any(${ids}) ${padraoNf ? db`or nome_arquivo ilike ${padraoNf}` : db``}
       order by criado_em limit 40`,
    ids.length ? db`select lancamento_id, foto_em from sombra_envio where lancamento_id = any(${ids})` : [],
  ]);
  return { linhas, historico, exclusoes_foto: fotos, marcas_de_excluido: marcas, arquivos_recebidos: arquivos, modo_sombra: sombra };
}

// 19/11/2026 (Gustavo): consulta à Monday removida. A Monday fica só como histórico.

// ---------------------------------------------------------------- propostas

const ENSAIO = Symbol("ensaio");

function previaDe(registros: any[], tabela: string) {
  const ignorar = new Set(["atualizado_em"]);
  return registros
    .filter((r) => r.tabela === tabela)
    .slice(0, 20)
    .map((r) => {
      const antes = r.antes || {}, depois = r.depois || {};
      const campos = r.operacao === "UPDATE"
        ? Object.keys(depois).filter((k) => !ignorar.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
        : ["nf", "fornecedor", "valor", "status", "nome_arquivo", "tipo", "excluido_por"].filter((k) => k in (r.depois ? depois : antes));
      return {
        tabela: r.tabela, operacao: r.operacao, id: r.chave?.id,
        mudancas: campos.map((k) => ({ campo: k, de: antes[k] ?? null, para: depois[k] ?? null })),
      };
    });
}

const MAX_COMANDOS = 5;

function validarComandos(comandos: string[]) {
  if (!comandos.length) return { ok: false as const, motivo: "nenhum comando" };
  if (comandos.length > MAX_COMANDOS) return { ok: false as const, motivo: `no máximo ${MAX_COMANDOS} comandos por mudança` };
  const tabelas: string[] = [];
  for (const [i, c] of comandos.entries()) {
    const v = validarProposta(c);
    if (!v.ok) return { ok: false as const, motivo: `comando ${i + 1}: ${v.motivo}` };
    tabelas.push(v.tabela);
  }
  return { ok: true as const, tabelas };
}

async function proporMudanca(descricao: string, comandos: string[], ctx: { usuario: string; conversaId: number; propostas: any[] }) {
  const v = validarComandos(comandos);
  if (!v.ok) return { recusada: true, motivo: v.motivo };
  if (descricao.trim().length < 10) return { recusada: true, motivo: "a descrição precisa explicar a mudança em português" };

  // Ensaio: roda tudo numa transação que é desfeita no fim. Cada comando precisa mudar alguma linha
  // da sua tabela — comando que não muda nada quase sempre é filtro errado.
  let registros: any[] = [];
  let falhaPasso: string | null = null;
  try {
    await escrita().begin(async (tx: any) => {
      await tx.unsafe(`set local assistente.proposta_id = '-2'`);
      for (const [i, c] of comandos.entries()) {
        const antes = (await tx.unsafe(`select count(*)::int n from assistente_desfazer where proposta_id = -2 and tabela = '${v.tabelas[i]}'`))[0].n;
        await tx.unsafe(c);
        const depois = (await tx.unsafe(`select count(*)::int n from assistente_desfazer where proposta_id = -2 and tabela = '${v.tabelas[i]}'`))[0].n;
        if (depois === antes) { falhaPasso = `o comando ${i + 1} não muda nenhuma linha — confira o filtro (id)`; break; }
      }
      registros = [...await tx.unsafe(`select tabela, operacao, chave, antes, depois from assistente_desfazer where proposta_id = -2 order by id`)];
      throw ENSAIO;
    });
  } catch (e) {
    if (e !== ENSAIO) return { recusada: true, motivo: "o ensaio falhou: " + String((e as Error)?.message || e).slice(0, 300) };
  }
  if (falhaPasso) return { recusada: true, motivo: falhaPasso };
  const alvos = new Set(v.tabelas);
  const afetadas = registros.filter((r) => alvos.has(r.tabela)).length;
  if (afetadas > MAX_LINHAS_PROPOSTA) return { recusada: true, motivo: `a mudança alteraria ${afetadas} linhas; seja específico (máximo ${MAX_LINHAS_PROPOSTA})` };

  const previa = { linhas_afetadas: afetadas, itens: [...alvos].flatMap((t) => previaDe(registros, t)).slice(0, 20) };
  const [p] = await servico()`
    insert into assistente_propostas (usuario, conversa_id, descricao, sql, comandos, previa)
    values (${ctx.usuario}, ${ctx.conversaId}, ${descricao}, ${comandos.join(";\n")}, ${comandos},
            ${servico().json(previa as any)})
    returning id, descricao, previa, estado`;
  ctx.propostas.push(p);
  return { proposta_criada: p.id, linhas_afetadas: afetadas, aviso: "Ainda NÃO foi feito. A pessoa precisa clicar em Confirmar no painel." };
}

async function propostaDaPessoa(usuario: string, id: number) {
  if (!Number.isFinite(id)) return null;
  const [p] = await servico()`select * from assistente_propostas where id = ${id} and usuario = ${usuario}`;
  return p || null;
}

async function confirmar(usuario: string, nome: string, id: number) {
  const p = await propostaDaPessoa(usuario, id);
  if (!p) return { ok: false, erro: "proposta não encontrada" };
  if (p.estado !== "pendente") return { ok: false, erro: `esta proposta já está "${p.estado}"` };
  if (Date.now() - new Date(p.criado_em).getTime() > VALIDADE_PROPOSTA_MIN * 60000) {
    await servico()`update assistente_propostas set estado = 'expirada' where id = ${id}`;
    return { ok: false, erro: "a proposta expirou (mais de 15 minutos) — peça de novo ao assistente" };
  }
  const comandos: string[] = p.comandos?.length ? p.comandos : [p.sql];
  const v = validarComandos(comandos);
  if (!v.ok) return { ok: false, erro: v.motivo };
  // Marca antes de executar: dois cliques (ou duas abas) não executam duas vezes.
  const [trava] = await servico()`
    update assistente_propostas set estado = 'executada', executada_em = now()
    where id = ${id} and estado = 'pendente' returning id`;
  if (!trava) return { ok: false, erro: "esta proposta já foi confirmada" };
  try {
    await escrita().begin(async (tx: any) => {
      await tx.unsafe(`set local assistente.proposta_id = '${Number(id)}'`);
      for (const c of comandos) await tx.unsafe(c);
    });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    await servico()`update assistente_propostas set estado = 'falhou', erro = ${msg}, executada_em = null where id = ${id}`;
    return { ok: false, erro: "não deu certo: " + msg };
  }
  const afetadas = await servico()`
    select chave->>'id' as id from assistente_desfazer where proposta_id = ${id} and tabela = 'lancamentos'`;
  const linhas = await servico()`select count(*)::int as n from assistente_desfazer where proposta_id = ${id} and tabela = any(${v.tabelas})`;
  for (const a of afetadas) {
    await registrarNoHistorico(a.id, nome, { proposta: id, descricao: p.descricao });
  }
  return { ok: true, linhas: linhas[0].n };
}

// historico_status tem FK com ON DELETE CASCADE: desfazer uma restauração apaga a linha de novo, e
// gravar histórico de linha que não existe quebraria. Só grava se a linha existe.
async function registrarNoHistorico(lancamentoId: string, usuario: string, detalhes: Record<string, unknown>) {
  await servico()`insert into historico_status (lancamento_id, status, usuario, detalhes)
    select ${lancamentoId}, 'Assistente', ${usuario}, ${servico().json(detalhes as any)}
    where exists (select 1 from lancamentos where id = ${lancamentoId})`;
}

async function desfazer(usuario: string, nome: string, id: number) {
  const p = await propostaDaPessoa(usuario, id);
  if (!p) return { ok: false, erro: "proposta não encontrada" };
  if (p.estado !== "executada") return { ok: false, erro: `só dá pra desfazer o que foi executado (está "${p.estado}")` };
  const [{ n }] = await servico()`select assistente_desfazer_proposta(${id}) as n`;
  const afetadas = await servico()`
    select distinct chave->>'id' as id from assistente_desfazer where proposta_id = ${id} and tabela = 'lancamentos'`;
  for (const a of afetadas) {
    await registrarNoHistorico(a.id, nome, { proposta: id, desfeita: true, descricao: p.descricao });
  }
  return { ok: true, linhas: n };
}

async function cancelar(usuario: string, id: number) {
  const p = await propostaDaPessoa(usuario, id);
  if (!p) return { ok: false, erro: "proposta não encontrada" };
  if (p.estado === "pendente") await servico()`update assistente_propostas set estado = 'cancelada' where id = ${id}`;
  return { ok: true };
}
