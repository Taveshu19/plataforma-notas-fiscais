# Banco engenharia-e-tag — tabelas (gerado em 2026-11-20)

Somente estrutura. Contagem de linhas aproximada no momento da geração.

| Tabela | Linhas | Colunas |
|---|---:|---|
| `aprovacoes_anexos` | 1 | id, nota_id, nome, caminho, tamanho, por_email, por_nome, em |
| `aprovacoes_notas` | 1278 | nota_id, etapa, narrativa, contrato, expansao, historico, versao, por_email, por_nome, criado_em, atualizado_em, pedido, contrato_ref, pagador, categoria, endereco_obra, decisao, aguarda_reenvio, campos, data_envio, arquivos_ocultos |
| `arquivos_processados` | 504 | id, hash, nome_arquivo, tipo, lancamento_id, criado_em, path_storage, campos_sugeridos |
| `assistente_conversas` | 0 | id, criado_em, usuario, pergunta, resposta, passos, propostas, custo_usd, modelo, erro, sessao |
| `assistente_desfazer` | 0 | id, proposta_id, tabela, operacao, chave, antes, depois, criado_em |
| `assistente_propostas` | 0 | id, criado_em, usuario, conversa_id, descricao, sql, previa, estado, executada_em, desfeita_em, erro, comandos |
| `atividades_quadro` | 1 | id, dados, importado_em |
| `contratos` | 58 | item_id, nome, grupo_id, grupo_nome, estado, aprovador, unidade, referencia, narrativa, tipologia, tipo, status, valor_fechado, aceite, cnpj, inclusao, aditivos, notas, subitens, arquivos, atualizado_monday, espelhado_em, arquivos_itens, origem, criado_por, criado_em, pago_historico |
| `datasul_fornecedores` | 40572 | cnpj, codigo, nome, atualizado_em |
| `escrituracao_pedidos` | 0 | id, nota_id, item_id, por_email, por_nome, em, resposta |
| `exclusoes_foto` | 341 | id, lancamento_id, excluido_em, excluido_por, foto, app_build |
| `exclusoes_recentes` | 389 | id, hash_arquivo, nome_arquivo, excluido_por, excluido_em, lancamento_id |
| `fila_email_escrituracao` | 3 | item_id, unidade, documento, clicado_por_id, clicado_por_email, entrou_em |
| `fiscais_unidade` | 21 | unidade, email_fiscal, emails_cc, ativo |
| `historico_status` | 598 | id, lancamento_id, status, usuario, criado_em, detalhes |
| `lancamentos` | 112 | id, nf, fornecedor, cnpj_fornecedor, unidade, unidade_confirmada, valor, emissao, vencimento, observacoes, requer_revisao, possivel_duplicata, status, arquivo_nf_nome, arquivo_nf_path, arquivo_boleto_nome, arquivo_boleto_path, arquivo_hash, criado_em, atualizado_em, comprovante_path, link_portal, link_tipo, link_codigo_verificacao, boleto_grupo_notas, banco, agencia, conta_corrente, nome_arquivo_s |
| `monday_arquivos` | 1978 | asset_id, caminho, nome, tamanho, copiado_em |
| `monday_bruto` | 1940 | item_id, board_id, board_nome, grupo_id, grupo_nome, nome, estado, colunas, arquivos, subitens, atualizacoes, criado_monday, atualizado_monday, espelhado_em |
| `monday_espelho` | 1287 | item_id, board_id, board_nome, grupo_id, grupo_nome, etapa, nome, documento, unidade, natureza, valor, narrativa, contrato, expansao, pedido, status, emissao, vencimento, data_aprovacao, data_envio, codigo_emitente, cnpj, lancamento_id, criado_monday, atualizado_monday, espelhado_em, bruto, arquivos, pagador, categoria, endereco, cod_fornecedor, criacao_pedido, aprovacao_pedido, pre_nota, envio_fi |
| `monday_espelho_estado` | 2 | board_id, ultimo_log, ultima_execucao, ultima_mensagem |
| `monday_espelho_eventos` | 20344 | id, item_id, quando, tipo, descricao, detalhe, registrado_em, chave |
| `painel_exclusoes` | 0 | tipo, chave, dados, por, em |
| `painel_perfis` | 10 | email, equipe, escolhido_em, origem |
| `senha_recuperacoes` | 19 | id, email, em, enviado |
| `sombra_envio` | 28 | lancamento_id, foto, foto_em, app_build |
| `tag_automacoes` | 5 | id, ativa |
| `tag_eventos` | 4213 | id, em, ator, tipo, item_id, doc |
| `tag_meta` | 1 | chave, valor |
| `tag_notas` | 649 | id, doc, leve, grupo_id, origem_id, criado_em, atualizado_em |
| `tag_outbox` | 1 | id, em, doc |

