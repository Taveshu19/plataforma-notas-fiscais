# Banco expansao — tabelas (gerado em 2026-11-20)

Somente estrutura. Contagem de linhas aproximada no momento da geração.

| Tabela | Linhas | Colunas |
|---|---:|---|
| `aprovacoes_anexos` | 5 | id, nota_id, nome, caminho, tamanho, por_email, por_nome, em |
| `aprovacoes_notas` | 4267 | nota_id, etapa, narrativa, contrato, expansao, historico, versao, por_email, por_nome, criado_em, atualizado_em, pedido, contrato_ref, decisao, aguarda_reenvio, campos, data_envio, arquivos_ocultos |
| `arquivos_processados` | 5756 | id, hash, nome_arquivo, tipo, lancamento_id, criado_em, path_storage, campos_sugeridos |
| `assistente_conversas` | 50 | id, criado_em, usuario, pergunta, resposta, passos, propostas, custo_usd, modelo, erro, sessao |
| `assistente_desfazer` | 24 | id, proposta_id, tabela, operacao, chave, antes, depois, criado_em |
| `assistente_propostas` | 5 | id, criado_em, usuario, conversa_id, descricao, sql, previa, estado, executada_em, desfeita_em, erro, comandos |
| `atividades_itens` | 137 | item_id, grupo_id, grupo_nome, ordem, nome, estado, valores, subitens, criado_monday, atualizado_monday, espelhado_em, origem, alterado_por, alterado_em |
| `atividades_quadro` | 1 | id, board_id, nome, colunas, grupos, sub_colunas, espelhado_em |
| `atividades_quadro_copia_20261114` | 1 | id, dados, importado_em |
| `compras_anexos` | 459 | id, requisicao_id, tipo, nome, caminho, por_email, por_nome, em |
| `compras_avisos` | 5 | id, requisicao_id, tipo, assunto, corpo, responder_para, para, criado_em, enviado_em, erro |
| `compras_config` | 1 | chave, valor |
| `compras_historico` | 7063 | id, requisicao_id, texto, por_email, por_nome, em, chave |
| `compras_requisicoes` | 154 | id, numero, nome, descricao, unidade, tipo, prioridade, sla_dias, prazo_desejado, etapa, comprador, terceiros, motivo_recusa, solicitante_email, solicitante_nome, criada_em, atualizada_em, fechada_em, data_entrega, origem, monday_req_id, monday_cot_id, monday_grupo, monday_dados |
| `contratos` | 146 | item_id, nome, grupo_id, grupo_nome, estado, aprovador, unidade, referencia, narrativa, tipologia, tipo, status, valor_fechado, aceite, cnpj, inclusao, aditivos, notas, subitens, arquivos, atualizado_monday, espelhado_em, arquivos_itens, origem, criado_por, criado_em |
| `controle_fornecedores` | 8 | nome, posicao, criado_em, criado_por |
| `controle_lancamentos` | 173 | id, pedido, fornecedor, emissao, vencimento, instalacao, nota, texto, etapa, posicao, origem, monday_id, criado_em, criado_por, atualizado_em, atualizado_por, movido_em |
| `controle_lancamentos_comentarios` | 2 | id, item_id, em, autor, autor_email, texto, origem, monday_id |
| `controle_lancamentos_eventos` | 1447 | id, item_id, pedido, em, ator, tipo, campo, antes, depois, origem, monday_id, instantaneo |
| `datasul_fornecedores` | 40572 | cnpj, codigo, nome, atualizado_em |
| `datasul_itens` | 32920 | codigo, descricao, situacao, conta_contabil, tipo_despesa, atualizado_em, un, familia, grupo_estoque |
| `engenharia_vinculos` | 0 | nota_id, nota_de, cartao_de, por_email, por_nome, em |
| `escrituracao_pedidos` | 2 | id, nota_id, item_id, por_email, por_nome, em, resposta |
| `exclusoes_foto` | 1797 | id, lancamento_id, excluido_em, excluido_por, foto, app_build |
| `exclusoes_recentes` | 3931 | id, hash_arquivo, nome_arquivo, excluido_por, excluido_em, lancamento_id |
| `fila_email_escrituracao` | 0 | item_id, unidade, documento, clicado_por_id, clicado_por_email, entrou_em |
| `fiscais_unidade` | 21 | unidade, email_fiscal, emails_cc, ativo |
| `furos` | 1542 | id, detectado_em, documento, remetente, assunto, recebido_em, etapa, situacao, estado, resolvido_por, resolvido_em |
| `historico_status` | 9744 | id, lancamento_id, status, usuario, criado_em, detalhes |
| `historico_sugestoes` | 4 | id, campo, chave, valor, criado_em, atualizado_em |
| `itens_escolhidos` | 0 | id, board_id, descricao_nota, descricao_normalizada, item_codigo, fornecedor_codigo, monday_item_id, escolhido_por, escolhido_em |
| `lancamentos` | 1526 | id, nf, fornecedor, cnpj_fornecedor, unidade, unidade_confirmada, valor, emissao, vencimento, observacoes, requer_revisao, possivel_duplicata, status, arquivo_nf_nome, arquivo_nf_path, arquivo_boleto_nome, arquivo_boleto_path, arquivo_hash, criado_em, atualizado_em, comprovante_path, link_portal, link_tipo, link_codigo_verificacao, boleto_grupo_notas, banco, agencia, conta_corrente, nome_arquivo_s |
| `monday_arquivos` | 7119 | asset_id, caminho, nome, tamanho, copiado_em |
| `monday_compras_espelho` | 298 | item_id, board_id, board_nome, grupo_id, grupo_nome, nome, estado, colunas, arquivos, subitens, atualizacoes, criado_monday, atualizado_monday, espelhado_em |
| `monday_espelho` | 4151 | item_id, board_id, board_nome, grupo_id, grupo_nome, etapa, nome, documento, unidade, natureza, valor, narrativa, contrato, expansao, pedido, status, emissao, vencimento, data_aprovacao, data_envio, codigo_emitente, cnpj, lancamento_id, criado_monday, atualizado_monday, espelhado_em, bruto, arquivos |
| `monday_espelho_estado` | 2 | board_id, ultimo_log, ultima_execucao, ultima_mensagem |
| `monday_espelho_eventos` | 71962 | id, item_id, quando, tipo, descricao, detalhe, registrado_em, chave |
| `notas_link` | 0 | id, tipo, numero_nota, codigo_verificacao, cnpj_fornecedor, fornecedor, valor, link, remetente, criado_em, tratado, lancamento_id |
| `painel_exclusoes` | 1 | tipo, chave, dados, por, em |
| `painel_perfis` | 10 | email, equipe, escolhido_em, origem |
| `pedidos_gerados` | 3 | id, lote_id, board_id, monday_item_id, documento, cnpj, unidade, natureza, valor, arquivo_nome, linhas_csv, ordem_lote, status, gerado_em, importado_em, numero_reservado, pedido_numero, erro, gerado_por, confirmado_por, evidencia, monday_sincronizado_em, entregue_em, entregue_por |
| `portfolio_projetos_local` | 0 | item_id, grupo_id, nome, valores, versao, por_email, atualizado_em |
| `projetos_acesso` | 2 | email |
| `projetos_itens` | 13 | item_id, grupo_id, grupo_nome, ordem, nome, estado, valores, subitens, criado_monday, atualizado_monday, espelhado_em, origem, alterado_por, alterado_em |
| `projetos_quadro` | 1 | id, board_id, nome, colunas, grupos, sub_colunas, espelhado_em |
| `pulso` | 12061 | id, criado_em, modo, arquivos_pasta, arquivos_ledger, lancamentos, sincronizados_monday, erro, pendentes, em_lancamento, enviados |
| `senha_recuperacoes` | 7 | id, email, em, enviado |
| `sombra_envio` | 420 | lancamento_id, foto, foto_em, app_build |

