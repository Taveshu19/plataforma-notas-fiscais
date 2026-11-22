# 05 · Escrituração

O botão **"Enviar para escriturar"** chama a função `escriturar-painel`. Ele funciona para uma nota ou para um lote: em "Ver tudo e enviar para escriturar", o "−" tira uma nota do lote.

A função monta a nota a partir do banco:
- usa o lançamento, mais as **correções feitas no painel**, que valem sobre tudo;
- acha o **código do emitente** no cadastro de fornecedores do ERP, copiado para o banco (`datasul_fornecedores`), pelo CNPJ;
- converte unidade, natureza e forma de pagamento para os valores da lista da escrituração;
- junta os **anexos sem repetição**: a nota, todos os boletos vinculados e os arquivos incluídos depois. Os arquivos que alguém **removeu da nota** no painel não vão.

Depois, ela envia por um de três caminhos.

## Para onde vai cada nota

```mermaid
flowchart TD
  N["Nota na etapa Escrituração"] --> A{"Área"}
  A -->|Expansão| E1{"Unidade de envio ao fiscal<br/>ou natureza Remessa?"}
  E1 -->|sim| FI["E-mail ao fiscal da unidade<br/>→ etapa fiscal"]
  E1 -->|não| SP["E-mail [ESCRITURAR] para a caixa de quem clicou<br/>→ fluxo dessa pessoa cria o item no SharePoint<br/>→ etapa encaminhada"]
  A -->|Engenharia| P{"Pagador"}
  P -->|"qualquer, natureza Remessa"| FI
  P -->|"Holding, unidade de envio ao fiscal"| FI
  P -->|"Holding, demais unidades"| SP
  P -->|"Empresa Exemplo, Parceira, Condomínio"| AZ["E-mail 'Planilha Azul' ao financeiro<br/>com cópia para a escrituração e quem clicou"]
  P -->|TAG| T["Não escritura: vai para o painel da TAG"]
  P -->|"outro ou vazio"| NE["Não envia; o painel diz o motivo"]
```

| Área | Caso | Destino |
|---|---|---|
| Expansão | Unidade de envio ao fiscal (na demonstração, "Pinhal") ou natureza **Remessa** | E-mail ao fiscal da unidade (tabela `fiscais_unidade`, 21 unidades). Etapa `fiscal` |
| Expansão | Demais | SharePoint, pelo caminho abaixo. Etapa `encaminhada` |
| Engenharia | Natureza **Remessa**, qualquer pagador | E-mail ao fiscal |
| Engenharia | Pagador **Holding**, unidade de envio ao fiscal | E-mail ao fiscal |
| Engenharia | Pagador **Holding**, demais unidades | SharePoint |
| Engenharia | Pagador **Empresa Exemplo**, **Parceira** ou **Condomínio** | E-mail "Planilha Azul" para os destinatários do financeiro |
| Engenharia | Pagador **TAG** | Não vai para a escrituração: segue para o [painel da TAG](10-modulos.md#painel-da-tag) |
| Engenharia | Outro pagador ou sem pagador | Não envia. O painel avisa o motivo |

### O caminho do SharePoint

1. A função manda, pela **caixa da escrituração** (Microsoft Graph), um e-mail `[ESCRITURAR] …` para a **caixa de quem clicou**.
2. Na conta dessa pessoa, o fluxo **"Escrituração Automática"** do Power Automate vê o e-mail e cria o item da escrituração na lista do SharePoint, com os anexos.

**Por que pela caixa de quem clicou:** o item precisa ser criado em nome de quem enviou. O fluxo roda na conta de cada pessoa, que precisa ter o fluxo ligado e vigiando a pasta certa.

## Regras do envio

- **Real ou prévia:** o segredo `ESCRITURACAO_EMAIL_MODO` decide. Na prévia, **todos** os e-mails vão para o endereço de teste (`REVIEW_EMAIL`), com a tabela montada para conferência.
- **Reenvio:** só para nota **recusada e corrigida**. Fora disso, o botão não reenvia.
- **Histórico:** cada envio vira uma linha no histórico da nota, com o destino.

## O retorno: pedido aprovado ou recusado

Depois da escrituração, o ERP aprova ou rejeita o pedido. A resposta chega por e-mail, de um robô ("RPA"), num texto fixo:

```
Seu pedido 131629, foi Aprovado por <quem> e seguirá para Escrituração!! ... Motivo: ...
Seu pedido 131426, foi Rejeitado por <quem> e não seguirá para Escrituração! ... Motivo: ...
```

```mermaid
sequenceDiagram
  participant R as Robô do ERP
  participant PA as Power Automate<br/>"Resultado da aprovação"
  participant F as retorno-escrituracao
  participant DB as aprovacoes_notas
  R->>PA: e-mail com o resultado
  PA->>F: POST {assunto, texto}<br/>cabeçalho x-chave-retorno
  F->>F: confere a chave; lê pedido, resultado, quem e motivo
  F->>DB: acha a nota pelo número do pedido
  alt nota em Encaminhadas e ainda sem esse registro
    F->>DB: decisao = aprovada/recusada + linha no histórico
  else já registrado
    F-->>PA: ok (nada a fazer)
  else nota em outra etapa
    F-->>PA: 409, o retorno fica para quando ela for enviada
  end
```

- **Autenticação por chave:** o fluxo manda o segredo `RETORNO_CHAVE` no cabeçalho `x-chave-retorno`. A função não usa login, porque quem chama é um fluxo, e não uma pessoa (`verify_jwt = false`).
- **Idempotente:** se o mesmo e-mail chegar duas vezes, o segundo não duplica o histórico.
- **Plano B:** sem o fluxo ligado, a equipe registra o retorno pela própria janela da nota.
- A recusa volta para a equipe, que corrige a nota e faz o **reenvio**.

## Código

- `codigo/funcoes/expansao/supabase/functions/escriturar-painel/index.ts`
- `codigo/funcoes/engenharia-e-tag/supabase/functions/escriturar-painel/index.ts`: regras por pagador
- `codigo/funcoes/*/supabase/functions/retorno-escrituracao/index.ts`
