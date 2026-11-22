-- Planta do banco engenharia-e-tag — gerada em 2026-11-20 (somente estrutura, sem dados).
-- Esquema public: tabelas, chaves, índices, visões, funções, gatilhos e regras de acesso (RLS).

create table public.aprovacoes_anexos (
  id uuid not null default gen_random_uuid(),
  nota_id text not null,
  nome text not null,
  caminho text not null,
  tamanho bigint,
  por_email text,
  por_nome text,
  em timestamp with time zone not null default now()
);
alter table public.aprovacoes_anexos add constraint aprovacoes_anexos_pkey PRIMARY KEY (id);
CREATE INDEX aprovacoes_anexos_nota ON public.aprovacoes_anexos USING btree (nota_id);
alter table public.aprovacoes_anexos enable row level security;

create table public.aprovacoes_notas (
  nota_id text not null,
  etapa text not null default 'engenharia'::text,
  narrativa text,
  contrato text,
  expansao text,
  historico jsonb not null default '[]'::jsonb,
  versao integer not null default 1,
  por_email text,
  por_nome text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now(),
  pedido text,
  contrato_ref text,
  pagador text,
  categoria text,
  endereco_obra text,
  decisao text,
  aguarda_reenvio boolean not null default false,
  campos jsonb not null default '{}'::jsonb,
  data_envio date,
  arquivos_ocultos jsonb not null default '[]'::jsonb
);
alter table public.aprovacoes_notas add constraint aprovacoes_notas_contrato_check CHECK (((contrato IS NULL) OR (contrato = ANY (ARRAY['Sim'::text, 'Não'::text]))));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_etapa_check CHECK ((etapa = ANY (ARRAY['engenharia'::text, 'contrato'::text, 'pedido'::text, 'aprovacao'::text, 'escrituracao'::text, 'fora'::text, 'devolvida'::text, 'encaminhada'::text, 'fiscal'::text, 'cancelada'::text, 'arquivada'::text])));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_expansao_check CHECK (((expansao IS NULL) OR (expansao = ANY (ARRAY['Sim'::text, 'Não'::text]))));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_pkey PRIMARY KEY (nota_id);
alter table public.aprovacoes_notas enable row level security;

create table public.arquivos_processados (
  id bigint not null default nextval('arquivos_processados_id_seq'::regclass),
  hash text not null,
  nome_arquivo text,
  tipo text,
  lancamento_id text,
  criado_em timestamp with time zone default now(),
  path_storage text,
  campos_sugeridos jsonb
);
alter table public.arquivos_processados add constraint arquivos_processados_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES lancamentos(id) ON DELETE SET NULL;
alter table public.arquivos_processados add constraint arquivos_processados_pkey PRIMARY KEY (id);
alter table public.arquivos_processados add constraint arquivos_processados_hash_key UNIQUE (hash);
alter table public.arquivos_processados enable row level security;

create table public.assistente_conversas (
  id bigint not null,
  criado_em timestamp with time zone not null default now(),
  usuario text not null,
  pergunta text not null,
  resposta text,
  passos jsonb,
  propostas ARRAY,
  custo_usd numeric,
  modelo text,
  erro text,
  sessao uuid
);
alter table public.assistente_conversas add constraint assistente_conversas_pkey PRIMARY KEY (id);
CREATE INDEX assistente_conversas_usuario_sessao_idx ON public.assistente_conversas USING btree (usuario, criado_em DESC);
alter table public.assistente_conversas enable row level security;

create table public.assistente_desfazer (
  id bigint not null,
  proposta_id bigint not null,
  tabela text not null,
  operacao text not null,
  chave jsonb not null,
  antes jsonb,
  depois jsonb,
  criado_em timestamp with time zone not null default now()
);
alter table public.assistente_desfazer add constraint assistente_desfazer_pkey PRIMARY KEY (id);
CREATE INDEX assistente_desfazer_proposta_idx ON public.assistente_desfazer USING btree (proposta_id);
alter table public.assistente_desfazer enable row level security;

create table public.assistente_propostas (
  id bigint not null,
  criado_em timestamp with time zone not null default now(),
  usuario text not null,
  conversa_id bigint,
  descricao text not null,
  sql text not null,
  previa jsonb,
  estado text not null default 'pendente'::text,
  executada_em timestamp with time zone,
  desfeita_em timestamp with time zone,
  erro text,
  comandos ARRAY
);
alter table public.assistente_propostas add constraint assistente_propostas_estado_check CHECK ((estado = ANY (ARRAY['pendente'::text, 'executada'::text, 'cancelada'::text, 'desfeita'::text, 'expirada'::text, 'falhou'::text])));
alter table public.assistente_propostas add constraint assistente_propostas_pkey PRIMARY KEY (id);
alter table public.assistente_propostas enable row level security;

create table public.atividades_quadro (
  id integer not null,
  dados jsonb not null,
  importado_em timestamp with time zone not null default now()
);
alter table public.atividades_quadro add constraint atividades_quadro_id_check CHECK ((id = 1));
alter table public.atividades_quadro add constraint atividades_quadro_pkey PRIMARY KEY (id);
alter table public.atividades_quadro enable row level security;

create table public.contratos (
  item_id text not null,
  nome text,
  grupo_id text,
  grupo_nome text,
  estado text,
  aprovador text,
  unidade text,
  referencia text,
  narrativa text,
  tipologia text,
  tipo text,
  status text,
  valor_fechado numeric,
  aceite date,
  cnpj text,
  inclusao date,
  aditivos ARRAY not null default '{}'::text[],
  notas ARRAY not null default '{}'::text[],
  subitens jsonb not null default '[]'::jsonb,
  arquivos integer not null default 0,
  atualizado_monday timestamp with time zone,
  espelhado_em timestamp with time zone not null default now(),
  arquivos_itens jsonb not null default '[]'::jsonb,
  origem text not null default 'monday'::text,
  criado_por text,
  criado_em timestamp with time zone,
  pago_historico numeric
);
alter table public.contratos add constraint contratos_pkey PRIMARY KEY (item_id);
CREATE INDEX contratos_arquivos_itens_gin ON public.contratos USING gin (arquivos_itens jsonb_path_ops);
CREATE INDEX contratos_subitens_gin ON public.contratos USING gin (subitens jsonb_path_ops);
alter table public.contratos enable row level security;

create table public.datasul_fornecedores (
  cnpj text not null,
  codigo text not null,
  nome text,
  atualizado_em timestamp with time zone
);
alter table public.datasul_fornecedores add constraint datasul_fornecedores_pkey PRIMARY KEY (cnpj, codigo);
CREATE INDEX datasul_fornecedores_codigo ON public.datasul_fornecedores USING btree (codigo);
alter table public.datasul_fornecedores enable row level security;

create table public.escrituracao_pedidos (
  id bigint not null default nextval('escrituracao_pedidos_id_seq'::regclass),
  nota_id text not null,
  item_id text not null,
  por_email text not null,
  por_nome text,
  em timestamp with time zone not null default now(),
  resposta text
);
alter table public.escrituracao_pedidos add constraint escrituracao_pedidos_pkey PRIMARY KEY (id);
CREATE INDEX escrituracao_pedidos_item ON public.escrituracao_pedidos USING btree (item_id, em DESC);
alter table public.escrituracao_pedidos enable row level security;

create table public.exclusoes_foto (
  id bigint not null,
  lancamento_id text not null,
  excluido_em timestamp with time zone not null default now(),
  excluido_por text,
  foto jsonb not null,
  app_build text
);
alter table public.exclusoes_foto add constraint exclusoes_foto_pkey PRIMARY KEY (id);
CREATE INDEX exclusoes_foto_excluido_em_idx ON public.exclusoes_foto USING btree (excluido_em);
alter table public.exclusoes_foto enable row level security;

create table public.exclusoes_recentes (
  id uuid not null default gen_random_uuid(),
  hash_arquivo text not null,
  nome_arquivo text,
  excluido_por text,
  excluido_em timestamp with time zone not null default now(),
  lancamento_id text
);
alter table public.exclusoes_recentes add constraint exclusoes_recentes_pkey PRIMARY KEY (id);
CREATE INDEX idx_exclusoes_recentes_data ON public.exclusoes_recentes USING btree (excluido_em);
CREATE INDEX idx_exclusoes_recentes_hash ON public.exclusoes_recentes USING btree (hash_arquivo);
alter table public.exclusoes_recentes enable row level security;

create table public.fila_email_escrituracao (
  item_id text not null,
  unidade text not null,
  documento text,
  clicado_por_id text,
  clicado_por_email text,
  entrou_em timestamp with time zone not null default now()
);
alter table public.fila_email_escrituracao add constraint fila_email_escrituracao_pkey PRIMARY KEY (item_id);
alter table public.fila_email_escrituracao enable row level security;
comment on table public.fila_email_escrituracao is 'Notas (Pinhal e Planilha Azul) clicadas em Enviar, esperando o Enviar lote (um e-mail por destino). Coluna unidade = destino (PINHAL, EMPRESA EXEMPLO, PARCEIRA, LAGO). So a funcao notificar-escrituracao usa. 11/11/2026.';

create table public.fiscais_unidade (
  unidade text not null,
  email_fiscal text,
  emails_cc ARRAY,
  ativo boolean
);
alter table public.fiscais_unidade add constraint fiscais_unidade_pkey PRIMARY KEY (unidade);
alter table public.fiscais_unidade enable row level security;

create table public.historico_status (
  id bigint not null default nextval('historico_status_id_seq'::regclass),
  lancamento_id text,
  status text not null,
  usuario text not null,
  criado_em timestamp with time zone default now(),
  detalhes jsonb
);
alter table public.historico_status add constraint historico_status_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES lancamentos(id) ON DELETE CASCADE;
alter table public.historico_status add constraint historico_status_pkey PRIMARY KEY (id);
alter table public.historico_status enable row level security;