## Visões
- `portfolio_projetos_efetivos`

## Funções SQL (62)
`aprovacoes_anexo_registrar`, `aprovacoes_anexo_remover`, `aprovacoes_anexos_listar`, `aprovacoes_aprovar`, `aprovacoes_arquivo_remover`, `aprovacoes_completar_campos`, `aprovacoes_confirmar_pedido`, `aprovacoes_ctx`, `aprovacoes_devolver`, `aprovacoes_editar_campos`, `aprovacoes_etapa_base`, `aprovacoes_mover`, `aprovacoes_reabrir_escrituracao`, `aprovacoes_registrar_pedido`, `aprovacoes_registrar_retorno`, `aprovacoes_salvar`, `aprovacoes_sem_contrato`, `aprovacoes_vincular_contrato`, `assistente_desfazer_proposta`, `bloquear_recriar_excluido`, `compras_avisar`, `compras_avisar_abertura`, `compras_chave_confere`, `compras_criar`, `compras_disparar_aviso`, `compras_eu`, `compras_excluir`, `compras_mover`, `compras_pode_ver`, `compras_registrar_anexo`, `compras_remover_anexo`, `contratos_criar`, `contratos_criar_aditivo`, `contratos_editar`, `contratos_excluir`, `contratos_pode_criar`, `contratos_pode_editar`, `contratos_registrar_arquivo`, `controle_antes`, `controle_api`, `controle_autorizado`, `controle_comentario_registrar`, `controle_excluir_registrar`, `controle_pode`, `controle_quem`, `controle_registrar`, `datasul_reservar_lote`, `equipe_painel`, `fn_assistente_desfazer`, `fn_audit_lancamento`, `lancamento_arquivos_tamanhos`, `painel_acesso_lancamento`, `painel_engenheiros`, `painel_equipe`, `painel_portfolio_edita`, `painel_portfolio_pode`, `painel_projetos_pode`, `portfolio_dados`, `portfolio_projeto_salvar`, `portfolio_projetos_listar`, `quadro_salvar`, `set_atualizado_em`

