# 07 · Edge Functions

São 11 funções diferentes, em TypeScript (Deno), publicadas no Supabase: 10 no banco da Expansão e 8 no da Engenharia, 18 no total. O código está em [`codigo/funcoes/`](../codigo/funcoes/), como estava no ar. O `config.toml` de cada banco diz quais exigem login.

> **`verify_jwt = false` não quer dizer "sem segurança".** Quer dizer que quem confere o acesso é a própria função. Isso vale para três casos:
> - quem chama não é uma pessoa logada (o Power Automate, o gatilho do banco);
> - o login vem de **outro** projeto, como na TAG e no Controle de Lançamentos;
> - a função valida o token ela mesma, com `auth.getUser`.
>
> Publicar sem o `config.toml` liga a exigência padrão e quebra quem chama.

| Função | Bancos | Quem chama | Acesso | O que faz |
|---|---|---|---|---|
| `ler-documento` | ambos | Painel, ao ler um PDF | Login (`verify_jwt`) | Lê o PDF com o Gemini (OpenRouter), com JSON Schema, modelo de reserva e `data_collection: "deny"` |
| `assistente` | ambos | Painel (botão Claude) | Login | Agente com ferramentas: investiga o banco só lendo e **propõe** mudanças; ver [09](09-assistente-com-ia.md) |
| `baixar-nota-link` | ambos | Painel, nota que chegou como link | Login | Baixa o PDF no site da prefeitura (sem CORS no navegador); se o portal bloqueia a nuvem, passa pelo Worker da Cloudflare; só aceita `%PDF` |
| `baixar-link-direto` | Expansão | Painel | Login | Baixa no servidor o PDF de link direto e guarda no Storage (`documentos`); dali a nota segue o caminho normal |
| `escriturar-painel` | ambos | Botão "Enviar para escriturar" | Token validado na função | Monta a nota com as correções do painel, acha o código do emitente, junta os anexos e envia pelo Graph; regras em [05](05-escrituracao.md) |
| `retorno-escrituracao` | ambos | Fluxo do Power Automate | Chave no cabeçalho `x-chave-retorno` | Lê o e-mail do robô ("Seu pedido N, foi Aprovado/Rejeitado por …") e registra na nota, sem duplicar |
| `avisar-compras` | Expansão | Gatilho do banco (`pg_net`) | Chave do Vault no cabeçalho `x-chave-avisos` | E-mail de abertura, aprovação, ajuste e recusa de requisição, **sempre com os documentos** (anexo direto até ~3 MB; acima disso, envio em partes ou link) |
| `recuperar-senha` | ambos | "Esqueci minha senha" | Pública, com limites | Gera o link de recuperação e envia pela caixa da escrituração; resposta sempre igual, até 1 pedido a cada 2 minutos e 5 por dia por e-mail |
| `controle-api` | Expansão | Aba Controle de Lançamentos | Token da Expansão **ou** da TAG, validado na função | Confere o e-mail na lista `controle_autorizado` e lê ou grava pela função SQL `controle_api()`, em nome da pessoa |
| `tag-api` | Engenharia | Painel da TAG (`/tag/api/*`, `/tag/files/*`) | Token validado na função | API REST da TAG: notas, eventos, automações, fila de e-mail, arquivos e ZIP; só dois logins editam, e só depois de trocar a senha inicial |
| `arquivo-monday` | ambos | Painel, ao abrir um arquivo antigo | Consulta com o token de quem pediu (RLS) | Entrega arquivos do sistema antigo já copiados; só se o arquivo estiver numa nota ou contrato que a pessoa pode ver |

## Padrões que se repetem

- **Chave nunca no navegador.** IA, Graph, Worker e conexões dos papéis do assistente ficam em secrets.
- **O banco confere a permissão.** As funções que leem em nome de alguém usam o **token da pessoa**, para o RLS valer. A chave de serviço só é usada onde a regra já foi conferida.
- **Resposta que não revela nada.** Na `recuperar-senha`, um e-mail com conta e um sem conta recebem a mesma resposta.
- **Idempotência.** O retorno da escrituração e os avisos de Compras não duplicam se forem chamados duas vezes.
- **Falha que não trava o processo.** Se o e-mail da reprovação na TAG falhar, a falha fica registrada, mas a reprovação acontece.

## Segredos

Aqui estão só os **nomes**. Nenhum valor está neste repositório.

| Segredo | Usado por |
|---|---|
| `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER_MAILBOX` | Funções que mandam e-mail (app no Entra ID, caixa da escrituração) |
| `ESCRITURACAO_EMAIL_MODO`, `REVIEW_EMAIL` | `escriturar-painel`: envio real ou prévia |
| `ESCRITURAR_FLUXO_PROPRIO`, `ESCRITURAR_CAIXA_PA` | `escriturar-painel`: e-mail `[ESCRITURAR]` para a caixa de quem clicou |
| `RETORNO_CHAVE` | `retorno-escrituracao` |
| `OPENROUTER_API_KEY` | `ler-documento` |
| `ASSISTENTE_OPENROUTER_KEY`, `ASSISTENTE_MODEL`, `ASSISTENTE_DB_LEITURA_URL`, `ASSISTENTE_DB_ESCRITA_URL` | `assistente` (chave própria, com limite de gasto) |
| `CF_BAIXADOR_URL`, `CF_BAIXADOR_TOKEN` | `baixar-nota-link` (Worker da Cloudflare) |
| `ENG_PUBLIC_KEY` | `controle-api` (valida o login da TAG, que vem de outro projeto) |

## Publicar

```bash
supabase functions deploy <nome> --project-ref <ref>   # respeita o config.toml da pasta
supabase secrets set NOME=valor --project-ref <ref>
```