create table public.lancamentos (
  id text not null,
  nf text,
  fornecedor text,
  cnpj_fornecedor text,
  unidade text,
  unidade_confirmada boolean default true,
  valor numeric,
  emissao date,
  vencimento date,
  observacoes text,
  requer_revisao boolean default false,
  possivel_duplicata boolean default false,
  status text not null default 'Pendente'::text,
  arquivo_nf_nome text,
  arquivo_nf_path text,
  arquivo_boleto_nome text,
  arquivo_boleto_path text,
  arquivo_hash text,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now(),
  comprovante_path text,
  link_portal text,
  link_tipo text,
  link_codigo_verificacao text,
  boleto_grupo_notas jsonb,
  banco text,
  agencia text,
  conta_corrente text,
  nome_arquivo_saida text,
  monday_item_id text,
  monday_arquivo_enviado boolean default false,
  natureza text,
  contrato boolean default false,
  data_recebimento date,
  data_aprovacao date,
  data_envio date,
  email text,
  data_pagamento date,
  pagamento text,
  pedido text,
  travado_por text,
  travado_em timestamp with time zone,
  enviado_por text,
  enviado_por_email text,
  monday_nf_enviado boolean default false,
  monday_boleto_enviado boolean default false,
  monday_item_criando_em timestamp with time zone,
  doc_subtipo text,
  chave_pix text,
  extracao_original jsonb,
  monday_boletos_enviados jsonb default '[]'::jsonb,
  monday_boleto_reservado_em timestamp with time zone,
  boleto_reutilizavel boolean default false,
  boletos_reusados jsonb default '[]'::jsonb,
  pagador text,
  endereco text,
  categoria text,
  codigo_fornecedor text,
  vencimento_02 date,
  vencimento_03 date,
  vencimento_04 date,
  vencimento_05 date
);
alter table public.lancamentos add constraint lancamentos_pkey PRIMARY KEY (id);
alter table public.lancamentos add constraint lancamentos_arquivo_hash_key UNIQUE (arquivo_hash);
alter table public.lancamentos enable row level security;

create table public.monday_arquivos (
  asset_id text not null,
  caminho text not null,
  nome text,
  tamanho bigint,
  copiado_em timestamp with time zone not null default now()
);
alter table public.monday_arquivos add constraint monday_arquivos_pkey PRIMARY KEY (asset_id);
alter table public.monday_arquivos enable row level security;

create table public.monday_bruto (
  item_id text not null,
  board_id text not null,
  board_nome text,
  grupo_id text,
  grupo_nome text,
  nome text,
  estado text,
  colunas jsonb,
  arquivos jsonb,
  subitens jsonb,
  atualizacoes jsonb,
  criado_monday timestamp with time zone,
  atualizado_monday timestamp with time zone,
  espelhado_em timestamp with time zone not null default now()
);
alter table public.monday_bruto add constraint monday_bruto_pkey PRIMARY KEY (item_id);
CREATE INDEX monday_bruto_board ON public.monday_bruto USING btree (board_id, grupo_id);
alter table public.monday_bruto enable row level security;

create table public.monday_espelho (
  item_id text not null,
  board_id text not null,
  board_nome text,
  grupo_id text,
  grupo_nome text,
  etapa text not null,
  nome text,
  documento text,
  unidade text,
  natureza text,
  valor numeric,
  narrativa text,
  contrato text,
  expansao text,
  pedido text,
  status text,
  emissao date,
  vencimento date,
  data_aprovacao date,
  data_envio date,
  codigo_emitente text,
  cnpj text,
  lancamento_id text,
  criado_monday timestamp with time zone,
  atualizado_monday timestamp with time zone,
  espelhado_em timestamp with time zone not null default now(),
  bruto jsonb,
  arquivos jsonb not null default '[]'::jsonb,
  pagador text,
  categoria text,
  endereco text,
  cod_fornecedor text,
  criacao_pedido text,
  aprovacao_pedido text,
  pre_nota text,
  envio_fiscal text,
  motivo_reprovacao text
);
alter table public.monday_espelho add constraint monday_espelho_pkey PRIMARY KEY (item_id);
CREATE INDEX monday_espelho_arquivos_gin ON public.monday_espelho USING gin (arquivos jsonb_path_ops);
CREATE INDEX monday_espelho_etapa ON public.monday_espelho USING btree (etapa);
CREATE INDEX monday_espelho_lancamento ON public.monday_espelho USING btree (lancamento_id);
alter table public.monday_espelho enable row level security;

create table public.monday_espelho_estado (
  board_id text not null,
  ultimo_log timestamp with time zone,
  ultima_execucao timestamp with time zone,
  ultima_mensagem text
);
alter table public.monday_espelho_estado add constraint monday_espelho_estado_pkey PRIMARY KEY (board_id);
alter table public.monday_espelho_estado enable row level security;

create table public.monday_espelho_eventos (
  id bigint not null default nextval('monday_espelho_eventos_id_seq'::regclass),
  item_id text not null,
  quando timestamp with time zone not null,
  tipo text not null,
  descricao text,
  detalhe jsonb,
  registrado_em timestamp with time zone not null default now(),
  chave text
);
alter table public.monday_espelho_eventos add constraint monday_espelho_eventos_pkey PRIMARY KEY (id);
alter table public.monday_espelho_eventos add constraint monday_espelho_eventos_chave_unica UNIQUE (chave);
CREATE INDEX monday_espelho_eventos_painel ON public.monday_espelho_eventos USING btree (id) INCLUDE (item_id, quando, descricao) WHERE (tipo = ANY (ARRAY['create_pulse'::text, 'move_pulse_from_group'::text, 'move_pulse_from_board'::text, 'delete_pulse'::text, 'archive_pulse'::text]));
CREATE INDEX monday_espelho_eventos_item ON public.monday_espelho_eventos USING btree (item_id, quando DESC);
alter table public.monday_espelho_eventos enable row level security;

create table public.painel_exclusoes (
  tipo text not null,
  chave text not null,
  dados jsonb not null,
  por text,
  em timestamp with time zone not null default now()
);
alter table public.painel_exclusoes add constraint painel_exclusoes_pkey PRIMARY KEY (tipo, chave);
alter table public.painel_exclusoes enable row level security;

create table public.painel_perfis (
  email text not null,
  equipe text not null,
  escolhido_em timestamp with time zone not null default now(),
  origem text not null default 'escolha no primeiro acesso'::text
);
alter table public.painel_perfis add constraint painel_perfis_email_check CHECK ((email = lower(email)));
alter table public.painel_perfis add constraint painel_perfis_equipe_check CHECK ((equipe = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text, 'compras'::text, 'tag'::text])));
alter table public.painel_perfis add constraint painel_perfis_pkey PRIMARY KEY (email);
alter table public.painel_perfis enable row level security;

create table public.senha_recuperacoes (
  id bigint not null,
  email text not null,
  em timestamp with time zone not null default now(),
  enviado boolean not null default false
);
alter table public.senha_recuperacoes add constraint senha_recuperacoes_pkey PRIMARY KEY (id);
alter table public.senha_recuperacoes enable row level security;
comment on table public.senha_recuperacoes is 'Pedidos de \"Esqueci minha senha\" do painel (16/11/2026). Gravado só pela função recuperar-senha.';

create table public.sombra_envio (
  lancamento_id text not null,
  foto jsonb not null,
  foto_em timestamp with time zone not null default now(),
  app_build text
);
alter table public.sombra_envio add constraint sombra_envio_pkey PRIMARY KEY (lancamento_id);
alter table public.sombra_envio enable row level security;

create table public.tag_automacoes (
  id text not null,
  ativa boolean not null
);
alter table public.tag_automacoes add constraint tag_automacoes_pkey PRIMARY KEY (id);
alter table public.tag_automacoes enable row level security;

create table public.tag_eventos (
  id uuid not null default gen_random_uuid(),
  em timestamp with time zone not null default now(),
  ator text,
  tipo text not null,
  item_id text,
  doc jsonb not null default '{}'::jsonb
);
alter table public.tag_eventos add constraint tag_eventos_pkey PRIMARY KEY (id);
CREATE INDEX tag_eventos_item ON public.tag_eventos USING btree (item_id, em DESC);
CREATE INDEX tag_eventos_em ON public.tag_eventos USING btree (em DESC);
alter table public.tag_eventos enable row level security;

create table public.tag_meta (
  chave text not null,
  valor jsonb not null
);
alter table public.tag_meta add constraint tag_meta_pkey PRIMARY KEY (chave);
alter table public.tag_meta enable row level security;

create table public.tag_notas (
  id text not null,
  doc jsonb not null,
  leve jsonb not null,
  grupo_id text,
  origem_id text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);
alter table public.tag_notas add constraint tag_notas_pkey PRIMARY KEY (id);
CREATE INDEX tag_notas_grupo ON public.tag_notas USING btree (grupo_id);
CREATE UNIQUE INDEX tag_notas_origem ON public.tag_notas USING btree (origem_id) WHERE (origem_id IS NOT NULL);
alter table public.tag_notas enable row level security;

create table public.tag_outbox (
  id uuid not null default gen_random_uuid(),
  em timestamp with time zone not null default now(),
  doc jsonb not null
);
alter table public.tag_outbox add constraint tag_outbox_pkey PRIMARY KEY (id);
alter table public.tag_outbox enable row level security;

-- ===== Regras de acesso (RLS)
create policy "anexos_ler" on public.aprovacoes_anexos for SELECT to authenticated
  using (true);