## Funções SQL (41)
`aprovacoes_anexo_registrar`, `aprovacoes_anexo_remover`, `aprovacoes_anexos_listar`, `aprovacoes_aprovar`, `aprovacoes_arquivo_remover`, `aprovacoes_completar_campos`, `aprovacoes_confirmar_pedido`, `aprovacoes_ctx`, `aprovacoes_devolver`, `aprovacoes_editar_campos`, `aprovacoes_etapa_base`, `aprovacoes_mover`, `aprovacoes_reabrir_escrituracao`, `aprovacoes_registrar_pedido`, `aprovacoes_registrar_retorno`, `aprovacoes_salvar`, `aprovacoes_sem_contrato`, `aprovacoes_vincular_contrato`, `assistente_desfazer_proposta`, `atividades_chave_confere`, `bloquear_recriar_excluido`, `compras_eu`, `contratos_criar`, `contratos_criar_aditivo`, `contratos_editar`, `contratos_excluir`, `contratos_pode_editar`, `contratos_registrar_arquivo`, `equipe_painel`, `fn_assistente_desfazer`, `fn_audit_lancamento`, `juntar_copia_monday`, `lancamento_arquivos_tamanhos`, `lancamento_juntar_copia_monday`, `painel_acesso_lancamento`, `painel_engenheiros`, `painel_equipe`, `remessa_direto_escrituracao`, `set_atualizado_em`, `tag_avisar_mudanca`, `tag_receber_nota`

## Gatilhos (15)
- `aprovacoes_completar` em `aprovacoes_notas`
- `trg_assistente_desfazer` em `arquivos_processados`
- `contratos_nao_recriar` em `contratos`
- `trg_assistente_desfazer` em `exclusoes_recentes`
- `trg_assistente_desfazer` em `historico_status`
- `lancamentos_juntar_copia_monday` em `lancamentos`
- `lancamentos_remessa_escrituracao` em `lancamentos`
- `trg_assistente_desfazer` em `lancamentos`
- `trg_atualizado_em` em `lancamentos`
- `trg_audit_lancamento` em `lancamentos`
- `tag_automacoes_avisa` em `tag_automacoes`
- `tag_eventos_avisa` em `tag_eventos`
- `tag_meta_avisa` em `tag_meta`
- `tag_notas_avisa` em `tag_notas`
- `tag_outbox_avisa` em `tag_outbox`

## Pastas de arquivos (Storage)
- `contratos` (privada: abre por link assinado)
- `documentos` (privada: abre por link assinado)
- `monday-arquivos` (privada: abre por link assinado)
- `tag-arquivos` (privada: abre por link assinado)

## Tabelas em tempo real (Realtime)
`aprovacoes_anexos`, `aprovacoes_notas`, `arquivos_processados`, `contratos`, `historico_status`, `lancamentos`, `monday_espelho`

## Tarefas agendadas (pg_cron)
- nenhuma

## Regras de acesso (RLS)
63 regras — texto completo em `esquema-engenharia-e-tag.sql`.
