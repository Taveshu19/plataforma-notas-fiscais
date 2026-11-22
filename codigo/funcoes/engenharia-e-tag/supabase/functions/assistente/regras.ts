// Regras das propostas de mudança do assistente (ver ../ASSISTENTE.md).
//
// Esta validação é a PRIMEIRA trava, não a única: o comando ainda roda com o papel
// assistente_escrita, cujos GRANTs são a trava de verdade. O papel desta função é recusar cedo,
// com um motivo legível, o que o papel recusaria de qualquer jeito — e garantir "uma proposta =
// um comando", que é o que deixa o ensaio, a prévia e o desfazer fiéis ao que vai acontecer.
// Sem dependências: roda igual no Deno (Edge Function) e no Node (teste).

export const TABELAS_ESCRITA: Record<string, ("INSERT" | "UPDATE" | "DELETE")[]> = {
  lancamentos: ["INSERT", "UPDATE"],
  arquivos_processados: ["INSERT", "UPDATE"],
  exclusoes_recentes: ["DELETE"],
  historico_status: ["INSERT"],
};

const PROIBIDAS = /\b(drop|alter|truncate|grant|revoke|create|copy|reset|do|call|returning|execute|prepare|listen|notify|vacuum|lock|comment|security|set_config|pg_sleep|dblink|lo_import|lo_export|pg_read_file|pg_read_binary_file|pg_terminate_backend|pg_cancel_backend)\b/i;

type Resultado = { ok: true; tabela: string; operacao: string } | { ok: false; motivo: string };

// Troca textos por '' e comentários por espaço, e tira as aspas de identificadores simples.
// O que sobra é o "esqueleto" do comando, onde dá pra procurar ; e palavras sem falso positivo.
function esqueleto(sql: string): string | null {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i], d = sql[i + 1];
    if (c === "-" && d === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += " ";
    } else if (c === "/" && d === "*") {
      const fim = sql.indexOf("*/", i + 2);
      if (fim < 0) return null;
      i = fim + 2;
      out += " ";
    } else if (c === "$") {
      // dollar-quoting ($$...$$, $x$...$x$) esconde qualquer coisa — não é usado em proposta
      if (/^\$[a-zA-Z_]*\$/.test(sql.slice(i))) return null;
      out += c; i++;
    } else if (c === "'") {
      const escapeBarra = /[eE]$/.test(out) && !/[a-zA-Z0-9_][eE]$/.test(out);
      i++;
      for (;;) {
        if (i >= sql.length) return null;
        if (escapeBarra && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          i++; break;
        }
        i++;
      }
      out += "''";
    } else if (c === '"') {
      const fim = sql.indexOf('"', i + 1);
      if (fim < 0) return null;
      const nome = sql.slice(i + 1, fim);
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) return null;
      out += nome.toLowerCase();
      i = fim + 1;
    } else {
      out += c; i++;
    }
  }
  return out;
}

export function validarProposta(sql: string): Resultado {
  const sk = esqueleto(String(sql ?? ""));
  if (sk === null) return { ok: false, motivo: "comando com texto, comentário ou aspas mal fechados, ou com $$" };
  const corpo = sk.trim().replace(/;\s*$/, "").trim().toLowerCase();
  if (!corpo) return { ok: false, motivo: "comando vazio" };
  if (corpo.includes(";")) return { ok: false, motivo: "uma proposta precisa ser UM comando só" };
  const proibida = corpo.match(PROIBIDAS);
  if (proibida) return { ok: false, motivo: `palavra não permitida em proposta: ${proibida[1]}` };

  const formas: ["INSERT" | "UPDATE" | "DELETE", RegExp][] = [
    ["INSERT", /^insert\s+into\s+(?:public\s*\.\s*)?([a-z_][a-z0-9_]*)/],
    ["UPDATE", /^update\s+(?:only\s+)?(?:public\s*\.\s*)?([a-z_][a-z0-9_]*)/],
    ["DELETE", /^delete\s+from\s+(?:only\s+)?(?:public\s*\.\s*)?([a-z_][a-z0-9_]*)/],
  ];
  let operacao: "INSERT" | "UPDATE" | "DELETE" | null = null, tabela = "";
  for (const [op, re] of formas) {
    const m = corpo.match(re);
    if (m) { operacao = op; tabela = m[1]; break; }
  }
  if (!operacao) return { ok: false, motivo: "proposta precisa começar com INSERT INTO, UPDATE ou DELETE FROM" };
  const permitidas = TABELAS_ESCRITA[tabela];
  if (!permitidas) return { ok: false, motivo: `a tabela ${tabela} não pode ser alterada pelo assistente` };
  if (!permitidas.includes(operacao)) {
    return { ok: false, motivo: `${operacao} não é permitido em ${tabela} (permitido: ${permitidas.join(", ")})` };
  }
  return { ok: true, tabela, operacao };
}

export function cortarResultado(linhas: unknown[], max = 200): { linhas: unknown[]; cortado: boolean } {
  return linhas.length > max ? { linhas: linhas.slice(0, max), cortado: true } : { linhas, cortado: false };
}