create policy "aprov_ler" on public.aprovacoes_notas for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text])));
create policy "assistente_insert" on public.arquivos_processados for INSERT to assistente_escrita
  with check (true);
create policy "assistente_select" on public.arquivos_processados for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_update" on public.arquivos_processados for UPDATE to assistente_escrita
  using (true)
  with check (true);
create policy "authenticated_delete" on public.arquivos_processados for DELETE to authenticated
  using (true);
create policy "authenticated_insert" on public.arquivos_processados for INSERT to authenticated
  with check (true);
create policy "authenticated_select" on public.arquivos_processados for SELECT to authenticated
  using (true);
create policy "authenticated_update" on public.arquivos_processados for UPDATE to authenticated
  using (true)
  with check (true);
create policy "equipe_painel_restrita" on public.arquivos_processados for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_select" on public.assistente_conversas for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_select" on public.assistente_conversas for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.assistente_conversas for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_select" on public.assistente_desfazer for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "equipe_painel_restrita" on public.assistente_desfazer for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_select" on public.assistente_propostas for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_select" on public.assistente_propostas for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.assistente_propostas for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "atividades_ler" on public.atividades_quadro for SELECT to authenticated
  using (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ALL (ARRAY[''::text, 'teste@painel.local'::text]))));
create policy "contratos_ler" on public.contratos for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text])));
create policy "escrituracao_pedidos_ler" on public.escrituracao_pedidos for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text])));
create policy "assistente_select" on public.exclusoes_foto for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_insert" on public.exclusoes_foto for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.exclusoes_foto for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.exclusoes_foto for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_delete" on public.exclusoes_recentes for DELETE to assistente_escrita
  using (true);
create policy "assistente_select" on public.exclusoes_recentes for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "equipe_painel_restrita" on public.exclusoes_recentes for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "permitir tudo via anon" on public.exclusoes_recentes for ALL to authenticated
  using (true)
  with check (true);
create policy "assistente_insert" on public.historico_status for INSERT to assistente_escrita
  with check (true);
create policy "assistente_select" on public.historico_status for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_delete" on public.historico_status for DELETE to authenticated
  using (true);
create policy "authenticated_insert" on public.historico_status for INSERT to authenticated
  with check (true);
create policy "authenticated_select" on public.historico_status for SELECT to authenticated
  using (true);
create policy "equipe_painel_restrita" on public.historico_status for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_insert" on public.lancamentos for INSERT to assistente_escrita
  with check (true);
create policy "assistente_select" on public.lancamentos for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_update" on public.lancamentos for UPDATE to assistente_escrita
  using (true)
  with check (true);
create policy "authenticated_delete" on public.lancamentos for DELETE to authenticated
  using (true);
create policy "authenticated_insert" on public.lancamentos for INSERT to authenticated
  with check (true);
create policy "authenticated_select" on public.lancamentos for SELECT to authenticated
  using (true);
create policy "authenticated_update" on public.lancamentos for UPDATE to authenticated
  using (true)
  with check (true);
create policy "equipe_painel_alterar" on public.lancamentos for UPDATE to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "equipe_painel_apagar" on public.lancamentos for DELETE to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "equipe_painel_incluir" on public.lancamentos for INSERT to authenticated
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "equipe_painel_ler" on public.lancamentos for SELECT to authenticated
  using ((( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento) OR ((( SELECT painel_equipe() AS painel_equipe) = 'expansao'::text) AND (status = 'Enviado'::text))));
create policy "espelho_ler" on public.monday_espelho for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text])));
create policy "espelho_estado_ler" on public.monday_espelho_estado for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text])));
create policy "espelho_eventos_ler" on public.monday_espelho_eventos for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text])));
create policy "contratos_arquivos_apagar" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'contratos'::text) AND contratos_pode_editar()));
create policy "contratos_arquivos_ler" on storage.objects for SELECT to authenticated
  using (((bucket_id = 'contratos'::text) AND (COALESCE(painel_equipe(), ''::text) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text]))));
create policy "contratos_arquivos_subir" on storage.objects for INSERT to authenticated
  with check (((bucket_id = 'contratos'::text) AND contratos_pode_editar()));
create policy "equipe le documentos" on storage.objects for SELECT to authenticated
  using ((bucket_id = 'documentos'::text));
create policy "equipe remove anexos painel" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'documentos'::text) AND (name ~~ 'anexos/%'::text)));
create policy "equipe sobe documentos" on storage.objects for INSERT to authenticated
  with check ((bucket_id = 'documentos'::text));
create policy "equipe_painel_ler_documentos" on storage.objects for SELECT to authenticated
  using (((bucket_id <> 'documentos'::text) OR ( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento) OR ((( SELECT painel_equipe() AS painel_equipe) = 'expansao'::text) AND (EXISTS ( SELECT 1
   FROM lancamentos l
  WHERE ((l.status = 'Enviado'::text) AND (((objects.name = l.arquivo_nf_path) OR (objects.name = l.arquivo_boleto_path)) OR (objects.name = l.comprovante_path))))))));
create policy "equipe_painel_subir_documentos" on storage.objects for INSERT to authenticated
  with check (((bucket_id <> 'documentos'::text) OR ( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento)));
