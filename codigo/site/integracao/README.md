# Interface de Expansão — pacote para integração

Versão local de 06/11/2026. O pacote contém a interface de Aprovações e Compras, com as regras demonstradas. **Não é uma integração de produção concluída:** persistência das novas áreas, autorização no servidor, envio de e-mails e encaminhamento fiscal ainda precisam ser conectados aos serviços reais. O original em `C:/Painéis/Expansão/painel` não foi alterado.

## Arquivos e montagem

- `expansao.css`: estilos base e nova camada visual; carregar depois do CSS do painel.
- `expansao.js`: renderização, anexos e referência das transições locais; não contém seletor de pessoa ou banco fictício.
- `estrutura.html`: pontos de montagem a inserir depois do cabeçalho.
- `manifesto.json`: hashes SHA-256 dos três arquivos para conferir a versão integrada.

Gerar novamente a partir das fontes: `node copia-painel/montar-integracao.mjs`.

A prévia completa continua em [copia-painel/index.html](../copia-painel/index.html). Ela é gerada com `node copia-painel/montar-copia.mjs`. O banco de teste e a inicialização da prévia estão separados em `demo-banco.js` e `demo-interface.js` e não devem ser levados ao painel real.

## Ligação com o hospedeiro

Antes de carregar `expansao.js`, fornecer `window.ExpansaoDados`. Depois do login e do carregamento dos dados, chamar:

```js
window.ExpansaoUI.entrar({ nome, email, perfil });
// Após atualizar o estado local com uma resposta confirmada do servidor:
window.ExpansaoUI.atualizar();
```

`perfil` usa os valores já demonstrados: `admin`, `equipe`, `engenharia` ou `compras`. O perfil real deve vir da autenticação/autorização do painel. Esconder uma aba não substitui autorização no servidor.

O módulo mantém os pontos de ligação do painel existente: `.topbar h1`, `#viewPainelTopo`, `#stickyTopo`, `#viewPainelTabela`, `#viewAnalytics` e demais regiões já usadas pela cópia. Ele adiciona `cx-experiencia` ao `body`. O tema acompanha `data-theme="claro"`/`"escuro"` no elemento raiz; em produção deve preservar a preferência atual. Usa as fontes já carregadas pelo painel, com fallback de sistema.

`ExpansaoDados` representa a projeção local usada na tela:

| Membro | Conteúdo esperado |
| --- | --- |
| `lancamentos` | Notas do painel; somente `status === 'Enviado'` entra em Aprovações |
| `fluxo` | Mapa por ID da nota: etapa, campos da análise, pedido e histórico |
| `requisicoes` | Requisições, cotações, SLA, anexos, avisos e histórico |
| `salvar()` | Na prévia, salva o estado local; não deve virar gravação indiscriminada de todo o estado no servidor |
| `aoMudar(fn)` | Inscreve a atualização da tela quando a projeção muda |
| `arquivos.ler/guardar/apagar` | Operações assíncronas de arquivos; `ler` retorna um Blob |
| `cliente.from(...)` | Hoje usado apenas na devolução da nota para Pendente |
| `PESSOAS` | Lista com `nome`, `email` e `perfil`; os engenheiros alimentam o campo "Nota de" (desde 09/11) |
| `criarReservas(pessoa)` | Opcional. Reserva de nota com o contrato de `reservas.js`; sem ele, a prévia usa reserva entre abas do navegador |

Esta interface de dados serve para encaixar a tela em homologação. As transições locais ainda precisam ser substituídas por comandos de servidor com resultado confirmado e tratamento de falha. Não basta apontar `salvar()` para o banco real.

## Pontos de integração funcional

1. `moverNota`, `devolverNota`, `moverReq` e `criarReq`: persistir transições de forma consistente, validar perfil e etapa, evitar duplicidade e só então redesenhar. Criação de RM e cotação deve ser atômica. Os IDs locais sequenciais são exclusivos da prévia.
2. `avisarHelena`: substituir o registro simulado pelo envio nos três eventos já definidos (abertura, aprovação e pedido de ajuste), com autoria e link para a RM; preservar a decisão sobre remetente e resposta.
3. `acoesDaNota` / `escriturar`: manter as validações reais do envio e só registrar encaminhamento após confirmação. Não marcar escrituração concluída apenas porque houve envio.
4. `guardarAnexos` e `removerArquivo`: conectar arquivos privados, permissões e histórico. NF e boleto do lançamento continuam somente leitura nesta área. Metadados de arquivo: `id`, `nome`, `por`, `em` e referência resolvida pelo adaptador.
5. Vínculo "Nota de / No cartão de" (`fluxo[id].vinculo`, desde 09/11): visível e editável só para engenheiros. Na tela fica fora do histórico geral, mas isso não protege o dado. No servidor, guardar em tabela própria, legível apenas por engenheiros. Ligação com o app de notas dos engenheiros ainda indefinida.
6. Reserva de nota (`reservas.js`): substituir por reserva no servidor, com expiração e controle de versão. O contrato é o mesmo dos testes em `requisitos.test.cjs`.
7. Antes de trocar a operação, resolver os itens já registrados sobre acesso aos lançamentos, presença e sincronização com Monday no registro de 05/11/2026 (documento interno, fora deste repositório).

## Comportamento visual

Paleta confirmada pelo Gustavo: azul, preto e branco, com variações neutras. Sem verde. Estados continuam identificados por rótulos explícitos; a urgência recebe destaque em preto/branco. A folha ativa é `copia-painel/direcao.css`; a primeira proposta em `experiencia.css` não é mais carregada.

Navegação lateral no desktop e inferior no celular. Aprovações usa percurso de etapas à esquerda e registros na fila de trabalho. Compras abre com cartões de requisição e oferece uma tabela detalhada; a busca é preservada ao alternar as duas apresentações. Tipografia editorial, linhas divisórias e agrupamento de responsáveis, prazos e documentos substituem a composição anterior de quatro caixas e uma tabela.

A entrada da prévia também foi remodelada, mas seu CSS específico e o seletor de pessoas ficam fora do pacote de integração. A autenticação real permanece sob responsabilidade do hospedeiro.

Em desktop, documento e formulário ficam lado a lado; em telas de até 600 px, documento em cima e formulário abaixo, com rolagens independentes. Abrir/fechar o arquivo não recria o formulário nem descarta o que foi digitado. A tabela larga de Compras mantém as colunas e usa rolagem horizontal em telas menores.

Animações curtas de abertura, passagem do cursor e foco, desativadas com `prefers-reduced-motion`. Os controles continuam acessíveis por teclado, incluindo a navegação entre formulário e documento.
