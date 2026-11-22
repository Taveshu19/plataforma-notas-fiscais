# Código

O código de produção, com nomes fictícios. Veja [Sobre este repositório](../README.md#sobre-este-repositório).

| Pasta | O que é | Fonte ou gerado? |
|---|---|---|
| `paineis-originais/Expansão/painel/index.html` | Painel de lançamento da Expansão, com cerca de 16 mil linhas (vigia de pasta, leitura, fila, envio e assistente) | Fonte |
| `paineis-originais/Engenharia/painel/index.html` | O mesmo painel adaptado para a Engenharia | Fonte |
| `paineis-originais/Expansão/painel/cloudflare-baixador/` | Worker da Cloudflare que devolve o PDF de portais de prefeitura | Fonte |
| `site/copia-painel/` | Aprovações, Contratos, Compras e Projetos (`areas-novas.js`, `contratos-compras-expansao.js`), regras puras (`regras-expansao.js`), banco falso da demonstração (`demo-banco.js`), módulos de mudança (`*.mjs`), gerador da demonstração (`montar-copia.mjs`) e testes | Fonte |
| `site/copia-engenharia/` | Gerador da Engenharia (mesmo código, regras da área) e dados fictícios do quadro de Atividades | Fonte |
| `site/producao/homologacao/` | Gerador e **adaptador do banco real** da Expansão (`adaptador-producao.js`) | Fonte |
| `site/producao/engenharia/` | Gerador e adaptador da Engenharia, a partir da versão publicada em 16/11 (`base-publicada-2026-11-16.html`) | Fonte |
| `site/producao/controle/` | Tela do Controle de Lançamentos | Fonte |
| `site/integracao/` | Camada de interface: navegação lateral, fila de decisões, temas e ícone | Fonte |
| `site/publicados/montar-oficial.mjs` | Junta menu e painéis no site oficial e publica no Netlify (`--publicar`) | Fonte |
| `tag/notas-fiscais/` | Painel da TAG: tela (`public/`), regras e automações (`lib/`), servidor local (`server.mjs`), demonstração (`demo-src/`, `tools/build-demo.mjs`) e testes | Fonte |
| `funcoes/<banco>/supabase/` | As Edge Functions como estavam no ar, com o `config.toml` (`verify_jwt` de cada uma) | Fonte |
| `banco/` | Estrutura dos dois bancos: tabelas, políticas RLS, funções SQL e gatilhos. Sem dados | Fonte |
| `menu/index.html` | Portal de equipes | Fonte |
| `montar-demo.mjs` | Monta a demonstração pública em `../demo/` | Fonte |

Os arquivos `index.html` dentro de `site/copia-*`, `site/producao/*` e `site/publicados/site/` são **gerados** e ficam fora do Git.

## Montar

```bash
node codigo/montar-demo.mjs                       # demonstração (dados fictícios) em demo/
node codigo/site/publicados/montar-oficial.mjs    # site de produção em codigo/site/publicados/site (com endereços de exemplo)
```

Para apontar a produção para um banco de verdade, troque `seu-projeto-expansao` e `seu-projeto-engenharia` e as chaves públicas (`sb_publishable_SUA_CHAVE_PUBLICA`) pelos do seu projeto Supabase. Depois, crie a estrutura com `banco/esquema-*.sql` e publique as funções com os segredos listados em [docs/07](../docs/07-funcoes.md#segredos).

## Testar

```bash
cd codigo/site && node --test copia-painel/requisitos.test.cjs
cd codigo/tag/notas-fiscais && npm test
```

## Comentários no código

Os comentários foram mantidos como estavam. Eles registram, no ponto exato, **por que** cada decisão foi tomada, com a data e o caso real que motivou a mudança (com nomes trocados). Muitos citam o Monday.com, o sistema anterior ao fluxo próprio.
