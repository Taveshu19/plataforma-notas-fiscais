# Base visual do ecossistema

Uma só base de aparência para os painéis que conversam entre si: Expansão, Engenharia e Notas Fiscais. Cada painel tem o próprio funcionamento; a forma, as fontes, o tamanho e a posição dos elementos vêm daqui.

## Arquivos

- `direcao.css`: base do painel de Expansão (tokens `--cx-*`, tema escuro por padrão e claro com `data-theme="claro"`, menu lateral, abas, cabeçalho editorial, tabela e formulário). Cópia de `codigo/site/copia-painel/direcao.css`.
- `areas-novas.css`: estilos de áreas e controles do mesmo painel (busca, filtros, quadro, rolagem). Cópia de `codigo/site/copia-painel/areas-novas.css`.
- `verde-notas.css`: camada de cor do Notas Fiscais. Só redefine variáveis e alguns seletores de cor; não muda forma nem tamanho. Verde `#0f9d5b` no escuro e `#0b7a46` no claro.
- `manifesto.json`: SHA-256 e tamanho dos dois arquivos copiados, para conferir se a base não mudou.

## Como um painel usa

Carregar nesta ordem, depois das fontes (Manrope, Inter, JetBrains Mono e Source Serif 4):

```html
<body class="cx-experiencia">
<link rel="stylesheet" href="direcao.css">
<link rel="stylesheet" href="areas-novas.css">
<link rel="stylesheet" href="cor-do-painel.css">  <!-- camada de cor: verde-notas.css, laranja-engenharia.css... -->
```

A camada de cor é o único ponto que muda entre os painéis. Engenharia usa laranja (`laranja-engenharia.css`, em `codigo/site/copia-engenharia`); Notas Fiscais usa verde.

## Regras

- Não editar `direcao.css` ou `areas-novas.css` aqui para uma tela específica. Mudança de forma vale para todos os painéis: alterar a base, atualizar o `manifesto.json` e revisar os painéis que a usam.
- Cor específica de um painel entra só na camada de cor dele.
- A paleta da Expansão, na remodelação de 06/11, dizia "sem verde". O Notas Fiscais usa verde por pedido expresso do usuário, na mesma estrutura visual; a Expansão e a Engenharia continuam com as cores delas.

## Origem

Cópias feitas em 14/11/2026 a partir de `codigo/site/copia-painel`. Os painéis originais não foram alterados.