create policy "perfil_escolher" on public.painel_perfis for INSERT to authenticated
  with check (((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (equipe = ANY (ARRAY['administrativo'::text, 'expansao'::text]))));
create policy "perfil_ler" on public.painel_perfis for SELECT to authenticated
  using (((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (( SELECT painel_equipe() AS painel_equipe) = 'admin'::text)));
create policy "assistente_select" on public.sombra_envio for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_insert" on public.sombra_envio for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.sombra_envio for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.sombra_envio for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));

-- ===== Funções (41)
CREATE OR REPLACE FUNCTION public.aprovacoes_anexo_registrar(p_nota text, p_nome text, p_caminho text, p_tamanho bigint)
 RETURNS aprovacoes_anexos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; a public.aprovacoes_anexos; etapa_atual text; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Incluir arquivo é da equipe administrativa.'; end if;
  select etapa into etapa_atual from public.aprovacoes_notas where nota_id = p_nota;
  etapa_atual := coalesce(etapa_atual, (select e.etapa from public.monday_espelho e where (e.lancamento_id = p_nota or 'M' || e.item_id = p_nota) and e.etapa <> 'excluida' limit 1));
  if etapa_atual not in ('pedido', 'aprovacao', 'escrituracao') then raise exception 'Anexos só podem ser incluídos ou removidos em A lançar, Aprovação do pedido ou Escrituração.'; end if;
  insert into public.aprovacoes_anexos (nota_id, nome, caminho, tamanho, por_email, por_nome)
       values (p_nota, p_nome, p_caminho, p_tamanho, eu.email, eu.nome) returning * into a;
  linha := 'Arquivo incluído: ' || p_nome || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome) values (p_nota, etapa_atual, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set historico = public.aprovacoes_notas.historico || jsonb_build_array(linha), versao = public.aprovacoes_notas.versao + 1, atualizado_em = now();
  return a;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_anexo_remover(p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; a public.aprovacoes_anexos; etapa_atual text; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Remover arquivo é da equipe administrativa.'; end if;
  select * into a from public.aprovacoes_anexos where id = p_id;
  if a.id is null then raise exception 'Arquivo não encontrado.'; end if;
  select etapa into etapa_atual from public.aprovacoes_notas where nota_id = a.nota_id;
  etapa_atual := coalesce(etapa_atual, (select e.etapa from public.monday_espelho e where (e.lancamento_id = a.nota_id or 'M' || e.item_id = a.nota_id) and e.etapa <> 'excluida' limit 1));
  if etapa_atual not in ('pedido', 'aprovacao', 'escrituracao') then raise exception 'Anexos só podem ser incluídos ou removidos em A lançar, Aprovação do pedido ou Escrituração.'; end if;
  delete from public.aprovacoes_anexos where id = p_id;
  linha := 'Arquivo removido: ' || a.nome || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome) values (a.nota_id, etapa_atual, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set historico = public.aprovacoes_notas.historico || jsonb_build_array(linha), versao = public.aprovacoes_notas.versao + 1, atualizado_em = now();
  return a.caminho;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_anexos_listar(p_nota text)
 RETURNS SETOF aprovacoes_anexos
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.aprovacoes_anexos where nota_id = p_nota order by em
$function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_aprovar(p_nota text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; novo text; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','administrativo','admin') then raise exception 'Só a engenharia aprova a análise.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'engenharia' then raise exception 'Esta nota já avançou e não está mais na engenharia.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota;
  if r.nota_id is null or r.narrativa is null or r.contrato is null or r.expansao is null then raise exception 'Preencha Narrativa, Contrato e Pertence à engenharia antes de aprovar.'; end if;
  novo := case when r.expansao = 'Não' then 'fora' when r.contrato = 'Sim' then 'contrato' else 'pedido' end;
  linha := 'Análise aprovada · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.aprovacoes_notas set etapa = novo, historico = historico || jsonb_build_array(linha), versao = versao + 1, por_email = eu.email, por_nome = eu.nome, atualizado_em = now()
   where nota_id = p_nota returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_arquivo_remover(p_nota text, p_chave text, p_nome text, p_remover boolean DEFAULT true, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; v_chave text := nullif(trim(coalesce(p_chave, '')), ''); linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Remover arquivo da nota é da equipe administrativa.'; end if;
  if v_chave is null then raise exception 'Arquivo não identificado. Atualize a tela e tente de novo.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if r.nota_id is null then raise exception 'Esta nota ainda não tem registro no painel. Atualize a tela e tente de novo.'; end if;
  if p_base is not null and r.versao <> p_base then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  linha := case when coalesce(p_remover, true) then 'Arquivo removido da nota: ' else 'Arquivo devolvido à nota: ' end
           || coalesce(nullif(trim(p_nome), ''), v_chave) || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.aprovacoes_notas set
    arquivos_ocultos = case when coalesce(p_remover, true)
      then (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements_text(coalesce(arquivos_ocultos, '[]'::jsonb) || jsonb_build_array(v_chave)) x)
      else (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(coalesce(arquivos_ocultos, '[]'::jsonb)) x where x <> v_chave) end,
    historico = historico || jsonb_build_array(linha), versao = versao + 1, por_email = eu.email, por_nome = eu.nome, atualizado_em = now()
  where nota_id = p_nota returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_completar_campos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m record;
begin
  select e.narrativa, e.contrato, e.expansao, e.pedido into m from public.monday_espelho e
   where (e.lancamento_id = new.nota_id or 'M' || e.item_id = new.nota_id) and e.etapa <> 'excluida' limit 1;
  if found then
    if coalesce(new.narrativa, '') = '' then new.narrativa := m.narrativa; end if;
    if coalesce(new.contrato, '') = '' then new.contrato := m.contrato; end if;
    if coalesce(new.expansao, '') = '' then new.expansao := m.expansao; end if;
    if coalesce(new.pedido, '') = '' then new.pedido := m.pedido; end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_confirmar_pedido(p_nota text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo','admin') then raise exception 'Confirmar o pedido é da equipe administrativa.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'aprovacao' then raise exception 'Esta nota não está aguardando a aprovação do pedido.'; end if;
  linha := 'Pedido aprovado no Datasul · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome) values (p_nota, 'escrituracao', jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'escrituracao', historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_ctx(p_nota text, p_base integer)
 RETURNS TABLE(mon text, eff text, existe boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.aprovacoes_notas; v_mon text;
begin
  v_mon := public.aprovacoes_etapa_base(p_nota);
  if v_mon is null and not exists (select 1 from public.lancamentos l where l.id = p_nota and l.status = 'Enviado') then raise exception 'Nota não encontrada.'; end if;
  if v_mon in ('encaminhada','fiscal','arquivada','cancelada') then raise exception 'Esta nota já foi encaminhada: não dá mais para alterar no painel.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if r.nota_id is not null and (p_base is null or r.versao <> p_base) then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  mon := v_mon; existe := r.nota_id is not null;
  eff := case
    when r.etapa = 'devolvida' then
      case when exists (select 1 from public.lancamentos l where l.id = p_nota and l.status = 'Enviado' and l.atualizado_em > r.atualizado_em)
           then 'engenharia'
           else 'devolvida' end
    else coalesce(r.etapa, case when v_mon in ('contrato','pedido','aprovacao','escrituracao','fora') then v_mon else 'engenharia' end)
  end;
  return next;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_devolver(p_nota text, p_motivo text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; l public.lancamentos; linha text; v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','administrativo','admin') then raise exception 'Devolver ao lançamento é da engenharia.'; end if;
  if v_motivo is null then raise exception 'Informe o motivo da devolução.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff not in ('engenharia','contrato','fora') then raise exception 'Esta nota já foi lançada no Datasul ou já foi devolvida: não dá mais para devolver por aqui.'; end if;
  select * into l from public.lancamentos where id = p_nota for update;
  if l.id is null or l.status <> 'Enviado' then raise exception 'Esta nota não veio do lançamento do painel (ou já foi devolvida): devolva pela tela de lançamento.'; end if;
  linha := 'Devolvida ao lançamento: ' || v_motivo || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.lancamentos
     set status = 'Pendente', requer_revisao = true, enviado_por_email = null,
         observacoes = trim(both E'\n' from coalesce(observacoes, '') || E'\n' || 'Devolvida pela Engenharia (' || eu.nome || ', ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY') || '): ' || v_motivo)
   where id = p_nota;
  insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome)
       values (p_nota, 'devolvida', jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'devolvida', historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_editar_campos(p_nota text, p_campos jsonb, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; ctx record; r public.aprovacoes_notas; novos jsonb := '{}'::jsonb; k text; linha text; alterados text := '';
  permitidos text[] := array['fornecedor','nf','valor','emissao','vencimento','unidade','natureza','pagamento','cnpj_fornecedor','banco','agencia','conta_corrente','chave_pix','pedido','codigo_emitente'];
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Corrigir os dados da nota é da equipe administrativa.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff not in ('engenharia', 'contrato', 'pedido', 'aprovacao', 'escrituracao', 'fora') then raise exception 'Esta nota já foi enviada: não dá mais para corrigir os dados por aqui.'; end if;
  for k in select jsonb_object_keys(coalesce(p_campos, '{}'::jsonb)) loop
    if not (k = any(permitidos)) then raise exception 'Campo não editável: %', k; end if;
    novos := novos || jsonb_build_object(k, nullif(trim(coalesce(p_campos ->> k, '')), ''));
    alterados := alterados || case when alterados = '' then '' else ', ' end || k;
  end loop;
  if alterados = '' then raise exception 'Nada para corrigir.'; end if;
  linha := 'Dados corrigidos (' || alterados || ') · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, campos, historico, por_email, por_nome)
       values (p_nota, ctx.eff, novos, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set campos = public.aprovacoes_notas.campos || excluded.campos,
       historico = public.aprovacoes_notas.historico || jsonb_build_array(linha), versao = public.aprovacoes_notas.versao + 1,
       por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_etapa_base(p_nota text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.etapa from public.aprovacoes_notas a where a.nota_id = p_nota limit 1
$function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_mover(p_nota text, p_etapa text, p_motivo text DEFAULT NULL::text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); linha text; destino text;
begin
  select * into eu from public.compras_eu();
  -- 17/11/2026 (pedido da Camila, autorizado pelo Gustavo): engenheiros (equipe 'expansao' neste banco) também cancelam, com motivo; mover de grupo continua só do administrativo.
  if eu.equipe is null or not (eu.equipe in ('administrativo', 'admin') or (eu.equipe = 'expansao' and p_etapa = 'cancelada')) then raise exception 'Mover a nota de grupo é da equipe administrativa.'; end if;
  if p_etapa not in ('engenharia', 'contrato', 'pedido', 'aprovacao', 'escrituracao', 'fora', 'encaminhada', 'cancelada') then raise exception 'Grupo inválido.'; end if;
  if p_etapa = 'cancelada' and v_motivo is null then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if eu.equipe = 'expansao' and r.etapa in ('encaminhada', 'fiscal', 'cancelada') then raise exception 'Esta nota já foi enviada ou cancelada; peça à equipe administrativa.'; end if;
  if r.nota_id is not null and p_base is not null and r.versao <> p_base then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  destino := case p_etapa when 'engenharia' then 'Análise da engenharia' when 'contrato' then 'Vincular contrato' when 'pedido' then 'A lançar' when 'aprovacao' then 'Aprovação do pedido'
             when 'escrituracao' then 'Escrituração' when 'fora' then 'Fora da expansão' when 'encaminhada' then 'Encaminhadas' else 'Canceladas' end;
  linha := 'Movida para ' || destino || coalesce(' · motivo: ' || v_motivo, '') || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, decisao, aguarda_reenvio, historico, por_email, por_nome)
       values (p_nota, p_etapa, null, false, jsonb_build_array(linha), eu.email, eu.nome)
  -- 19/11/2026: nota que já tinha sido enviada e volta para uma etapa anterior fica marcada para reenvio (o envio não a barra como "já enviada").
  on conflict (nota_id) do update set etapa = excluded.etapa, decisao = null,
       aguarda_reenvio = (excluded.etapa in ('engenharia', 'contrato', 'pedido', 'aprovacao', 'escrituracao', 'fora')
                          and (public.aprovacoes_notas.data_envio is not null or exists (select 1 from public.lancamentos l where l.id = p_nota and l.data_envio is not null))),
       historico = public.aprovacoes_notas.historico || jsonb_build_array(linha), versao = public.aprovacoes_notas.versao + 1,
       por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_reabrir_escrituracao(p_nota text, p_motivo text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Voltar a nota para escrituração é da equipe administrativa.'; end if;
  if v_motivo is null then raise exception 'Informe o que precisa ser corrigido.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if r.nota_id is null or r.etapa not in ('encaminhada', 'fiscal') or r.decisao is distinct from 'recusada' then
    raise exception 'Só dá para voltar à escrituração uma nota recusada.';
  end if;
  if p_base is not null and r.versao <> p_base then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  linha := 'Recusada: corrigir e reenviar · ' || v_motivo || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.aprovacoes_notas
     set etapa = 'escrituracao', decisao = null, aguarda_reenvio = true, historico = historico || jsonb_build_array(linha), versao = versao + 1,
         por_email = eu.email, por_nome = eu.nome, atualizado_em = now()
   where nota_id = p_nota returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_registrar_pedido(p_nota text, p_pedido text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo','admin') then raise exception 'Registrar o pedido é da equipe administrativa.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'pedido' then raise exception 'Esta nota não está em A lançar.'; end if;
  if coalesce(trim(p_pedido),'') = '' then raise exception 'Informe o número do pedido lançado no Datasul.'; end if;
  linha := 'Pedido registrado: ' || trim(p_pedido) || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, pedido, historico, por_email, por_nome) values (p_nota, 'aprovacao', trim(p_pedido), jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'aprovacao', pedido = excluded.pedido, historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_registrar_retorno(p_nota text, p_resultado text, p_motivo text DEFAULT NULL::text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'O retorno da escrituração é da equipe administrativa.'; end if;
  if p_resultado not in ('aprovada', 'recusada') then raise exception 'Resultado inválido.'; end if;
  if p_resultado = 'recusada' and v_motivo is null then raise exception 'Informe o motivo da recusa.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if r.nota_id is null or r.etapa <> 'encaminhada' then raise exception 'Esta nota não está em Encaminhadas.'; end if;
  if p_base is not null and r.versao <> p_base then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  linha := 'Escrituração ' || case p_resultado when 'aprovada' then 'APROVADA' else 'RECUSADA' end
           || coalesce(' · motivo: ' || v_motivo, '') || ' · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.aprovacoes_notas
     set decisao = p_resultado, historico = historico || jsonb_build_array(linha), versao = versao + 1,
         por_email = eu.email, por_nome = eu.nome, atualizado_em = now()
   where nota_id = p_nota returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_salvar(p_nota text, p_narrativa text DEFAULT NULL::text, p_contrato text DEFAULT NULL::text, p_expansao text DEFAULT NULL::text, p_base integer DEFAULT NULL::integer, p_pagador text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_endereco text DEFAULT NULL::text)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; n text; c text; x text; pg text; ca text; en text; novo text; mudou text[] := array[]::text[]; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','administrativo','admin') then raise exception 'Só a engenharia preenche a análise.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  -- 19/11/2026 (Beatriz, NF 55 e 1801): na Escrituração a equipe administrativa ainda corrige Pagador, Categoria e Endereço (o envio depende do Pagador).
  if ctx.eff not in ('engenharia','contrato','pedido','aprovacao','fora')
     and not (ctx.eff = 'escrituracao' and eu.equipe in ('administrativo','admin') and p_narrativa is null and p_contrato is null and p_expansao is null)
  then raise exception 'Esta nota já foi para a escrituração: não dá mais para corrigir.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota;
  n := case when p_narrativa is null then r.narrativa else nullif(trim(p_narrativa),'') end;
  c := case when p_contrato is null then r.contrato else nullif(trim(p_contrato),'') end;
  x := case when p_expansao is null then r.expansao else nullif(trim(p_expansao),'') end;
  pg := case when p_pagador is null then r.pagador else nullif(trim(p_pagador),'') end;
  ca := case when p_categoria is null then r.categoria else nullif(trim(p_categoria),'') end;
  en := case when p_endereco is null then r.endereco_obra else nullif(trim(p_endereco),'') end;
  if c is not null and c not in ('Sim','Não') then raise exception 'Contrato deve ser Sim ou Não.'; end if;
  if x is not null and x not in ('Sim','Não') then raise exception 'Pertence à engenharia deve ser Sim ou Não.'; end if;
  novo := ctx.eff;
  if novo in ('contrato','pedido','fora') and n is not null and c is not null and x is not null then
    novo := case when x = 'Não' then 'fora' when c = 'Sim' then 'contrato' else 'pedido' end;
  end if;
  if n is distinct from r.narrativa then mudou := array_append(mudou, 'narrativa'::text); end if;
  if c is distinct from r.contrato then mudou := array_append(mudou, 'contrato'::text); end if;
  if x is distinct from r.expansao then mudou := array_append(mudou, 'pertence à engenharia'::text); end if;
  if pg is distinct from r.pagador then mudou := array_append(mudou, 'pagador'::text); end if;
  if ca is distinct from r.categoria then mudou := array_append(mudou, 'categoria'::text); end if;
  if en is distinct from r.endereco_obra then mudou := array_append(mudou, 'endereço da obra'::text); end if;
  if r.nota_id is not null and cardinality(mudou) = 0 and novo = r.etapa then return r; end if;
  linha := case when cardinality(mudou) = 0 then 'Encaminhamento atualizado' else 'Análise salva: ' || array_to_string(mudou, ', ') end
           || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, narrativa, contrato, expansao, pagador, categoria, endereco_obra, historico, por_email, por_nome)
       values (p_nota, novo, n, c, x, pg, ca, en, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = excluded.etapa, narrativa = excluded.narrativa, contrato = excluded.contrato, expansao = excluded.expansao,
       pagador = excluded.pagador, categoria = excluded.categoria, endereco_obra = excluded.endereco_obra,
       historico = public.aprovacoes_notas.historico || jsonb_build_array(linha), versao = public.aprovacoes_notas.versao + 1,
       por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_sem_contrato(p_nota text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','administrativo','admin') then raise exception 'Esta decisão é da engenharia.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'contrato' then raise exception 'Esta nota não está aguardando vínculo de contrato.'; end if;
  linha := 'Não é de contrato: segue para A lançar · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, contrato, historico, por_email, por_nome) values (p_nota, 'pedido', 'Não', jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'pedido', contrato = 'Não', contrato_ref = null, historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.aprovacoes_vincular_contrato(p_nota text, p_contrato text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; v_nome text; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','administrativo','admin') then raise exception 'Vincular contrato é da engenharia.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'contrato' then raise exception 'Esta nota não está aguardando vínculo de contrato.'; end if;
  select c.nome into v_nome from public.contratos c where c.item_id = p_contrato;
  if v_nome is null then raise exception 'Contrato não encontrado.'; end if;
  linha := 'Contrato vinculado: ' || v_nome || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, contrato_ref, historico, por_email, por_nome) values (p_nota, 'pedido', p_contrato, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'pedido', contrato_ref = excluded.contrato_ref, historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now()
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.assistente_desfazer_proposta(p_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; cols text; n int := 0;
begin
  for r in select * from assistente_desfazer where proposta_id = p_id order by id desc loop
    if r.tabela not in ('lancamentos','arquivos_processados','exclusoes_recentes','historico_status') then
      raise exception 'tabela % fora da lista', r.tabela;
    end if;
    if r.operacao = 'INSERT' then
      execute format('delete from public.%I where id::text = $1', r.tabela) using r.chave->>'id';
    elsif r.operacao = 'DELETE' then
      execute format('insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I, $1)', r.tabela, r.tabela) using r.antes;
    else
      select string_agg(format('%I = x.%I', k, k), ', ') into cols
        from jsonb_object_keys(r.antes) k
        where k <> 'id' and exists (select 1 from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = r.tabela and c.column_name = k and c.is_generated = 'NEVER');
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) x where t.id::text = $2', r.tabela, cols, r.tabela)
        using r.antes, r.chave->>'id';
    end if;
    n := n + 1;
  end loop;
  update assistente_propostas set estado = 'desfeita', desfeita_em = now() where id = p_id;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.atividades_chave_confere(chave text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(length(chave)>0 and chave=(select decrypted_secret from vault.decrypted_secrets where name='atividades_espelho'),false)
$function$;

CREATE OR REPLACE FUNCTION public.bloquear_recriar_excluido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tipo text := tg_argv[0]; v_chave text;
begin
  v_chave := case v_tipo when 'contrato' then to_jsonb(new) ->> 'item_id' else coalesce(to_jsonb(new) ->> 'monday_req_id', to_jsonb(new) ->> 'id') end;
  if v_chave is not null and exists (select 1 from public.painel_exclusoes where tipo = v_tipo and chave = v_chave) then return null; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_eu()
 RETURNS TABLE(email text, nome text, equipe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lower(coalesce(auth.jwt() ->> 'email','')),
         coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'nome',''), split_part(auth.jwt() ->> 'email','@',1)),
         public.painel_equipe()
$function$;

CREATE OR REPLACE FUNCTION public.contratos_criar(p_nome text, p_tipo text, p_unidade text, p_valor numeric, p_aceite date DEFAULT NULL::date, p_cnpj text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_tipologia text DEFAULT NULL::text, p_aprovador text DEFAULT NULL::text)
 RETURNS contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_grupo_id text; v_grupo text; r public.contratos;
begin
  if not public.contratos_pode_editar() then raise exception 'Só o Marcos cria contratos.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o prestador.'; end if;
  if coalesce(trim(p_unidade), '') = '' then raise exception 'Escolha a unidade.'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'Informe o valor fechado.'; end if;
  select t.g, t.n into v_grupo_id, v_grupo
    from (values ('Contrato Global', 'group_mkxttxw9', 'Contratos Globais'),
                 ('Contrato', 'group_mm1a7kyb', 'Contratos'),
                 ('Contrato - Faturamento direto', 'group_mm1aq725', 'Contrato - Faturamento direto')) as t(tipo, g, n)
   where t.tipo = p_tipo;
  if v_grupo is null then raise exception 'Tipo de contrato inválido.'; end if;
  insert into public.contratos (item_id, nome, grupo_id, grupo_nome, estado, aprovador, unidade, referencia, tipologia, tipo, status,
    valor_fechado, aceite, cnpj, inclusao, origem, criado_por, criado_em, espelhado_em)
  values ('P-' || replace(gen_random_uuid()::text, '-', ''), upper(trim(p_nome)), v_grupo_id, v_grupo, 'active', nullif(trim(p_aprovador), ''),
    trim(p_unidade), nullif(trim(p_referencia), ''), nullif(trim(p_tipologia), ''), p_tipo, 'Ativo',
    p_valor, p_aceite, nullif(trim(p_cnpj), ''), current_date, 'painel', lower(auth.jwt() ->> 'email'), now(), now())
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.contratos_criar_aditivo(p_contrato text, p_descricao text, p_valor numeric, p_aceite date DEFAULT NULL::date)
 RETURNS contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pai public.contratos; r public.contratos; v_desc text;
begin
  if not public.contratos_pode_editar() then raise exception 'Só o Marcos cria aditivos.'; end if;
  if coalesce(trim(p_contrato), '') = '' then raise exception 'Todo aditivo precisa estar vinculado a um contrato.'; end if;
  select * into pai from public.contratos where item_id = p_contrato for update;
  if not found then raise exception 'Contrato não encontrado: todo aditivo precisa estar vinculado a um contrato.'; end if;
  if pai.tipo = 'Aditivo' or pai.grupo_nome = 'Aditivos' then raise exception 'Escolha um contrato, não outro aditivo.'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'Informe o valor do aditivo.'; end if;
  v_desc := coalesce(nullif(upper(trim(p_descricao)), ''), 'ADITIVO ' || (coalesce(array_length(pai.aditivos, 1), 0) + 1));
  insert into public.contratos (item_id, nome, grupo_id, grupo_nome, estado, aprovador, unidade, tipologia, tipo, status,
    valor_fechado, aceite, cnpj, inclusao, origem, criado_por, criado_em, espelhado_em)
  values ('P-' || replace(gen_random_uuid()::text, '-', ''), pai.nome || ' - ' || v_desc, 'group_mm1ae4ce', 'Aditivos', 'active', pai.aprovador,
    pai.unidade, pai.tipologia, 'Aditivo', 'Ativo', p_valor, p_aceite, pai.cnpj, current_date, 'painel', lower(auth.jwt() ->> 'email'), now(), now())
  returning * into r;
  update public.contratos set aditivos = array_append(aditivos, r.item_id) where item_id = pai.item_id;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.contratos_editar(p_id text, p_nome text, p_tipo text, p_unidade text, p_valor numeric, p_status text, p_aceite date DEFAULT NULL::date, p_cnpj text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_tipologia text DEFAULT NULL::text, p_aprovador text DEFAULT NULL::text, p_contrato_pai text DEFAULT NULL::text)
 RETURNS contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.contratos; v_grupo_id text; v_grupo text;
begin
  if not public.contratos_pode_editar() then raise exception 'Só o Marcos altera contratos e aditivos.'; end if;
  select * into c from public.contratos where item_id = p_id for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  if coalesce(trim(p_unidade), '') = '' then raise exception 'Escolha a unidade.'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'Informe o valor.'; end if;
  if coalesce(p_status, '') not in ('Ativo', 'Encerrado') then raise exception 'Status inválido.'; end if;

  if c.tipo = 'Aditivo' or c.grupo_nome = 'Aditivos' then
    if coalesce(trim(p_contrato_pai), '') = '' then raise exception 'Todo aditivo precisa estar vinculado a um contrato.'; end if;
    if p_contrato_pai = p_id or not exists (select 1 from public.contratos where item_id = p_contrato_pai and coalesce(tipo, '') <> 'Aditivo' and coalesce(grupo_nome, '') <> 'Aditivos') then
      raise exception 'Escolha um contrato existente (não outro aditivo).';
    end if;
    update public.contratos set aditivos = array_remove(aditivos, p_id) where p_id = any(aditivos) and item_id <> p_contrato_pai;
    update public.contratos set aditivos = array_append(aditivos, p_id) where item_id = p_contrato_pai and not (p_id = any(aditivos));
    update public.contratos set nome = upper(trim(p_nome)), unidade = trim(p_unidade), valor_fechado = p_valor, status = p_status, aceite = p_aceite,
      cnpj = nullif(trim(p_cnpj), ''), referencia = nullif(trim(p_referencia), ''), tipologia = nullif(trim(p_tipologia), ''), aprovador = nullif(trim(p_aprovador), '')
     where item_id = p_id returning * into c;
    return c;
  end if;

  if p_status = 'Encerrado' then
    v_grupo_id := 'group_mkxtj713'; v_grupo := 'Contratos finalizados';
  else
    select t.g, t.n into v_grupo_id, v_grupo
      from (values ('Contrato Global', 'group_mkxttxw9', 'Contratos Globais'), ('Contrato', 'group_mm1a7kyb', 'Contratos'),
                   ('Contrato - Faturamento direto', 'group_mm1aq725', 'Contrato - Faturamento direto')) as t(tipo, g, n)
     where t.tipo = p_tipo;
  end if;
  if v_grupo is null then raise exception 'Tipo de contrato inválido.'; end if;
  update public.contratos set nome = upper(trim(p_nome)), tipo = p_tipo, grupo_id = v_grupo_id, grupo_nome = v_grupo, unidade = trim(p_unidade), valor_fechado = p_valor,
    status = p_status, aceite = p_aceite, cnpj = nullif(trim(p_cnpj), ''), referencia = nullif(trim(p_referencia), ''), tipologia = nullif(trim(p_tipologia), ''),
    aprovador = nullif(trim(p_aprovador), '')
   where item_id = p_id returning * into c;
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.contratos_excluir(p_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.contratos; v_aditivo boolean;
begin
  if not public.contratos_pode_editar() then raise exception 'Só o Marcos e o Gustavo excluem contratos e aditivos.'; end if;
  select * into c from public.contratos where item_id = p_id for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  v_aditivo := c.tipo = 'Aditivo' or c.grupo_nome = 'Aditivos';
  if coalesce(array_length(c.aditivos, 1), 0) > 0 then raise exception 'Este contrato tem aditivos. Exclua os aditivos primeiro.'; end if;
  if exists (select 1 from public.aprovacoes_notas where contrato_ref = p_id) or coalesce(array_length(c.notas, 1), 0) > 0 then
    raise exception 'Há notas vinculadas a este contrato. Devolva essas notas antes de excluir.';
  end if;
  insert into public.painel_exclusoes (tipo, chave, dados, por) values ('contrato', p_id, to_jsonb(c), lower(coalesce(auth.jwt() ->> 'email', '')))
    on conflict (tipo, chave) do update set dados = excluded.dados, por = excluded.por, em = now();
  update public.contratos set aditivos = array_remove(aditivos, p_id) where p_id = any(aditivos);
  delete from public.contratos where item_id = p_id;
  return c.nome;
end $function$;

CREATE OR REPLACE FUNCTION public.contratos_pode_editar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('marcos.prado@holding.exemplo', 'gustavo@empresa.exemplo')
$function$;

CREATE OR REPLACE FUNCTION public.contratos_registrar_arquivo(p_contrato text, p_nome text, p_caminho text, p_tamanho bigint DEFAULT NULL::bigint)
 RETURNS contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.contratos;
begin
  if not public.contratos_pode_editar() then raise exception 'Só o Marcos anexa documentos em contratos.'; end if;
  if not exists (select 1 from public.contratos where item_id = p_contrato) then raise exception 'Contrato não encontrado.'; end if;
  if coalesce(p_caminho, '') not like p_contrato || '/%' then raise exception 'Caminho do arquivo inválido.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'contratos' and name = p_caminho) then raise exception 'Arquivo não encontrado no armazenamento.'; end if;
  update public.contratos
     set arquivos_itens = arquivos_itens || jsonb_build_array(jsonb_build_object(
           'id', 'p-' || md5(p_caminho), 'nome', coalesce(nullif(trim(p_nome), ''), 'arquivo'), 'tamanho', p_tamanho,
           'bucket', 'contratos', 'caminho', p_caminho, 'por', lower(auth.jwt() ->> 'email'), 'em', now())),
         arquivos = arquivos + 1
   where item_id = p_contrato
  returning * into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.equipe_painel()
 RETURNS TABLE(email text, nome text, criado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select lower(u.email)::text,
         nullif(trim(u.raw_user_meta_data->>'nome'), '')::text,
         u.created_at
  from auth.users u
  where u.email is not null
    and lower(u.email) not like '%@painel.local'
    and u.deleted_at is null
  order by u.created_at, u.email;
$function$;

CREATE OR REPLACE FUNCTION public.fn_assistente_desfazer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid bigint := nullif(current_setting('assistente.proposta_id', true), '')::bigint;
begin
  if session_user <> 'assistente_escrita' then return coalesce(new, old); end if;
  insert into assistente_desfazer(proposta_id, tabela, operacao, chave, antes, depois)
  values (coalesce(pid, -1), tg_table_name, tg_op,
          jsonb_build_object('id', case when tg_op = 'DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_audit_lancamento()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  campos_monitorados TEXT[] := ARRAY[
    'arquivo_nf_nome',
    'arquivo_nf_path',
    'arquivo_boleto_nome',
    'arquivo_boleto_path',
    'nf',
    'fornecedor',
    'valor',
    'status',
    'monday_nf_enviado',
    'monday_boleto_enviado'
  ];
  campo TEXT;
  valor_antigo TEXT;
  valor_novo TEXT;
BEGIN
  FOREACH campo IN ARRAY campos_monitorados LOOP
    valor_antigo := to_jsonb(OLD) ->> campo;
    valor_novo   := to_jsonb(NEW) ->> campo;

    IF valor_antigo IS DISTINCT FROM valor_novo THEN
      -- Não duplica com o registro de status que o painel já grava
      IF campo != 'status' THEN
        INSERT INTO historico_status (lancamento_id, status, usuario, criado_em, detalhes)
        VALUES (
          NEW.id,
          'Alteração de campo',
          COALESCE(NEW.travado_por, 'sistema'),
          NOW(),
          jsonb_build_object(
            'campo', campo,
            'de', valor_antigo,
            'para', valor_novo
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.juntar_copia_monday(p_lanc text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.lancamentos%rowtype;
  v_nf text; v_raiz text; v_item text; v_n int; v_linha text;
begin
  select * into l from public.lancamentos where id = p_lanc;
  if not found or l.status is distinct from 'Enviado' then return null; end if;
  if exists (select 1 from public.monday_espelho where lancamento_id = p_lanc) then return null; end if;   -- já ligada
  if exists (select 1 from public.aprovacoes_notas where nota_id = p_lanc) then return null; end if;      -- já tem análise própria
  v_nf := regexp_replace(coalesce(l.nf, ''), '^0+(?=.)', '');
  v_raiz := left(regexp_replace(coalesce(l.cnpj_fornecedor, ''), '\D', '', 'g'), 8);
  if v_nf = '' or length(v_raiz) < 8 then return null; end if;
  select count(*), min(m.item_id::text) into v_n, v_item
    from public.monday_espelho m
   where m.lancamento_id is null and m.etapa <> 'excluida'
     and regexp_replace(coalesce(m.documento, ''), '^0+(?=.)', '') = v_nf
     and left(regexp_replace(coalesce(m.cnpj, ''), '\D', '', 'g'), 8) = v_raiz
     and (abs(coalesce(m.valor, -1) - coalesce(l.valor, -2)) < 0.01 or m.emissao = l.emissao)
     and not exists (select 1 from public.aprovacoes_notas a where a.nota_id = 'M' || m.item_id and a.etapa in ('cancelada', 'removida'));
  if v_n <> 1 then return null; end if;
  update public.monday_espelho set lancamento_id = p_lanc where item_id::text = v_item;
  v_linha := 'Lançamento juntado com a nota que já estava no painel (importada do sistema antigo): uma nota só, com os dados do lançamento · '
             || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || coalesce(l.enviado_por, 'Lançamento');
  update public.aprovacoes_notas set nota_id = p_lanc, historico = historico || jsonb_build_array(v_linha), versao = versao + 1, atualizado_em = now()
   where nota_id = 'M' || v_item;
  update public.aprovacoes_anexos set nota_id = p_lanc where nota_id = 'M' || v_item;
  update public.escrituracao_pedidos set nota_id = p_lanc where nota_id = 'M' || v_item;
  update public.tag_notas set origem_id = p_lanc where origem_id = 'M' || v_item;
  return 'M' || v_item;
end $function$;

CREATE OR REPLACE FUNCTION public.lancamento_arquivos_tamanhos()
 RETURNS TABLE(lancamento_id text, tipo text, tamanho bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'storage'
AS $function$
  select l.id::text, 'nf'::text, (o.metadata->>'size')::bigint
    from public.lancamentos l join storage.objects o on o.bucket_id = 'documentos' and o.name = l.arquivo_nf_path where l.status = 'Enviado'
  union all
  select l.id::text, 'boleto'::text, (o.metadata->>'size')::bigint
    from public.lancamentos l join storage.objects o on o.bucket_id = 'documentos' and o.name = l.arquivo_boleto_path where l.status = 'Enviado'
$function$;

CREATE OR REPLACE FUNCTION public.lancamento_juntar_copia_monday()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'Enviado' and (tg_op = 'INSERT' or old.status is distinct from 'Enviado') then
    begin
      perform public.juntar_copia_monday(new.id);
    exception when others then
      raise warning 'juntar_copia_monday(%): %', new.id, sqlerrm;   -- nunca impede o envio do lançamento
    end;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.painel_acesso_lancamento()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.painel_equipe() in ('admin','administrativo'), false)
      or lower(coalesce(auth.jwt() ->> 'email','')) = 'teste@painel.local'
$function$;

CREATE OR REPLACE FUNCTION public.painel_engenheiros()
 RETURNS TABLE(email text, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with lista as (
    select p.email from public.painel_perfis p where p.equipe = 'expansao'
    union
    select lower(x) from unnest(array['camila.torres@empresa.exemplo','paula.duarte@empresa.exemplo','beatriz.martins@empresa.exemplo']) as x
  )
  select l.email, coalesce(nullif(u.raw_user_meta_data ->> 'nome',''), initcap(split_part(split_part(l.email,'@',1),'.',1)))
    from lista l left join auth.users u on lower(u.email) = l.email
   where public.painel_equipe() in ('expansao','admin')
   order by 2
$function$;

CREATE OR REPLACE FUNCTION public.painel_equipe()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select equipe from public.painel_perfis where email = lower(coalesce(auth.jwt() ->> 'email',''))
$function$;

CREATE OR REPLACE FUNCTION public.remessa_direto_escrituracao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare linha text;
begin
  if new.status = 'Enviado' and new.natureza = 'Remessa'
     and (tg_op = 'INSERT' or old.status is distinct from 'Enviado' or old.natureza is distinct from 'Remessa') then
    linha := 'Remessa: foi direto para a Escrituração (não passa por análise, pedido nem aprovação) · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome)
    values (new.id, 'escrituracao', jsonb_build_array(linha), new.enviado_por_email, coalesce(new.enviado_por, 'Lançamento'))
    on conflict (nota_id) do update set etapa = 'escrituracao', historico = public.aprovacoes_notas.historico || jsonb_build_array(linha),
         versao = public.aprovacoes_notas.versao + 1, atualizado_em = now()
     where public.aprovacoes_notas.etapa in ('engenharia', 'devolvida');
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.atualizado_em = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tag_avisar_mudanca()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime'
AS $function$
begin
  perform realtime.send('{}'::jsonb, 'mudou', 'tag', false);
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.tag_receber_nota(p_nota text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  eu record; ctx record; a public.aprovacoes_notas; l public.lancamentos; m public.monday_espelho;
  v_existente text; v_id text; v_nf text; v_forn text; v_cnpj text; v_valor numeric; v_emissao date; v_venc date;
  v_pag text; v_pagid int; v_files jsonb := '[]'::jsonb; v_agora text; v_doc jsonb; v_leve jsonb; v_prev jsonb; v_linha text;
  v_nome text; v_tag constant text := 'TAG EXEMPLO FUNDO DE INVESTIMENTO IMOBILIARIO'; v_grupo constant text := 'group_mm2c28pe';
  v_titulo constant text := 'TAG - Notas Fiscais Pendentes de aprovação';
  ov jsonb; v_banco text; v_agencia text; v_conta text; v_pix text; v_forma text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('administrativo','admin') then raise exception 'Enviar a nota para a TAG é da equipe administrativa.'; end if;
  select id into v_existente from public.tag_notas where origem_id = p_nota;
  if v_existente is not null then return v_existente; end if;

  select * into a from public.aprovacoes_notas where nota_id = p_nota;
  select * into ctx from public.aprovacoes_ctx(p_nota, a.versao);
  if ctx.eff <> 'escrituracao' then raise exception 'A nota precisa estar pronta para escriturar (etapa Escrituração).'; end if;
  select * into l from public.lancamentos where id = p_nota;
  if l.id is null and p_nota like 'M%' then select * into m from public.monday_espelho where item_id = substr(p_nota, 2);
  else select * into m from public.monday_espelho where lancamento_id = p_nota and etapa <> 'excluida' limit 1; end if;
  -- 19/11/2026 (Gustavo): Remessa NÃO vai para a TAG (volta a regra de antes de 18/11). Só Pagador Tag.
  -- O Pagador vale na mesma ordem da tela: análise do painel > lançamento > cópia da Monday.
  if coalesce(a.campos->>'natureza', l.natureza, m.natureza, '') = 'Remessa' then raise exception 'Nota de Remessa não vai para a TAG: ela fica na Escrituração da Engenharia.'; end if;
  if lower(trim(coalesce(nullif(a.pagador, ''), nullif(l.pagador, ''), m.pagador, ''))) <> 'tag' then raise exception 'O pagador desta nota não é Tag.'; end if;

  -- Correções do painel valem sobre o lançamento (campo presente e vazio = limpo no painel).
  ov := coalesce(a.campos, '{}'::jsonb);
  v_banco := case when ov ? 'banco' then ov->>'banco' else l.banco end;
  v_agencia := case when ov ? 'agencia' then ov->>'agencia' else l.agencia end;
  v_conta := case when ov ? 'conta_corrente' then ov->>'conta_corrente' else l.conta_corrente end;
  v_pix := case when ov ? 'chave_pix' then ov->>'chave_pix' else l.chave_pix end;
  v_forma := coalesce(nullif(ov->>'pagamento', ''), l.pagamento, '');

  v_nf := coalesce(nullif(ov->>'nf', ''), nullif(l.nf, ''), m.documento, '');
  v_forn := coalesce(nullif(l.fornecedor, ''), nullif(trim(regexp_replace(coalesce(m.nome, ''), '\s*-\s*NOTA\b.*$', '', 'i')), ''), '');
  v_cnpj := coalesce(l.cnpj_fornecedor, m.cnpj, '');
  v_valor := coalesce(l.valor, m.valor, 0);
  v_emissao := coalesce(l.emissao, m.emissao);
  v_venc := coalesce(l.vencimento, m.vencimento);
  v_pagid := case lower(v_forma) when 'boleto' then 1 when 'dados bancários' then 2 when 'parcelado' then 3 when 'cartão de crédito' then 4 when 'link de crédito' then 5 when 'pago por terceiro' then 7 else 1 end;
  v_pag := case v_pagid when 1 then 'Boleto' when 2 then 'Dados bancários' when 3 then 'Parcelado' when 4 then 'Cartão de crédito' when 5 then 'Link de Crédito' else 'Pago por terceiro' end;
  v_id := 'E' || substr(md5(p_nota), 1, 12);
  v_agora := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_nome := trim(v_nf || ' - ' || v_forn);

  -- Arquivos: os do lançamento (NF e boleto) continuam no bucket 'documentos'; a TAG os lê de lá, sem copiar.
  -- (18/11/2026) Depois deles: os da Monday já copiados e os incluídos pelo painel.
  if l.arquivo_nf_path is not null then
    v_files := v_files || jsonb_build_array(jsonb_build_object('id', 'nf-' || substr(md5(l.arquivo_nf_path), 1, 8), 'name', coalesce(l.arquivo_nf_nome, 'Nota fiscal.pdf'), 'url', null, 'local', 'storage:documentos/' || l.arquivo_nf_path, 'kind', 'files', 'origin', 'Engenharia'));
  end if;
  if l.arquivo_boleto_path is not null then
    v_files := v_files || jsonb_build_array(jsonb_build_object('id', 'bol-' || substr(md5(l.arquivo_boleto_path), 1, 8), 'name', coalesce(l.arquivo_boleto_nome, 'Boleto.pdf'), 'url', null, 'local', 'storage:documentos/' || l.arquivo_boleto_path, 'kind', 'files', 'origin', 'Engenharia'));
  end if;
  -- 19/11/2026: 2º boleto (ou mais) vinculado no lançamento (arquivos_processados). Antes ia só o primeiro.
  if l.id is not null then
    v_files := v_files || coalesce((select jsonb_agg(jsonb_build_object('id', 'bol-' || substr(md5(ap.path_storage), 1, 8), 'name', coalesce(ap.nome_arquivo, 'Boleto.pdf'), 'url', null, 'local', 'storage:documentos/' || ap.path_storage, 'kind', 'files', 'origin', 'Engenharia') order by ap.criado_em)
      from public.arquivos_processados ap where ap.lancamento_id = l.id and ap.tipo = 'BOLETO' and ap.path_storage is not null
       and ap.path_storage is distinct from l.arquivo_boleto_path and ap.path_storage is distinct from l.arquivo_nf_path), '[]'::jsonb);
  end if;

  if m.item_id is not null then
    v_files := v_files || coalesce((select jsonb_agg(jsonb_build_object('id', 'mon-' || ma.asset_id, 'name', coalesce(ma.nome, a2->>'nome', 'arquivo.pdf'), 'url', null, 'local', 'storage:monday-arquivos/' || ma.caminho, 'kind', 'files', 'origin', 'Monday'))
      from jsonb_array_elements(coalesce(m.arquivos, '[]'::jsonb)) a2 join public.monday_arquivos ma on ma.asset_id = a2->>'id'), '[]'::jsonb);
  end if;
  v_files := v_files || coalesce((select jsonb_agg(jsonb_build_object('id', 'anx-' || substr(md5(x.caminho), 1, 8), 'name', coalesce(x.nome, 'arquivo.pdf'), 'url', null, 'local', 'storage:documentos/' || x.caminho, 'kind', 'files', 'origin', 'Painel') order by x.em)
    from public.aprovacoes_anexos x where x.nota_id = p_nota and x.caminho is not null), '[]'::jsonb);

  -- 19/11/2026: arquivo removido da nota no painel ("Remover da nota") não vai para a TAG.
  if jsonb_array_length(coalesce(a.arquivos_ocultos, '[]'::jsonb)) > 0 then
    v_files := coalesce((select jsonb_agg(f) from jsonb_array_elements(v_files) f
      where not exists (select 1 from jsonb_array_elements_text(a.arquivos_ocultos) o
        where o = regexp_replace(coalesce(f->>'local', ''), '^storage:(documentos|monday-arquivos)/', '') or o = 'monday:' || regexp_replace(coalesce(f->>'id', ''), '^mon-', ''))), '[]'::jsonb);
  end if;

  v_doc := jsonb_build_object(
    'id', v_id, 'origemId', p_nota, 'name', v_nome, 'nf', v_nf, 'supplierName', v_forn, 'supplierDoc', v_cnpj, 'supplierId', null,
    'groupId', v_grupo, 'group', v_titulo, 'departmentId', 1, 'department', 'Engenharia Empresa Exemplo',
    'payer', jsonb_build_array(v_tag), 'address', case when coalesce(a.endereco_obra, m.endereco, '') <> '' then jsonb_build_array(coalesce(a.endereco_obra, m.endereco)) else '[]'::jsonb end, 'addressIds', '[]'::jsonb,
    'category', coalesce(a.categoria, m.categoria, ''), 'paymentId', v_pagid, 'payment', v_pag, 'bank', '', 'paymentNotes', '', 'approverNotes', '',
    'otavio', 'Em analise', 'engineering', 'Aprovado', 'status', '', 'value', v_valor, 'narrative', coalesce(a.narrativa, m.narrativa, ''),
    'issueDate', v_emissao, 'dues', jsonb_build_array(v_venc, null, null, null, null, null, null, null, null, null, null, null),
    'files', v_files, 'proofs', '[]'::jsonb, 'createdAt', v_agora, 'updatedAt', v_agora, 'mondayUrl', null);
  -- 16/11/2026 (pedido do Gustavo): nada da Engenharia pode faltar na TAG. Dados bancários do lançamento e o bloco da análise (contrato, pertence à expansão, pedido, histórico).
  v_doc := v_doc || jsonb_build_object(
    'bank', trim(both ' ' from concat_ws(' · ', nullif(v_banco, ''), case when nullif(v_agencia, '') is not null then 'Ag ' || v_agencia end,
            case when nullif(v_conta, '') is not null then 'CC ' || v_conta end, case when nullif(v_pix, '') is not null then 'PIX ' || v_pix end)),
    'engineeringInfo', jsonb_build_object('contrato', coalesce(a.contrato, m.contrato, ''), 'expansao', coalesce(a.expansao, m.expansao, ''),
            'pedido', coalesce(a.pedido, m.pedido, ''), 'contratoNome', coalesce((select c.nome from public.contratos c where c.item_id = a.contrato_ref), ''),
            'narrativa', coalesce(a.narrativa, m.narrativa, ''), 'historico', coalesce(a.historico, '[]'::jsonb)));
  select f into v_prev from jsonb_array_elements(v_files) f where f->>'name' ~* '\.pdf$' limit 1;
  v_leve := jsonb_build_object(
    'id', v_id, 'name', v_nome, 'nf', v_nf, 'supplierName', v_forn, 'supplierDoc', v_cnpj, 'groupId', v_grupo, 'group', v_titulo,
    'departmentId', 1, 'department', 'Engenharia Empresa Exemplo', 'payer', jsonb_build_array(v_tag), 'address', v_doc->'address',
    'category', v_doc->>'category', 'payment', v_pag, 'paymentId', v_pagid, 'value', v_valor, 'narrative', v_doc->>'narrative',
    'issueDate', v_emissao, 'dueDate', v_venc, 'otavio', 'Em analise', 'status', '', 'filesCount', jsonb_array_length(v_files), 'proofsCount', 0,
    'preview', v_prev, 'createdAt', v_agora, 'updatedAt', v_agora);

  insert into public.tag_notas (id, doc, leve, grupo_id, origem_id) values (v_id, v_doc, v_leve, v_grupo, p_nota);
  insert into public.tag_eventos (em, ator, tipo, item_id, doc) values
    (now(), eu.email, 'created', v_id, jsonb_build_object('type', 'created', 'itemId', v_id, 'detail', v_nf || ' · ' || v_forn, 'origin', 'Engenharia (Pagador Tag)', 'actor', eu.email, 'at', v_agora)),
    (now(), eu.email, 'automation_run', v_id, jsonb_build_object('type', 'automation_run', 'itemId', v_id, 'automationId', '7917895475', 'detail', 'Ao criar item: nomear e definir pagador', 'steps', 2, 'actor', eu.email, 'at', v_agora));

  -- Na Engenharia a nota passa a "Encaminhada", com o registro de quem enviou.
  v_linha := 'Enviada ao painel da TAG (pendente de aprovação do Otávio) · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, historico, por_email, por_nome) values (p_nota, 'encaminhada', jsonb_build_array(v_linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = 'encaminhada', historico = public.aprovacoes_notas.historico || jsonb_build_array(v_linha),
       versao = public.aprovacoes_notas.versao + 1, por_email = excluded.por_email, por_nome = excluded.por_nome, atualizado_em = now();
  return v_id;
end $function$;

-- ===== Gatilhos (15)
CREATE TRIGGER aprovacoes_completar BEFORE INSERT OR UPDATE ON public.aprovacoes_notas FOR EACH ROW EXECUTE FUNCTION aprovacoes_completar_campos();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.arquivos_processados FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER contratos_nao_recriar BEFORE INSERT ON public.contratos FOR EACH ROW EXECUTE FUNCTION bloquear_recriar_excluido('contrato');
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.exclusoes_recentes FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.historico_status FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER lancamentos_juntar_copia_monday AFTER INSERT OR UPDATE OF status ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION lancamento_juntar_copia_monday();
CREATE TRIGGER lancamentos_remessa_escrituracao AFTER INSERT OR UPDATE OF status, natureza ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION remessa_direto_escrituracao();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER trg_atualizado_em BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_audit_lancamento AFTER UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION fn_audit_lancamento();
CREATE TRIGGER tag_automacoes_avisa AFTER INSERT OR DELETE OR UPDATE ON public.tag_automacoes FOR EACH STATEMENT EXECUTE FUNCTION tag_avisar_mudanca();
CREATE TRIGGER tag_eventos_avisa AFTER INSERT OR DELETE OR UPDATE ON public.tag_eventos FOR EACH STATEMENT EXECUTE FUNCTION tag_avisar_mudanca();
CREATE TRIGGER tag_meta_avisa AFTER INSERT OR DELETE OR UPDATE ON public.tag_meta FOR EACH STATEMENT EXECUTE FUNCTION tag_avisar_mudanca();
CREATE TRIGGER tag_notas_avisa AFTER INSERT OR DELETE OR UPDATE ON public.tag_notas FOR EACH STATEMENT EXECUTE FUNCTION tag_avisar_mudanca();
CREATE TRIGGER tag_outbox_avisa AFTER INSERT OR DELETE OR UPDATE ON public.tag_outbox FOR EACH STATEMENT EXECUTE FUNCTION tag_avisar_mudanca();
