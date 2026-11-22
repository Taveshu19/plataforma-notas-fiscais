# Notas Fiscais — cópia local do quadro Monday

> Documento da fase local (14/11/2026). Em 16/11 a mesma API passou para a Edge Function `tag-api`, no Supabase, e a tela ganhou login obrigatório (veja [docs/10](../../../docs/10-modulos.md#painel-da-tag)). A demonstração deste repositório é montada por `tools/build-demo.mjs`, sem servidor.

Réplica funcional do quadro **Notas Fiscais** (Monday `18407995628`, workspace Administrativo), com a mesma estrutura de grupos, colunas, formulário e automações, na linguagem visual da tela de expansão.

**A Monday não é alterada.** Esta tela lê um snapshot exportado em 14/11/2026 e grava tudo localmente, em `data/`. Nenhuma ação aqui chama a API da Monday.

## Ajustes de 14/11/2026 — quadros, PDFs e edição

- Removidas somente as visualizações **Quadro principal** e **Automações**. Otávio, Formulário, Notas TAG, Histórico e as regras existentes continuam disponíveis.
- Quadros e cartões oferecem **Prévia do PDF** quando há cópia local. Clicar na prévia abre o detalhe com documento e campos lado a lado; seletor troca entre PDFs sem refazer os campos. Arquivos sem cópia local continuam pelos links de origem.
- Formulário também mostra o PDF selecionado ao lado dos campos. No celular, documento e campos ficam empilhados.
- Edição em todas as rotas de alteração exige token validado no servidor pelo Supabase Auth de Engenharia e e-mail confirmado **otavio.reis@holding.exemplo** ou **backoffice@investidora.exemplo**. Comparação ignora maiúsculas/minúsculas. Consulta local continua disponível. Senha provisória exige troca no ecossistema antes de editar.
- Botão **Entrar para editar** aceita e-mail/senha da conta existente; token fica apenas na memória e recarregar exige entrar novamente. Não foram criadas contas nem enviados convites. A existência/acesso efetivo da conta BO depende do cadastro nesse Auth.
- Validação: 28 testes passaram; bloqueio HTTP 403 em seis rotas de escrita anônima; PDF real servido e exibido no navegador; desktop e celular conferidos. Login com as senhas reais das duas contas não foi exercitado.
- Aplicado à cópia local, sem publicação, sem alterar registros ou gravar na Monday.

## Como rodar

```
npm start            # http://127.0.0.1:3420
npm test             # 28 testes de regras e armazenamento (usam pasta temporária)
npm run snapshot     # regenera data/snapshot.json a partir do export salvo
```

Requer Node 22.13 ou superior. Sem dependências para instalar. O servidor escuta somente em `127.0.0.1`.

## O que foi copiado

**Grupos → abas.** Os 12 grupos do quadro, na mesma ordem, cada um com o contador atual:

| Empresa | Grupo no Monday | Etapa |
|---|---|---|
| Holding | Notas pendentes de aprovação / aprovadas / enviadas | pending / approved / sent |
| Empresa Exemplo | Notas pendentes de aprovação / aprovadas / Enviadas | pending / approved / sent |
| TAG | Notas Fiscais Pendentes de aprovação / Notas aprovadas / Aguardando Comprovante / Pagas / NFs Reprovados | pending / approved / awaiting / paid / rejected |
| Outros | Não Pertencem a engenharia | other |

**Colunas.** Todas as colunas com dados: NF, arquivos (Nota Fiscal e Comprovantes), valor, narrativa, endereço (relação com o quadro Ímóveis), categoria, pagamento, dados bancários, observações, Aprovação Otávio, Aprovação Eng., Departamento / Empresa, Pagador, Fornecedor (CNPJ e nome), Status, 12 datas de vencimento, data de emissão, log de criação.

**Automações.** As cinco do quadro, com a mesma lógica (ids originais em `lib/catalog.mjs`):

| Id | Gatilho | Ação | Estado |
|---|---|---|---|
| 7917895475 | Item criado | Nome = "Número da NF - fornecedor"; Pagador = TAG | ativa |
| 7917897786 | Otávio = Aprovado | Mover para TAG - Notas aprovadas | ativa |
| 7917908135 | Otávio = Reprovado | E-mail aos assinantes e mover para TAG - NFs Reprovados | **desativada**, como na Monday |
| 7918501812 | Status = Em andamento | Mover para TAG - Aguardando Comprovante | ativa |
| 7918501969 | Comprovantes alterado | Status = Pago e mover para TAG - Pagas | ativa |

A aba de Automações foi retirada; os estados existentes das regras foram preservados. Ao ligar a de e-mail, a mensagem vai para a fila local (`data/outbox.jsonl`) e **nada é enviado**.

**Formulário.** O "Formulário" da Monday virou **Lançamento de notas**, com as mesmas condições: Pagador aparece para os departamentos 0, 1, 2, 3, 6, 7 e 8; Endereço para 1, 2 e 8; Dados bancários para pagamento "Dados bancários"; Vencimento 01 para pagamentos 1 a 4; Vencimentos 02 a 12 só para "Parcelado". Campos obrigatórios iguais aos do formulário. Uma nota lançada entra em TAG - Pendentes e passa pela automação de criação.

**Views.** "Notas TAG" → aba TAG. "Otávio - Aprovação" → item Aprovações do menu. "Formulário" → Lançamento de notas. As views "Galeria de arquivos", "Tabela" e "Arquivos - Otávio Aprovação" não foram replicadas como telas próprias: são só filtros de visualização.

**Movimentações.** Mudar Aprovação Otávio ou Status na tabela ou na gaveta dispara as mesmas automações. Mover manualmente de grupo não dispara nenhuma, igual ao arrastar na Monday. Cada movimentação gera um evento no histórico, com a origem (manual ou automação).

**Arquivos.** 847 arquivos no quadro. 796 têm cópia local, reaproveitada da Central TAG (`aprovacao-tag/data/files`, sem duplicar os 125 MB). Os outros 51 abrem pelo link do Monday, que exige login.

## Limitações conhecidas

- **Dados locais.** Login de edição integrado ao Auth de Engenharia; antes de hospedar, ainda é preciso mover os dados locais para um backend compartilhado.
- **Não sincroniza com a Monday.** Alterações aqui não aparecem lá e vice-versa. Por isso a Monday continua sendo a fonte até o momento da troca.
- **Histórico da Monday não importado.** Só valem as movimentações a partir desta cópia.
- **Não migrados:** assinantes por item (destinatários de e-mail), quadro de subitens (18408411099, sem uso no período), o monday Doc de 1 item e o quadro Fornecedor como cadastro próprio (o nome e o CNPJ vêm da relação).
- **Nota sem número.** Um item tem nome "-" e sem NF. Está assim na Monday e foi copiado como está.

## Regras replicadas de propósito (decisões a revisar)

1. **Comprovantes.** Qualquer alteração na coluna, inclusive remover um arquivo, marca a nota como Pago e a move para TAG - Pagas. Foi mantido o comportamento do Monday. Vale decidir se remover comprovante deve reabrir o pagamento.
2. **Reprovação sem e-mail.** A automação de reprovação está desativada no Monday, então aqui a reprovação só move a nota quando ligada na tela de Automações.
3. **Divergência entre decisão e grupo.** No snapshot, 5 notas estão no grupo de pendentes com Aprovação Otávio = Reprovado. A tela avisa e não corrige sozinha, como a Monday.

## Dados e estado local

- `data/monday-export-2026-11-14.json`: export bruto (somente leitura).
- `data/snapshot.json`: gerado a partir do export por `npm run snapshot`.
- `data/state.json`, `data/events.jsonl`, `data/outbox.jsonl`, `data/uploads/`: tudo que a tela altera. Faça backup antes de apagar qualquer um.

Para descartar as alterações locais e voltar ao snapshot, apague `state.json`, `events.jsonl` e `outbox.jsonl` com a aplicação parada.

## Visual

Também em 14/11: opção **Quadro | Cartões** em Otávio, Quadro principal e Notas TAG, com a escolha lembrada no navegador. Busca, filtros, ordenação e grupos são os mesmos; seletores de aprovação/status e abertura da nota usam os handlers existentes. Sem mudança nas automações ou no armazenamento.

Atualização de 14/11/2026: ordem corrigida para `areas-novas.css` antes de `direcao.css`. O acabamento em `public/notas.css` segue fontes, tamanhos, bordas e cores de interface da Expansão; verde preservado na marca. Nenhum script, dado ou regra foi alterado nesta atualização. Verificações: 20 testes passaram e telas conferidas em desktop e celular.

A tela usa a mesma base visual da Expansão, carregada de `../ecossistema-visual/` (`direcao.css` e `areas-novas.css`), com a camada de cor verde em `verde-notas.css`. Menu lateral, marca, abas numeradas, KPIs em serif, busca, filtros, tabela e gaveta seguem as classes `cx-*` da base. O tema escuro é o padrão; o botão "Claro" alterna. Ver `../ecossistema-visual/README.md`.

## Estrutura

```
server.mjs              servidor HTTP local (sem dependências); serve /visual/ da base compartilhada
lib/catalog.mjs         grupos, rótulos, colunas e automações do quadro
lib/rules.mjs           motor de automações (funções puras)
lib/form.mjs            condições e validação do formulário
lib/snapshot.mjs        normaliza o export da Monday
lib/store.mjs           estado local, histórico e execução das automações
tools/build-snapshot.mjs
public/index.html       casca da página (fontes, base visual e camada verde)
public/notas.css        ajustes deste painel sobre a base (abas em linha, KPIs, gaveta, formulário)
public/app.js           tela: abas, tabela, gaveta, formulário, automações e histórico
tests/rules.test.mjs    testes
```

## Publicação no Netlify — padrão autorizado em 14/11/2026

Site existente atualizado: https://seu-site-tag-demo.netlify.app (id `00000000-0000-0000-0000-000000000001`). Deploy de produção: `000000000000000000000000`.

Por pedido do Gustavo, publicar as próximas alterações deste painel após validar. Executar `powershell -File tools/publicar-netlify.ps1`: roda testes, monta somente os arquivos permitidos da demonstração e publica no site já existente. Credencial vem do ambiente do Windows, sem ser gravada no projeto.

O endereço hospedado continua uma **demonstração com dados fictícios e alterações somente na memória do navegador**, descartadas ao recarregar. PDFs de prévia usam um modelo genérico identificado como demonstração. Login no site hospedado valida a mesma identidade no servidor via Netlify Function e libera a simulação de edição para as duas contas autorizadas. Nenhum dado/PDF real foi publicado. O backend local não foi migrado para armazenamento compartilhado.