## Gatilhos (14)
- `aprovacoes_completar` em `aprovacoes_notas`
- `trg_assistente_desfazer` em `arquivos_processados`
- `compras_avisos_disparo` em `compras_avisos`
- `compras_nao_recriar` em `compras_requisicoes`
- `contratos_nao_recriar` em `contratos`
- `controle_antes` em `controle_lancamentos`
- `controle_excluir_registrar` em `controle_lancamentos`
- `controle_registrar` em `controle_lancamentos`
- `controle_comentario_registrar` em `controle_lancamentos_comentarios`
- `trg_assistente_desfazer` em `exclusoes_recentes`
- `trg_assistente_desfazer` em `historico_status`
- `trg_assistente_desfazer` em `lancamentos`
- `trg_atualizado_em` em `lancamentos`
- `trg_audit_lancamento` em `lancamentos`

## Pastas de arquivos (Storage)
- `compras` (privada: abre por link assinado)
- `contratos` (privada: abre por link assinado)
- `documentos` (privada: abre por link assinado)
- `monday-arquivos` (privada: abre por link assinado)

## Tabelas em tempo real (Realtime)
`aprovacoes_anexos`, `aprovacoes_notas`, `arquivos_processados`, `compras_anexos`, `compras_avisos`, `compras_historico`, `compras_requisicoes`, `contratos`, `controle_fornecedores`, `controle_lancamentos`, `controle_lancamentos_comentarios`, `historico_status`, `historico_sugestoes`, `lancamentos`, `monday_espelho`

## Tarefas agendadas (pg_cron)
- nenhuma

## Regras de acesso (RLS)
104 regras — texto completo em `esquema-expansao.sql`.
