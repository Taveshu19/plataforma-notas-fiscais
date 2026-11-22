-- Planta do banco expansao — gerada em 2026-11-20 (somente estrutura, sem dados).
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
  decisao text,
  aguarda_reenvio boolean not null default false,
  campos jsonb not null default '{}'::jsonb,
  data_envio date,
  arquivos_ocultos jsonb not null default '[]'::jsonb
);
alter table public.aprovacoes_notas add constraint aprovacoes_notas_contrato_check CHECK (((contrato IS NULL) OR (contrato = ANY (ARRAY['Sim'::text, 'Não'::text]))));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_etapa_check CHECK ((etapa = ANY (ARRAY['engenharia'::text, 'contrato'::text, 'pedido'::text, 'aprovacao'::text, 'escrituracao'::text, 'fora'::text, 'devolvida'::text, 'encaminhada'::text, 'fiscal'::text, 'cancelada'::text, 'arquivada'::text, 'removida'::text])));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_expansao_check CHECK (((expansao IS NULL) OR (expansao = ANY (ARRAY['Sim'::text, 'Não'::text]))));
alter table public.aprovacoes_notas add constraint aprovacoes_notas_pkey PRIMARY KEY (nota_id);
alter table public.aprovacoes_notas enable row level security;
comment on table public.aprovacoes_notas is 'Análise da engenharia (narrativa, contrato, pertence à expansão) feita no painel. Não vai para a Monday durante a validação.';

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

create table public.atividades_itens (
  item_id text not null,
  grupo_id text,
  grupo_nome text,
  ordem integer,
  nome text,
  estado text,
  valores jsonb not null default '{}'::jsonb,
  subitens jsonb not null default '[]'::jsonb,
  criado_monday timestamp with time zone,
  atualizado_monday timestamp with time zone,
  espelhado_em timestamp with time zone not null default now(),
  origem text not null default 'monday'::text,
  alterado_por text,
  alterado_em timestamp with time zone
);
alter table public.atividades_itens add constraint atividades_itens_pkey PRIMARY KEY (item_id);
alter table public.atividades_itens enable row level security;

create table public.atividades_quadro (
  id integer not null default 1,
  board_id text,
  nome text,
  colunas jsonb not null default '[]'::jsonb,
  grupos jsonb not null default '[]'::jsonb,
  sub_colunas jsonb not null default '[]'::jsonb,
  espelhado_em timestamp with time zone
);
alter table public.atividades_quadro add constraint projetos_quadro_id_check CHECK ((id = 1));
alter table public.atividades_quadro add constraint atividades_quadro_pkey1 PRIMARY KEY (id);
alter table public.atividades_quadro enable row level security;

create table public.atividades_quadro_copia_20261114 (
  id integer not null,
  dados jsonb not null,
  importado_em timestamp with time zone not null default now()
);
alter table public.atividades_quadro_copia_20261114 add constraint atividades_quadro_id_check CHECK ((id = 1));
alter table public.atividades_quadro_copia_20261114 add constraint atividades_quadro_pkey PRIMARY KEY (id);
alter table public.atividades_quadro_copia_20261114 enable row level security;

create table public.compras_anexos (
  id uuid not null default gen_random_uuid(),
  requisicao_id uuid not null,
  tipo text not null,
  nome text not null,
  caminho text not null,
  por_email text,
  por_nome text,
  em timestamp with time zone not null default now()
);
alter table public.compras_anexos add constraint compras_anexos_tipo_check CHECK ((tipo = ANY (ARRAY['rm'::text, 'propostas'::text, 'certificados'::text])));
alter table public.compras_anexos add constraint compras_anexos_requisicao_id_fkey FOREIGN KEY (requisicao_id) REFERENCES compras_requisicoes(id) ON DELETE CASCADE;
alter table public.compras_anexos add constraint compras_anexos_pkey PRIMARY KEY (id);
alter table public.compras_anexos add constraint compras_anexos_caminho_key UNIQUE (caminho);
alter table public.compras_anexos enable row level security;

create table public.compras_avisos (
  id bigint not null default nextval('compras_avisos_id_seq'::regclass),
  requisicao_id uuid not null,
  tipo text not null,
  assunto text not null,
  corpo text not null,
  responder_para text,
  para text,
  criado_em timestamp with time zone not null default now(),
  enviado_em timestamp with time zone,
  erro text
);
alter table public.compras_avisos add constraint compras_avisos_tipo_check CHECK ((tipo = ANY (ARRAY['abertura'::text, 'aprovacao'::text, 'ajuste'::text, 'recusa'::text])));
alter table public.compras_avisos add constraint compras_avisos_requisicao_id_fkey FOREIGN KEY (requisicao_id) REFERENCES compras_requisicoes(id) ON DELETE CASCADE;
alter table public.compras_avisos add constraint compras_avisos_pkey PRIMARY KEY (id);
alter table public.compras_avisos enable row level security;

create table public.compras_config (
  chave text not null,
  valor text not null
);
alter table public.compras_config add constraint compras_config_pkey PRIMARY KEY (chave);
alter table public.compras_config enable row level security;

create table public.compras_historico (
  id bigint not null default nextval('compras_historico_id_seq'::regclass),
  requisicao_id uuid not null,
  texto text not null,
  por_email text,
  por_nome text,
  em timestamp with time zone not null default now(),
  chave text
);
alter table public.compras_historico add constraint compras_historico_requisicao_id_fkey FOREIGN KEY (requisicao_id) REFERENCES compras_requisicoes(id) ON DELETE CASCADE;
alter table public.compras_historico add constraint compras_historico_pkey PRIMARY KEY (id);
alter table public.compras_historico add constraint compras_historico_chave_unica UNIQUE (chave);
alter table public.compras_historico enable row level security;

create table public.compras_requisicoes (
  id uuid not null default gen_random_uuid(),
  numero text not null default ('RM-'::text || lpad((nextval('compras_rm_seq'::regclass))::text, 4, '0'::text)),
  nome text not null,
  descricao text,
  unidade text,
  tipo text not null,
  prioridade text not null,
  sla_dias integer not null,
  prazo_desejado date,
  etapa text not null default 'Aguardando Compras'::text,
  comprador text,
  terceiros text not null default 'Não solicitada'::text,
  motivo_recusa text,
  solicitante_email text not null,
  solicitante_nome text,
  criada_em timestamp with time zone not null default now(),
  atualizada_em timestamp with time zone not null default now(),
  fechada_em timestamp with time zone,
  data_entrega date,
  origem text not null default 'painel'::text,
  monday_req_id text,
  monday_cot_id text,
  monday_grupo text,
  monday_dados jsonb
);
alter table public.compras_requisicoes add constraint compras_requisicoes_etapa_check CHECK ((etapa = ANY (ARRAY['Aguardando Compras'::text, 'Em cotação'::text, 'Aguardando Engenharia'::text, 'Aguardando fechamento'::text, 'Aguardando entrega'::text, 'Entrega concluída'::text, 'Recusada'::text])));
alter table public.compras_requisicoes add constraint compras_requisicoes_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0));
alter table public.compras_requisicoes add constraint compras_requisicoes_prioridade_check CHECK ((prioridade = ANY (ARRAY['Padrão'::text, 'Urgente'::text])));
alter table public.compras_requisicoes add constraint compras_requisicoes_tipo_check CHECK ((tipo = ANY (ARRAY['Material'::text, 'Serviço'::text, 'Equipamento'::text])));
alter table public.compras_requisicoes add constraint compras_requisicoes_pkey PRIMARY KEY (id);
alter table public.compras_requisicoes add constraint compras_requisicoes_numero_key UNIQUE (numero);
CREATE UNIQUE INDEX compras_req_monday_req_uq ON public.compras_requisicoes USING btree (monday_req_id) WHERE (monday_req_id IS NOT NULL);
alter table public.compras_requisicoes enable row level security;

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
  criado_em timestamp with time zone
);
alter table public.contratos add constraint contratos_pkey PRIMARY KEY (item_id);
CREATE INDEX contratos_arquivos_itens_gin ON public.contratos USING gin (arquivos_itens jsonb_path_ops);
CREATE INDEX contratos_subitens_gin ON public.contratos USING gin (subitens jsonb_path_ops);
alter table public.contratos enable row level security;
comment on table public.contratos is 'Cópia somente leitura do quadro Contratos da Monday (18380887328).';

create table public.controle_fornecedores (
  nome text not null,
  posicao integer not null default 0,
  criado_em timestamp with time zone not null default now(),
  criado_por text
);
alter table public.controle_fornecedores add constraint controle_fornecedores_pkey PRIMARY KEY (nome);
alter table public.controle_fornecedores enable row level security;

create table public.controle_lancamentos (
  id text not null default ('C-'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)),
  pedido text not null default ''::text,
  fornecedor text,
  emissao date,
  vencimento date,
  instalacao text,
  nota text,
  texto text,
  etapa text not null default 'Aguardando aprovação'::text,
  posicao double precision not null default 0,
  origem text not null default 'painel'::text,
  monday_id text,
  criado_em timestamp with time zone not null default now(),
  criado_por text,
  atualizado_em timestamp with time zone not null default now(),
  atualizado_por text,
  movido_em timestamp with time zone
);
alter table public.controle_lancamentos add constraint controle_lancamentos_etapa_check CHECK ((etapa = ANY (ARRAY['Aguardando aprovação'::text, 'Aprovado - a enviar'::text, 'Enviado'::text])));
alter table public.controle_lancamentos add constraint controle_lancamentos_origem_check CHECK ((origem = ANY (ARRAY['painel'::text, 'monday'::text])));
alter table public.controle_lancamentos add constraint controle_lancamentos_pkey PRIMARY KEY (id);
alter table public.controle_lancamentos add constraint controle_lancamentos_monday_id_key UNIQUE (monday_id);
CREATE INDEX controle_lancamentos_etapa ON public.controle_lancamentos USING btree (etapa, posicao);
alter table public.controle_lancamentos enable row level security;

create table public.controle_lancamentos_comentarios (
  id bigint not null default nextval('controle_lancamentos_comentarios_id_seq'::regclass),
  item_id text not null,
  em timestamp with time zone not null default now(),
  autor text,
  autor_email text,
  texto text not null,
  origem text not null default 'painel'::text,
  monday_id text
);
alter table public.controle_lancamentos_comentarios add constraint controle_lancamentos_comentarios_texto_check CHECK ((length(TRIM(BOTH FROM texto)) > 0));
alter table public.controle_lancamentos_comentarios add constraint controle_lancamentos_comentarios_item_id_fkey FOREIGN KEY (item_id) REFERENCES controle_lancamentos(id) ON DELETE CASCADE;
alter table public.controle_lancamentos_comentarios add constraint controle_lancamentos_comentarios_pkey PRIMARY KEY (id);
alter table public.controle_lancamentos_comentarios add constraint controle_lancamentos_comentarios_monday_id_key UNIQUE (monday_id);
CREATE INDEX controle_comentarios_item ON public.controle_lancamentos_comentarios USING btree (item_id, em);
alter table public.controle_lancamentos_comentarios enable row level security;

create table public.controle_lancamentos_eventos (
  id bigint not null default nextval('controle_lancamentos_eventos_id_seq'::regclass),
  item_id text,
  pedido text,
  em timestamp with time zone not null default now(),
  ator text,
  tipo text not null,
  campo text,
  antes text,
  depois text,
  origem text not null default 'painel'::text,
  monday_id text,
  instantaneo jsonb
);
alter table public.controle_lancamentos_eventos add constraint controle_lancamentos_eventos_pkey PRIMARY KEY (id);
alter table public.controle_lancamentos_eventos add constraint controle_lancamentos_eventos_monday_id_key UNIQUE (monday_id);
CREATE INDEX controle_eventos_item ON public.controle_lancamentos_eventos USING btree (item_id, em DESC);
CREATE INDEX controle_eventos_em ON public.controle_lancamentos_eventos USING btree (em DESC);
alter table public.controle_lancamentos_eventos enable row level security;

create table public.datasul_fornecedores (
  cnpj text not null,
  codigo text not null,
  nome text,
  atualizado_em timestamp with time zone not null default now()
);
alter table public.datasul_fornecedores add constraint datasul_fornecedores_pkey PRIMARY KEY (cnpj, codigo);
alter table public.datasul_fornecedores enable row level security;

create table public.datasul_itens (
  codigo text not null,
  descricao text,
  situacao text,
  conta_contabil text,
  tipo_despesa text,
  atualizado_em timestamp with time zone not null default now(),
  un text,
  familia text,
  grupo_estoque text
);
alter table public.datasul_itens add constraint datasul_itens_pkey PRIMARY KEY (codigo);
alter table public.datasul_itens enable row level security;

create table public.engenharia_vinculos (
  nota_id text not null,
  nota_de text,
  cartao_de text,
  por_email text not null,
  por_nome text,
  em timestamp with time zone not null default now()
);
alter table public.engenharia_vinculos add constraint engenharia_vinculos_pkey PRIMARY KEY (nota_id);
alter table public.engenharia_vinculos enable row level security;

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
comment on table public.exclusoes_foto is 'Foto de cada linha apagada (o que o Gemini disse do arquivo), pra medir se ele reconhece lixo. Só insert+select.';

create table public.exclusoes_recentes (
  id uuid not null default gen_random_uuid(),
  hash_arquivo text not null,
  nome_arquivo text,
  excluido_por text,
  excluido_em timestamp with time zone not null default now(),
  lancamento_id text
);
alter table public.exclusoes_recentes add constraint exclusoes_recentes_pkey PRIMARY KEY (id);
CREATE INDEX idx_exclusoes_recentes_hash ON public.exclusoes_recentes USING btree (hash_arquivo);
CREATE INDEX idx_exclusoes_recentes_data ON public.exclusoes_recentes USING btree (excluido_em);
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
comment on table public.fila_email_escrituracao is 'Notas de Pinhal/Remessa clicadas em Enviar, esperando o Enviar lote (um e-mail por unidade). So a funcao notificar-escrituracao usa. 11/11/2026.';

create table public.fiscais_unidade (
  unidade text not null,
  email_fiscal text,
  emails_cc ARRAY default '{}'::text[],
  ativo boolean default true
);
alter table public.fiscais_unidade add constraint fiscais_unidade_pkey PRIMARY KEY (unidade);
alter table public.fiscais_unidade enable row level security;
comment on table public.fiscais_unidade is 'Mapeamento Unidade -> email do fiscal, usado pela automação semanal de envio de NFs para escrituração';

create table public.furos (
  id bigint not null default nextval('furos_id_seq'::regclass),
  detectado_em timestamp with time zone not null default now(),
  documento text not null,
  remetente text,
  assunto text,
  recebido_em text,
  etapa text not null,
  situacao text not null,
  estado text not null default 'aberto'::text,
  resolvido_por text,
  resolvido_em timestamp with time zone
);
alter table public.furos add constraint furos_estado_check CHECK ((estado = ANY (ARRAY['aberto'::text, 'resolvido'::text, 'escalado'::text])));
alter table public.furos add constraint furos_etapa_check CHECK ((etapa = ANY (ARRAY['email'::text, 'pasta'::text, 'ledger'::text, 'lancamento'::text, 'monday'::text, 'vigia'::text])));
alter table public.furos add constraint furos_pkey PRIMARY KEY (id);
alter table public.furos add constraint furos_documento_recebido UNIQUE (documento, recebido_em);
CREATE INDEX furos_estado ON public.furos USING btree (estado, detectado_em DESC);
alter table public.furos enable row level security;

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

create table public.historico_sugestoes (
  id bigint not null,
  campo text not null,
  chave text not null,
  valor text not null,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);
alter table public.historico_sugestoes add constraint historico_sugestoes_campo_check CHECK ((campo = ANY (ARRAY['fornecedor'::text, 'unidade'::text])));
alter table public.historico_sugestoes add constraint historico_sugestoes_pkey PRIMARY KEY (id);
alter table public.historico_sugestoes add constraint historico_sugestoes_campo_chave_key UNIQUE (campo, chave);
alter table public.historico_sugestoes enable row level security;

create table public.itens_escolhidos (
  id uuid not null default gen_random_uuid(),
  board_id text not null,
  descricao_nota text not null,
  descricao_normalizada text not null,
  item_codigo text not null,
  fornecedor_codigo text not null,
  monday_item_id text not null,
  escolhido_por text not null,
  escolhido_em timestamp with time zone not null default now()
);
alter table public.itens_escolhidos add constraint itens_escolhidos_item_codigo_fkey FOREIGN KEY (item_codigo) REFERENCES datasul_itens(codigo);
alter table public.itens_escolhidos add constraint itens_escolhidos_pkey PRIMARY KEY (id);
CREATE INDEX itens_escolhidos_busca ON public.itens_escolhidos USING btree (board_id, fornecedor_codigo, descricao_normalizada, escolhido_em DESC);
alter table public.itens_escolhidos enable row level security;

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
  telefone_fornecedor text,
  email_fornecedor text,
  cobranca_em timestamp with time zone,
  cobranca_por text,
  cobranca_canal text
);
alter table public.lancamentos add constraint lancamentos_cobranca_canal_check CHECK ((cobranca_canal = ANY (ARRAY['whatsapp'::text, 'email'::text, 'ligacao'::text])));
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

create table public.monday_compras_espelho (
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
alter table public.monday_compras_espelho add constraint monday_compras_espelho_pkey PRIMARY KEY (item_id);
CREATE INDEX monday_compras_espelho_board ON public.monday_compras_espelho USING btree (board_id, grupo_id);
alter table public.monday_compras_espelho enable row level security;

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
  arquivos jsonb not null default '[]'::jsonb
);
alter table public.monday_espelho add constraint monday_espelho_pkey PRIMARY KEY (item_id);
CREATE INDEX monday_espelho_etapa ON public.monday_espelho USING btree (etapa);
CREATE INDEX monday_espelho_lancamento ON public.monday_espelho USING btree (lancamento_id);
CREATE INDEX monday_espelho_arquivos_gin ON public.monday_espelho USING gin (arquivos jsonb_path_ops);
alter table public.monday_espelho enable row level security;
comment on table public.monday_espelho is 'Estado atual de cada item dos quadros Aprovações e Notas, lido da Monday. Só leitura; a Monday continua sendo a referência no período de validação.';

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
CREATE INDEX monday_espelho_eventos_item ON public.monday_espelho_eventos USING btree (item_id, quando DESC);
CREATE INDEX monday_espelho_eventos_painel ON public.monday_espelho_eventos USING btree (id) INCLUDE (item_id, quando, descricao) WHERE (tipo = ANY (ARRAY['create_pulse'::text, 'move_pulse_from_group'::text, 'move_pulse_from_board'::text, 'delete_pulse'::text, 'archive_pulse'::text]));
alter table public.monday_espelho_eventos enable row level security;

create table public.notas_link (
  id uuid not null default gen_random_uuid(),
  tipo text not null,
  numero_nota text,
  codigo_verificacao text,
  cnpj_fornecedor text,
  fornecedor text,
  valor numeric,
  link text not null,
  remetente text,
  criado_em timestamp with time zone not null default now(),
  tratado boolean not null default false,
  lancamento_id text
);
alter table public.notas_link add constraint notas_link_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES lancamentos(id);
alter table public.notas_link add constraint notas_link_pkey PRIMARY KEY (id);
alter table public.notas_link enable row level security;

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
alter table public.painel_perfis add constraint painel_perfis_equipe_check CHECK ((equipe = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text, 'compras'::text])));
alter table public.painel_perfis add constraint painel_perfis_pkey PRIMARY KEY (email);
alter table public.painel_perfis enable row level security;
comment on table public.painel_perfis is 'Equipe de cada login do painel. Escolhida pela pessoa no primeiro acesso (Expansão, Administrativo ou Compras); admin só por SQL.';

create table public.pedidos_gerados (
  id uuid not null default gen_random_uuid(),
  lote_id uuid not null,
  board_id text not null,
  monday_item_id text not null,
  documento text not null,
  cnpj text,
  unidade text,
  natureza text,
  valor numeric,
  arquivo_nome text not null,
  linhas_csv text not null,
  ordem_lote integer not null,
  status text not null default 'gerado'::text,
  gerado_em timestamp with time zone not null default now(),
  importado_em timestamp with time zone,
  numero_reservado text not null,
  pedido_numero text,
  erro text,
  gerado_por text not null,
  confirmado_por text,
  evidencia text,
  monday_sincronizado_em timestamp with time zone,
  entregue_em timestamp with time zone,
  entregue_por text
);
alter table public.pedidos_gerados add constraint pedidos_gerados_status_check CHECK ((status = ANY (ARRAY['gerado'::text, 'importado'::text, 'erro'::text, 'cancelado'::text])));
alter table public.pedidos_gerados add constraint pedidos_gerados_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX pedidos_nota_ativa ON public.pedidos_gerados USING btree (board_id, monday_item_id) WHERE (status <> 'cancelado'::text);
CREATE UNIQUE INDEX pedidos_numero_ativo ON public.pedidos_gerados USING btree (numero_reservado) WHERE (status <> 'cancelado'::text);
CREATE INDEX pedidos_gerados_pendentes_entrega ON public.pedidos_gerados USING btree (gerado_em) WHERE ((status = 'gerado'::text) AND (entregue_em IS NULL));
alter table public.pedidos_gerados enable row level security;

create table public.portfolio_projetos_local (
  item_id text not null,
  grupo_id text not null,
  nome text not null,
  valores jsonb not null default '{}'::jsonb,
  versao integer not null default 1,
  por_email text not null,
  atualizado_em timestamp with time zone not null default now()
);
alter table public.portfolio_projetos_local add constraint portfolio_projetos_local_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0));
alter table public.portfolio_projetos_local add constraint portfolio_projetos_local_valores_check CHECK ((jsonb_typeof(valores) = 'object'::text));
alter table public.portfolio_projetos_local add constraint portfolio_projetos_local_pkey PRIMARY KEY (item_id);
alter table public.portfolio_projetos_local enable row level security;

create table public.projetos_acesso (
  email text not null
);
alter table public.projetos_acesso add constraint projetos_acesso_email_check CHECK ((email = lower(email)));
alter table public.projetos_acesso add constraint projetos_acesso_pkey PRIMARY KEY (email);
alter table public.projetos_acesso enable row level security;
comment on table public.projetos_acesso is 'Quem pode ver o Quadro de Projetos e o Portfólio de Projetos no painel. Só o Marcos (12/11/2026). Para incluir alguém: insert por SQL.';

create table public.projetos_itens (
  item_id text not null,
  grupo_id text,
  grupo_nome text,
  ordem integer,
  nome text,
  estado text,
  valores jsonb not null default '{}'::jsonb,
  subitens jsonb not null default '[]'::jsonb,
  criado_monday timestamp with time zone,
  atualizado_monday timestamp with time zone,
  espelhado_em timestamp with time zone not null default now(),
  origem text not null default 'monday'::text,
  alterado_por text,
  alterado_em timestamp with time zone
);
alter table public.projetos_itens add constraint projetos_itens_pkey PRIMARY KEY (item_id);
alter table public.projetos_itens enable row level security;
comment on table public.projetos_itens is 'Cópia somente leitura dos itens do quadro Portifólio de Projetos da Monday (18397974281).';

create table public.projetos_quadro (
  id integer not null default 1,
  board_id text,
  nome text,
  colunas jsonb not null default '[]'::jsonb,
  grupos jsonb not null default '[]'::jsonb,
  sub_colunas jsonb not null default '[]'::jsonb,
  espelhado_em timestamp with time zone
);
alter table public.projetos_quadro add constraint projetos_quadro_id_check CHECK ((id = 1));
alter table public.projetos_quadro add constraint projetos_quadro_pkey PRIMARY KEY (id);
alter table public.projetos_quadro enable row level security;

create table public.pulso (
  id bigint not null default nextval('pulso_id_seq'::regclass),
  criado_em timestamp with time zone not null default now(),
  modo text not null,
  arquivos_pasta integer,
  arquivos_ledger integer,
  lancamentos integer,
  sincronizados_monday integer,
  erro text,
  pendentes integer,
  em_lancamento integer,
  enviados integer
);
alter table public.pulso add constraint pulso_modo_check CHECK ((modo = ANY (ARRAY['batida'::text, 'conferencia'::text])));
alter table public.pulso add constraint pulso_pkey PRIMARY KEY (id);
CREATE INDEX pulso_criado_em_desc ON public.pulso USING btree (criado_em DESC);
alter table public.pulso enable row level security;

create table public.senha_recuperacoes (
  id bigint not null default nextval('senha_recuperacoes_id_seq'::regclass),
  email text not null,
  em timestamp with time zone not null default now(),
  enviado boolean not null default false
);
alter table public.senha_recuperacoes add constraint senha_recuperacoes_pkey PRIMARY KEY (id);
CREATE INDEX senha_recuperacoes_email_em ON public.senha_recuperacoes USING btree (email, em DESC);
alter table public.senha_recuperacoes enable row level security;
comment on table public.senha_recuperacoes is 'Pedidos de \"Esqueci minha senha\" do painel (14/11/2026). Gravado só pela função recuperar-senha.';

create table public.sombra_envio (
  lancamento_id text not null,
  foto jsonb not null,
  foto_em timestamp with time zone not null default now(),
  app_build text
);
alter table public.sombra_envio add constraint sombra_envio_pkey PRIMARY KEY (lancamento_id);
alter table public.sombra_envio enable row level security;

-- ===== Visões
create or replace view public.portfolio_projetos_efetivos as
 SELECT p.item_id,
    COALESCE(l.grupo_id, p.grupo_id) AS grupo_id,
    p.grupo_nome,
    p.ordem,
    COALESCE(l.nome, p.nome) AS nome,
    p.estado,
    (p.valores || COALESCE(l.valores, '{}'::jsonb)) AS valores,
    p.subitens,
    p.espelhado_em,
    COALESCE(l.versao, 0) AS versao
   FROM (projetos_itens p
     LEFT JOIN portfolio_projetos_local l USING (item_id))
UNION ALL
 SELECT l.item_id,
    l.grupo_id,
    NULL::text AS grupo_nome,
    2147483647 AS ordem,
    l.nome,
    'active'::text AS estado,
    l.valores,
    '[]'::jsonb AS subitens,
    l.atualizado_em AS espelhado_em,
    l.versao
   FROM portfolio_projetos_local l
  WHERE (NOT (EXISTS ( SELECT 1
           FROM projetos_itens p
          WHERE (p.item_id = l.item_id))));

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
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_insert" on public.arquivos_processados for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.arquivos_processados for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_update" on public.arquivos_processados for UPDATE to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text))
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
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
create policy "authenticated_select" on public.assistente_desfazer for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
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
create policy "atividades_itens_ler" on public.atividades_itens for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "atividades_quadro_ler" on public.atividades_quadro for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "atividades_ler" on public.atividades_quadro_copia_20261114 for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "atividades_quadro_ler" on public.atividades_quadro_copia_20261114 for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "compras_anexo_ler" on public.compras_anexos for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE ((r.id = compras_anexos.requisicao_id) AND compras_pode_ver(r.solicitante_email)))));
create policy "compras_aviso_ler" on public.compras_avisos for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE ((r.id = compras_avisos.requisicao_id) AND compras_pode_ver(r.solicitante_email)))));
create policy "compras_hist_ler" on public.compras_historico for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE ((r.id = compras_historico.requisicao_id) AND compras_pode_ver(r.solicitante_email)))));
create policy "compras_req_ler" on public.compras_requisicoes for SELECT to authenticated
  using (compras_pode_ver(solicitante_email));
create policy "contratos_ler" on public.contratos for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text])));
create policy "controle_forn_criar" on public.controle_fornecedores for INSERT to authenticated
  with check (controle_pode());
create policy "controle_forn_ler" on public.controle_fornecedores for SELECT to authenticated
  using (controle_pode());
create policy "controle_alterar" on public.controle_lancamentos for UPDATE to authenticated
  using (controle_pode())
  with check (controle_pode());
create policy "controle_criar" on public.controle_lancamentos for INSERT to authenticated
  with check (controle_pode());
create policy "controle_excluir" on public.controle_lancamentos for DELETE to authenticated
  using (controle_pode());
create policy "controle_ler" on public.controle_lancamentos for SELECT to authenticated
  using (controle_pode());
create policy "controle_coment_criar" on public.controle_lancamentos_comentarios for INSERT to authenticated
  with check (controle_pode());
create policy "controle_coment_excluir" on public.controle_lancamentos_comentarios for DELETE to authenticated
  using ((controle_pode() AND (autor_email = controle_quem())));
create policy "controle_coment_ler" on public.controle_lancamentos_comentarios for SELECT to authenticated
  using (controle_pode());
create policy "controle_eventos_ler" on public.controle_lancamentos_eventos for SELECT to authenticated
  using (controle_pode());
create policy "assistente_select" on public.datasul_fornecedores for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_select" on public.datasul_itens for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "vinculo_alterar" on public.engenharia_vinculos for UPDATE to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['expansao'::text, 'admin'::text])))
  with check (((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['expansao'::text, 'admin'::text])) AND (por_email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));
create policy "vinculo_incluir" on public.engenharia_vinculos for INSERT to authenticated
  with check (((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['expansao'::text, 'admin'::text])) AND (por_email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));
create policy "vinculo_ler" on public.engenharia_vinculos for SELECT to authenticated
  using ((( SELECT painel_equipe() AS painel_equipe) = ANY (ARRAY['expansao'::text, 'admin'::text])));
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
create policy "assistente_select" on public.fiscais_unidade for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_select" on public.furos for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "equipe_painel_restrita" on public.furos for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "furos_leitura" on public.furos for SELECT to authenticated
  using (true);
create policy "furos_marcar" on public.furos for UPDATE to authenticated
  using (true)
  with check ((estado = ANY (ARRAY['aberto'::text, 'resolvido'::text, 'escalado'::text])));
create policy "assistente_insert" on public.historico_status for INSERT to assistente_escrita
  with check (true);
create policy "assistente_select" on public.historico_status for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_delete" on public.historico_status for DELETE to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_insert" on public.historico_status for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.historico_status for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.historico_status for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "assistente_select" on public.historico_sugestoes for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_select" on public.itens_escolhidos for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_insert" on public.lancamentos for INSERT to assistente_escrita
  with check (true);
create policy "assistente_select" on public.lancamentos for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "assistente_update" on public.lancamentos for UPDATE to assistente_escrita
  using (true)
  with check (true);
create policy "authenticated_delete" on public.lancamentos for DELETE to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_insert" on public.lancamentos for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.lancamentos for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_update" on public.lancamentos for UPDATE to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text))
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
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
create policy "assistente_select" on public.notas_link for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "compras_arquivos_apagar" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'compras'::text) AND (NOT (EXISTS ( SELECT 1
   FROM compras_anexos a
  WHERE (a.caminho = objects.name)))) AND (EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND compras_pode_ver(r.solicitante_email))))));
create policy "compras_arquivos_ler" on storage.objects for SELECT to authenticated
  using (((bucket_id = 'compras'::text) AND (EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND compras_pode_ver(r.solicitante_email))))));
create policy "compras_arquivos_subir" on storage.objects for INSERT to authenticated
  with check (((bucket_id = 'compras'::text) AND (EXISTS ( SELECT 1
   FROM compras_requisicoes r
  WHERE (((r.id)::text = split_part(objects.name, '/'::text, 1)) AND compras_pode_ver(r.solicitante_email))))));
create policy "contratos_arquivos_apagar" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'contratos'::text) AND contratos_pode_editar()));
create policy "contratos_arquivos_enviar" on storage.objects for INSERT to authenticated
  with check (((bucket_id = 'contratos'::text) AND contratos_pode_criar()));
create policy "contratos_arquivos_ler" on storage.objects for SELECT to authenticated
  using (((bucket_id = 'contratos'::text) AND (COALESCE(painel_equipe(), ''::text) = ANY (ARRAY['admin'::text, 'administrativo'::text, 'expansao'::text]))));
create policy "equipe le documentos" on storage.objects for SELECT to authenticated
  using (((bucket_id = 'documentos'::text) AND (COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text)));
create policy "equipe remove anexos painel" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'documentos'::text) AND (name ~~ 'anexos/%'::text)));
create policy "equipe sobe documentos" on storage.objects for INSERT to authenticated
  with check (((bucket_id = 'documentos'::text) AND (COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text)));
create policy "equipe_painel_ler_documentos" on storage.objects for SELECT to authenticated
  using (((bucket_id <> 'documentos'::text) OR ( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento) OR ((( SELECT painel_equipe() AS painel_equipe) = 'expansao'::text) AND (EXISTS ( SELECT 1
   FROM lancamentos l
  WHERE ((l.status = 'Enviado'::text) AND (((objects.name = l.arquivo_nf_path) OR (objects.name = l.arquivo_boleto_path)) OR (objects.name = l.comprovante_path))))))));
create policy "equipe_painel_subir_documentos" on storage.objects for INSERT to authenticated
  with check (((bucket_id <> 'documentos'::text) OR ( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento)));
create policy "perfil_escolher" on public.painel_perfis for INSERT to authenticated
  with check (((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (equipe = ANY (ARRAY['administrativo'::text, 'expansao'::text, 'compras'::text]))));
create policy "perfil_ler" on public.painel_perfis for SELECT to authenticated
  using (((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) OR (( SELECT painel_equipe() AS painel_equipe) = 'admin'::text)));
create policy "assistente_select" on public.pedidos_gerados for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "portfolio_local_ler" on public.portfolio_projetos_local for SELECT to authenticated
  using ((( SELECT painel_projetos_pode() AS painel_projetos_pode) OR ( SELECT painel_portfolio_pode() AS painel_portfolio_pode)));
create policy "projetos_itens_ler" on public.projetos_itens for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "projetos_quadro_ler" on public.projetos_quadro for SELECT to authenticated
  using (( SELECT painel_projetos_pode() AS painel_projetos_pode));
create policy "assistente_select" on public.pulso for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "equipe_painel_restrita" on public.pulso for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));
create policy "pulso_leitura" on public.pulso for SELECT to authenticated
  using (true);
create policy "assistente_select" on public.sombra_envio for SELECT to assistente_escrita,assistente_leitura
  using (true);
create policy "authenticated_insert" on public.sombra_envio for INSERT to authenticated
  with check ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "authenticated_select" on public.sombra_envio for SELECT to authenticated
  using ((COALESCE((auth.jwt() ->> 'email'::text), ''::text) <> 'teste@painel.local'::text));
create policy "equipe_painel_restrita" on public.sombra_envio for ALL to authenticated
  using (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento))
  with check (( SELECT painel_acesso_lancamento() AS painel_acesso_lancamento));

-- ===== Funções (62)
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
  if eu.equipe is null or eu.equipe not in ('expansao','admin') then raise exception 'Só a engenharia aprova a análise.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff <> 'engenharia' then raise exception 'Esta nota já avançou e não está mais na engenharia.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota;
  if r.nota_id is null or r.narrativa is null or r.contrato is null or r.expansao is null then raise exception 'Preencha Narrativa, Contrato e Pertence à expansão antes de aprovar.'; end if;
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
  if eu.equipe is null or eu.equipe not in ('expansao','admin') then raise exception 'Devolver ao lançamento é da engenharia.'; end if;
  if v_motivo is null then raise exception 'Informe o motivo da devolução.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff not in ('engenharia','contrato','fora') then raise exception 'Esta nota já foi lançada no Datasul ou já foi devolvida: não dá mais para devolver por aqui.'; end if;
  select * into l from public.lancamentos where id = p_nota for update;
  if l.id is null or l.status <> 'Enviado' then raise exception 'Esta nota não veio do lançamento do painel (ou já foi devolvida): devolva pela tela de lançamento.'; end if;
  linha := 'Devolvida ao lançamento: ' || v_motivo || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  update public.lancamentos
     set status = 'Pendente', requer_revisao = true, enviado_por_email = null,
         observacoes = trim(both E'\n' from coalesce(observacoes, '') || E'\n' || 'Devolvida pela Expansão (' || eu.nome || ', ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY') || '): ' || v_motivo)
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
  if eu.equipe is null or eu.equipe not in ('administrativo', 'admin') then raise exception 'Mover a nota de grupo é da equipe administrativa.'; end if;
  if p_etapa not in ('engenharia', 'contrato', 'pedido', 'aprovacao', 'escrituracao', 'fora', 'encaminhada', 'cancelada', 'removida') then raise exception 'Grupo inválido.'; end if;
  if p_etapa in ('cancelada', 'removida') and v_motivo is null then raise exception 'Informe o motivo.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota for update;
  if r.nota_id is not null and p_base is not null and r.versao <> p_base then raise exception 'Esta nota foi alterada por outra pessoa. Atualize a tela e tente de novo.'; end if;
  destino := case p_etapa when 'engenharia' then 'Análise da engenharia' when 'contrato' then 'Vincular contrato' when 'pedido' then 'A lançar' when 'aprovacao' then 'Aprovação do pedido'
             when 'escrituracao' then 'Escrituração' when 'fora' then 'Fora da expansão' when 'encaminhada' then 'Encaminhadas' when 'removida' then 'Removida do painel' else 'Canceladas' end;
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

CREATE OR REPLACE FUNCTION public.aprovacoes_salvar(p_nota text, p_narrativa text DEFAULT NULL::text, p_contrato text DEFAULT NULL::text, p_expansao text DEFAULT NULL::text, p_base integer DEFAULT NULL::integer)
 RETURNS aprovacoes_notas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.aprovacoes_notas; ctx record; n text; c text; x text; novo text; mudou text[] := array[]::text[]; linha text;
begin
  select * into eu from public.compras_eu();
  if eu.equipe is null or eu.equipe not in ('expansao','admin') then raise exception 'Só a engenharia preenche a análise.'; end if;
  select * into ctx from public.aprovacoes_ctx(p_nota, p_base);
  if ctx.eff not in ('engenharia','contrato','pedido','aprovacao','fora') then raise exception 'Esta nota já foi para a escrituração: não dá mais para corrigir.'; end if;
  select * into r from public.aprovacoes_notas where nota_id = p_nota;
  n := case when p_narrativa is null then r.narrativa else nullif(trim(p_narrativa),'') end;
  c := case when p_contrato is null then r.contrato else nullif(trim(p_contrato),'') end;
  x := case when p_expansao is null then r.expansao else nullif(trim(p_expansao),'') end;
  if c is not null and c not in ('Sim','Não') then raise exception 'Contrato deve ser Sim ou Não.'; end if;
  if x is not null and x not in ('Sim','Não') then raise exception 'Pertence à expansão deve ser Sim ou Não.'; end if;
  novo := ctx.eff;
  if novo in ('contrato','pedido','fora') and n is not null and c is not null and x is not null then
    novo := case when x = 'Não' then 'fora' when c = 'Sim' then 'contrato' else 'pedido' end;
  end if;
  if n is distinct from r.narrativa then mudou := array_append(mudou, 'narrativa'::text); end if;
  if c is distinct from r.contrato then mudou := array_append(mudou, 'contrato'::text); end if;
  if x is distinct from r.expansao then mudou := array_append(mudou, 'pertence à expansão'::text); end if;
  if r.nota_id is not null and cardinality(mudou) = 0 and novo = r.etapa then return r; end if;
  linha := case when cardinality(mudou) = 0 then 'Encaminhamento atualizado' else 'Análise salva: ' || array_to_string(mudou, ', ') end
           || ' · ' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' · ' || eu.nome;
  insert into public.aprovacoes_notas (nota_id, etapa, narrativa, contrato, expansao, historico, por_email, por_nome)
       values (p_nota, novo, n, c, x, jsonb_build_array(linha), eu.email, eu.nome)
  on conflict (nota_id) do update set etapa = excluded.etapa, narrativa = excluded.narrativa, contrato = excluded.contrato, expansao = excluded.expansao,
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
  if eu.equipe is null or eu.equipe not in ('expansao','admin') then raise exception 'Esta decisão é da engenharia.'; end if;
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

CREATE OR REPLACE FUNCTION public.compras_avisar(req compras_requisicoes, tipo text, motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; assunto text; corpo text;
begin
  select * into eu from public.compras_eu();
  assunto := case tipo when 'abertura' then 'RM aberta: ' when 'aprovacao' then 'RM aprovada: '
                       when 'ajuste' then 'Ajuste solicitado na RM ' else 'RM recusada: ' end || req.numero;
  corpo := eu.nome || case tipo when 'abertura' then ' abriu a' when 'aprovacao' then ' aprovou a'
                                when 'ajuste' then ' pediu ajuste na' else ' recusou a' end
           || ' RM ' || req.numero || ' - ' || req.nome || '.' || coalesce(' Motivo: ' || motivo, '');
  insert into public.compras_avisos (requisicao_id, tipo, assunto, corpo, responder_para)
       values (req.id, tipo, assunto, corpo, eu.email);
end $function$;

CREATE OR REPLACE FUNCTION public.compras_avisar_abertura(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.compras_requisicoes;
begin
  select * into eu from public.compras_eu();
  select * into r from public.compras_requisicoes where id = p_id;
  if r.id is null or not (eu.equipe = 'admin' or lower(r.solicitante_email) = eu.email) then raise exception 'Requisição indisponível.'; end if;
  if exists (select 1 from public.compras_avisos where requisicao_id = p_id and tipo = 'abertura') then return; end if;
  perform public.compras_avisar(r, 'abertura');
end $function$;

CREATE OR REPLACE FUNCTION public.compras_chave_confere(chave text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from vault.decrypted_secrets where name = 'chave_avisar_compras' and decrypted_secret = chave)
$function$;

CREATE OR REPLACE FUNCTION public.compras_criar(p_nome text, p_descricao text, p_unidade text, p_tipo text, p_prioridade text, p_prazo date, p_avisar boolean DEFAULT true)
 RETURNS compras_requisicoes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.compras_requisicoes;
begin
  select * into eu from public.compras_eu();
  if eu.equipe not in ('expansao','admin') or eu.equipe is null then raise exception 'Só a engenharia abre requisições.'; end if;
  insert into public.compras_requisicoes (nome, descricao, unidade, tipo, prioridade, sla_dias, prazo_desejado, solicitante_email, solicitante_nome)
       values (trim(p_nome), nullif(trim(p_descricao),''), nullif(trim(p_unidade),''), p_tipo, p_prioridade,
               case when p_prioridade = 'Urgente' then 3 when p_tipo = 'Serviço' then 20 else 10 end, p_prazo, eu.email, eu.nome)
    returning * into r;
  insert into public.compras_historico (requisicao_id, texto, por_email, por_nome) values (r.id, 'Requisição criada; cotação vinculada', eu.email, eu.nome);
  if p_avisar then perform public.compras_avisar(r, 'abertura'); end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_disparar_aviso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform net.http_post(
    url := 'https://seu-projeto-expansao.supabase.co/functions/v1/avisar-compras',
    headers := jsonb_build_object('Content-Type','application/json','x-chave-avisos',(select decrypted_secret from vault.decrypted_secrets where name = 'chave_avisar_compras')),
    body := jsonb_build_object('aviso_id', NEW.id));
  return NEW;
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

CREATE OR REPLACE FUNCTION public.compras_excluir(p_req uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.compras_requisicoes; v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if public.painel_equipe() is distinct from 'admin' then raise exception 'Só a administração exclui requisições.'; end if;
  select * into r from public.compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  insert into public.painel_exclusoes (tipo, chave, dados, por) values ('compras', coalesce(r.monday_req_id, r.id::text),
    jsonb_build_object('requisicao', to_jsonb(r),
      'historico', coalesce((select jsonb_agg(h) from public.compras_historico h where h.requisicao_id = r.id), '[]'),
      'anexos', coalesce((select jsonb_agg(a) from public.compras_anexos a where a.requisicao_id = r.id), '[]'),
      'avisos', coalesce((select jsonb_agg(v) from public.compras_avisos v where v.requisicao_id = r.id), '[]')), v_email)
    on conflict (tipo, chave) do update set dados = excluded.dados, por = excluded.por, em = now();
  delete from public.compras_requisicoes where id = p_req;
  return r.numero;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_mover(p_id uuid, p_acao text, p_comprador text DEFAULT NULL::text, p_terceiros text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_data date DEFAULT NULL::date)
 RETURNS compras_requisicoes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.compras_requisicoes; texto text;
begin
  select * into eu from public.compras_eu();
  select * into r from public.compras_requisicoes where id = p_id for update;
  if r.id is null or not public.compras_pode_ver(r.solicitante_email) then raise exception 'Requisição indisponível.'; end if;
  if p_acao in ('atribuir', 'negociado', 'fechar') then
    if eu.equipe not in ('compras', 'admin') then raise exception 'Ação de Compras.'; end if;
    if p_acao = 'atribuir' then
      if r.etapa <> 'Aguardando Compras' or coalesce(trim(p_comprador), '') = '' then raise exception 'Informe o comprador.'; end if;
      update public.compras_requisicoes set etapa = 'Em cotação', comprador = trim(p_comprador), atualizada_em = now() where id = p_id returning * into r;
      texto := 'Comprador atribuído; negociação iniciada';
    elsif p_acao = 'negociado' then
      if r.etapa <> 'Em cotação' then raise exception 'A requisição não está em cotação.'; end if;
      update public.compras_requisicoes set etapa = 'Aguardando Engenharia', atualizada_em = now() where id = p_id returning * into r;
      texto := 'Negociação concluída; prazo de aprovação: 3 dias';
    else
      if r.etapa <> 'Aguardando fechamento' then raise exception 'A requisição não está aguardando fechamento.'; end if;
      update public.compras_requisicoes set etapa = 'Aguardando entrega', fechada_em = now(), atualizada_em = now() where id = p_id returning * into r;
      texto := 'Fechamento concluído; aguardando entrega';
    end if;
  elsif p_acao = 'entregar' then
    if not (eu.equipe in ('compras', 'admin') or (eu.equipe = 'expansao' and lower(r.solicitante_email) = eu.email)) then raise exception 'Registro de Compras, da administração ou de quem abriu a requisição.'; end if;
    if r.etapa <> 'Aguardando entrega' then raise exception 'A requisição não está aguardando entrega.'; end if;
    if p_data is null then raise exception 'Informe a data da entrega.'; end if;
    if p_data > current_date then raise exception 'A data da entrega não pode ser futura.'; end if;
    update public.compras_requisicoes set etapa = 'Entrega concluída', data_entrega = p_data, atualizada_em = now() where id = p_id returning * into r;
    texto := 'Entrega concluída em ' || to_char(p_data, 'DD/MM/YYYY');
  elsif p_acao in ('aprovar', 'ajustar', 'recusar') then
    if not (eu.equipe = 'admin' or (eu.equipe = 'expansao' and lower(r.solicitante_email) = eu.email)) then raise exception 'Só quem abriu a requisição decide.'; end if;
    if r.etapa <> 'Aguardando Engenharia' then raise exception 'A requisição não aguarda a engenharia.'; end if;
    if p_acao = 'aprovar' then
      if p_terceiros in ('Pendente', 'Reprovado') then raise exception 'Resolva a aprovação de terceiros antes de concluir.'; end if;
      update public.compras_requisicoes set etapa = 'Aguardando fechamento', terceiros = coalesce(p_terceiros, terceiros), atualizada_em = now() where id = p_id returning * into r;
      texto := 'Engenharia aprovou a requisição; aguardando fechamento'; perform public.compras_avisar(r, 'aprovacao');
    else
      if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo.'; end if;
      if p_acao = 'ajustar' then
        update public.compras_requisicoes set etapa = 'Em cotação', terceiros = coalesce(p_terceiros, terceiros), atualizada_em = now() where id = p_id returning * into r;
        texto := 'Ajuste solicitado: ' || trim(p_motivo); perform public.compras_avisar(r, 'ajuste', trim(p_motivo));
      else
        update public.compras_requisicoes set etapa = 'Recusada', terceiros = coalesce(p_terceiros, terceiros), motivo_recusa = trim(p_motivo), atualizada_em = now() where id = p_id returning * into r;
        texto := 'Requisição recusada: ' || trim(p_motivo); perform public.compras_avisar(r, 'recusa', trim(p_motivo));
      end if;
    end if;
  else
    raise exception 'Ação desconhecida.';
  end if;
  insert into public.compras_historico (requisicao_id, texto, por_email, por_nome) values (r.id, texto, eu.email, eu.nome);
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_pode_ver(req_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.painel_equipe() in ('admin','compras'), false)
      or (public.painel_equipe() = 'expansao' and lower(req_email) = lower(coalesce(auth.jwt() ->> 'email','')))
$function$;

CREATE OR REPLACE FUNCTION public.compras_registrar_anexo(p_id uuid, p_tipo text, p_nome text, p_caminho text)
 RETURNS compras_anexos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; r public.compras_requisicoes; a public.compras_anexos;
begin
  select * into eu from public.compras_eu();
  select * into r from public.compras_requisicoes where id = p_id;
  if r.id is null or not public.compras_pode_ver(r.solicitante_email) then raise exception 'Requisição indisponível.'; end if;
  if p_caminho not like p_id::text || '/%' then raise exception 'Caminho inválido.'; end if;
  insert into public.compras_anexos (requisicao_id, tipo, nome, caminho, por_email, por_nome) values (p_id, p_tipo, p_nome, p_caminho, eu.email, eu.nome) returning * into a;
  insert into public.compras_historico (requisicao_id, texto, por_email, por_nome) values (p_id, 'Anexou em ' || p_tipo || ': ' || p_nome, eu.email, eu.nome);
  return a;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_remover_anexo(p_anexo uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu record; a public.compras_anexos; r public.compras_requisicoes;
begin
  select * into eu from public.compras_eu();
  select * into a from public.compras_anexos where id = p_anexo;
  select * into r from public.compras_requisicoes where id = a.requisicao_id;
  if a.id is null or not public.compras_pode_ver(r.solicitante_email) then raise exception 'Anexo indisponível.'; end if;
  delete from public.compras_anexos where id = p_anexo;
  insert into public.compras_historico (requisicao_id, texto, por_email, por_nome) values (r.id, 'Removeu de ' || a.tipo || ': ' || a.nome, eu.email, eu.nome);
  return a.caminho;
end $function$;

CREATE OR REPLACE FUNCTION public.contratos_criar(p_nome text, p_tipo text, p_unidade text, p_valor numeric, p_aceite date DEFAULT NULL::date, p_cnpj text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_tipologia text DEFAULT NULL::text, p_aprovador text DEFAULT NULL::text)
 RETURNS contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_grupo_id text; v_grupo text; r public.contratos;
begin
  if not public.contratos_pode_criar() then raise exception 'Só os engenheiros da Expansão, o Marcos e o Gustavo criam contratos.'; end if;
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
  if not public.contratos_pode_criar() then raise exception 'Só os engenheiros da Expansão, o Marcos e o Gustavo criam aditivos.'; end if;
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
  if not (public.contratos_pode_editar() or (coalesce(public.painel_equipe(), '') = 'expansao'
          and exists (select 1 from public.contratos x where x.item_id = p_id and x.criado_por = lower(coalesce(auth.jwt() ->> 'email', '')))))
  then raise exception 'Você altera só os contratos e aditivos que criou. Os demais: Marcos ou Gustavo.'; end if;
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

CREATE OR REPLACE FUNCTION public.contratos_pode_criar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.contratos_pode_editar() or coalesce(public.painel_equipe(), '') = 'expansao'
$function$;

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
  if not public.contratos_pode_criar() then raise exception 'Só os engenheiros da Expansão, o Marcos e o Gustavo anexam documentos em contratos.'; end if;
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

CREATE OR REPLACE FUNCTION public.controle_antes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('controle.importando', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.criado_em := now(); new.criado_por := coalesce(public.controle_quem(), new.criado_por);
    new.atualizado_em := now(); new.atualizado_por := new.criado_por;
    new.origem := 'painel';
    new.etapa := coalesce(nullif(new.etapa, ''), 'Aguardando aprovação');
    -- Item novo entra no fim do grupo (como o "+ Adicionar pedido" da Monday).
    new.posicao := coalesce((select max(posicao) from public.controle_lancamentos where etapa = new.etapa), 0) + 1;
  else
    new.atualizado_em := now(); new.atualizado_por := coalesce(public.controle_quem(), new.atualizado_por);
    if new.etapa is distinct from old.etapa then
      new.movido_em := now();
      new.posicao := coalesce((select min(posicao) from public.controle_lancamentos where etapa = new.etapa), 0) - 1;
    end if;
    new.criado_em := old.criado_em; new.criado_por := old.criado_por; new.origem := old.origem; new.monday_id := old.monday_id;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.controle_api(p_email text, p_acao text, p_dados jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_email text := lower(trim(coalesce(p_email, ''))); r public.controle_lancamentos; c public.controle_lancamentos_comentarios; v jsonb;
  campos constant text[] := array['pedido','fornecedor','emissao','vencimento','instalacao','nota','texto','etapa'];
begin
  if not public.controle_autorizado(v_email) then raise exception 'Sem acesso ao Controle de Lançamentos.'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', v_email, 'role', 'authenticated')::text, true);
  if p_acao = 'carregar' then
    return jsonb_build_object(
      'itens', coalesce((select jsonb_agg(to_jsonb(x) order by x.posicao) from public.controle_lancamentos x), '[]'::jsonb),
      'comentarios', coalesce((select jsonb_agg(to_jsonb(x) order by x.em) from public.controle_lancamentos_comentarios x), '[]'::jsonb),
      'fornecedores', coalesce((select jsonb_agg(to_jsonb(x) order by x.posicao) from public.controle_fornecedores x), '[]'::jsonb));
  elsif p_acao = 'eventos' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.em desc) from (select * from public.controle_lancamentos_eventos order by em desc limit 5000) x), '[]'::jsonb);
  elsif p_acao = 'alterar' then
    if not (p_dados->>'campo' = any(campos)) then raise exception 'Campo inválido.'; end if;
    execute format('update public.controle_lancamentos set %I = $1::%s where id = $2 returning *', p_dados->>'campo',
                   case when p_dados->>'campo' in ('emissao','vencimento') then 'date' else 'text' end)
      into r using nullif(p_dados->>'valor', ''), p_dados->>'id';
    if r.id is null then raise exception 'Pedido não encontrado.'; end if;
    return to_jsonb(r);
  elsif p_acao = 'criar' then
    insert into public.controle_lancamentos (pedido, fornecedor, emissao, vencimento, instalacao, nota, texto, etapa)
    values (trim(p_dados->>'pedido'), nullif(p_dados->>'fornecedor', ''), nullif(p_dados->>'emissao', '')::date, nullif(p_dados->>'vencimento', '')::date,
            nullif(p_dados->>'instalacao', ''), nullif(p_dados->>'nota', ''), nullif(p_dados->>'texto', ''), coalesce(nullif(p_dados->>'etapa', ''), 'Aguardando aprovação'))
    returning * into r;
    return to_jsonb(r);
  elsif p_acao = 'comentar' then
    insert into public.controle_lancamentos_comentarios (item_id, texto, autor) values (p_dados->>'item_id', p_dados->>'texto', nullif(p_dados->>'autor', '')) returning * into c;
    return to_jsonb(c);
  elsif p_acao = 'excluir' then
    delete from public.controle_lancamentos where id = p_dados->>'id' returning * into r;
    return to_jsonb(r);
  elsif p_acao = 'fornecedor' then
    insert into public.controle_fornecedores (nome, posicao, criado_por) values (upper(trim(p_dados->>'nome')), coalesce((select max(posicao) from public.controle_fornecedores), 0) + 1, v_email)
    on conflict (nome) do nothing;
    return jsonb_build_object('nome', upper(trim(p_dados->>'nome')));
  end if;
  raise exception 'Ação inválida.';
end $function$;

CREATE OR REPLACE FUNCTION public.controle_autorizado(p_email text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select lower(coalesce(p_email, '')) in (
    'marina.costa@empresa.exemplo', 'laura.mendes@empresa.exemplo', 'bruno.alves@empresa.exemplo', 'tatiana.lima@empresa.exemplo',
    'gustavo@empresa.exemplo', 'marcos.prado@holding.exemplo', 'otavio.reis@holding.exemplo')
$function$;

CREATE OR REPLACE FUNCTION public.controle_comentario_registrar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('controle.importando', true) = 'on' then return new; end if;
  new.em := now();
  new.autor_email := public.controle_quem();
  new.autor := coalesce(nullif(trim(new.autor), ''), split_part(coalesce(new.autor_email, ''), '@', 1));
  new.origem := 'painel';
  insert into public.controle_lancamentos_eventos (item_id, pedido, ator, tipo, depois)
  values (new.item_id, (select pedido from public.controle_lancamentos where id = new.item_id), coalesce(new.autor_email, 'sistema'), 'comentario', left(new.texto, 300));
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.controle_excluir_registrar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('controle.importando', true) = 'on' then return old; end if;
  insert into public.controle_lancamentos_eventos (item_id, pedido, ator, tipo, antes, instantaneo)
  values (old.id, old.pedido, coalesce(public.controle_quem(), 'sistema'), 'excluido', old.etapa, to_jsonb(old) || jsonb_build_object('comentarios',
    coalesce((select jsonb_agg(to_jsonb(x)) from public.controle_lancamentos_comentarios x where x.item_id = old.id), '[]'::jsonb)));
  return old;
end $function$;

CREATE OR REPLACE FUNCTION public.controle_pode()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.controle_autorizado(auth.jwt() ->> 'email')
$function$;

CREATE OR REPLACE FUNCTION public.controle_quem()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
$function$;

CREATE OR REPLACE FUNCTION public.controle_registrar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare quem text := coalesce(public.controle_quem(), 'sistema'); c text; a text; d text;
  campos constant text[][] := array[['pedido','Pedido'],['fornecedor','Fornecedor'],['emissao','Emissão'],['vencimento','Vencimento'],
    ['instalacao','Instalação'],['nota','Nota'],['texto','Texto']];
  i int;
begin
  if current_setting('controle.importando', true) = 'on' then return null; end if;
  if tg_op = 'INSERT' then
    insert into public.controle_lancamentos_eventos (item_id, pedido, ator, tipo, depois) values (new.id, new.pedido, quem, 'criado', new.etapa);
    return null;
  end if;
  for i in 1 .. array_length(campos, 1) loop
    c := campos[i][1];
    execute format('select ($1).%I::text, ($2).%I::text', c, c) into a, d using old, new;
    if a is distinct from d then
      insert into public.controle_lancamentos_eventos (item_id, pedido, ator, tipo, campo, antes, depois)
      values (new.id, new.pedido, quem, 'alterado', campos[i][2], a, d);
    end if;
  end loop;
  if new.etapa is distinct from old.etapa then
    insert into public.controle_lancamentos_eventos (item_id, pedido, ator, tipo, campo, antes, depois)
    values (new.id, new.pedido, quem, 'etapa', 'Etapa', old.etapa, new.etapa);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.datasul_reservar_lote(registros jsonb)
 RETURNS SETOF pedidos_gerados
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
 insert into public.pedidos_gerados(lote_id,board_id,monday_item_id,documento,cnpj,unidade,natureza,valor,arquivo_nome,linhas_csv,numero_reservado,gerado_por,ordem_lote)
 select r.lote_id,r.board_id,r.monday_item_id,r.documento,r.cnpj,r.unidade,r.natureza,r.valor,r.arquivo_nome,r.linhas_csv,r.numero_reservado,r.gerado_por,r.ordem_lote
 from jsonb_to_recordset(registros) as r(lote_id uuid,board_id text,monday_item_id text,documento text,cnpj text,unidade text,natureza text,valor numeric,arquivo_nome text,linhas_csv text,numero_reservado text,gerado_por text,ordem_lote integer)
 returning *;
$function$;

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
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.lancamento_arquivos_tamanhos()
 RETURNS TABLE(lancamento_id text, tipo text, tamanho bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'storage'
AS $function$
  select l.id::text, 'nf'::text, (o.metadata->>'size')::bigint
    from public.lancamentos l join storage.objects o on o.bucket_id = 'documentos' and o.name = l.arquivo_nf_path
   where l.status = 'Enviado'
  union all
  select l.id::text, 'boleto'::text, (o.metadata->>'size')::bigint
    from public.lancamentos l join storage.objects o on o.bucket_id = 'documentos' and o.name = l.arquivo_boleto_path
   where l.status = 'Enviado'
$function$;

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
    select lower(x) from unnest(array['rafael.souza@holding.exemplo','andre.castro@holding.exemplo','bruno.nunes@holding.exemplo']) as x
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

CREATE OR REPLACE FUNCTION public.painel_portfolio_edita()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.projetos_acesso where email = lower(coalesce(auth.jwt() ->> 'email', '')))
$function$;

CREATE OR REPLACE FUNCTION public.painel_portfolio_pode()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.projetos_acesso where email = lower(coalesce(auth.jwt() ->> 'email', '')))
      or coalesce(public.painel_equipe(), '') = 'expansao'
$function$;

CREATE OR REPLACE FUNCTION public.painel_projetos_pode()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.projetos_acesso where email = lower(coalesce(auth.jwt() ->> 'email', '')))
      or coalesce(public.painel_equipe(), '') in ('admin', 'administrativo', 'expansao')
$function$;

CREATE OR REPLACE FUNCTION public.portfolio_dados()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
begin
  if not coalesce(public.painel_portfolio_pode(), false) then
    raise exception 'sem acesso ao Portfólio de Projetos';
  end if;

  with
  n as (
    select coalesce(grupo_nome, '') g, 2 k, criado_monday o, item_id::text i,
      jsonb_build_array(coalesce(nome,''), coalesce(narrativa,''), coalesce(valor::text,''), coalesce(unidade,''),
        coalesce(natureza,''), coalesce(documento,''), coalesce(to_char(emissao,'YYYY-MM-DD'),''), coalesce(status,''),
        coalesce(pedido,''), coalesce(contrato,''), coalesce(expansao,'')) r
    from monday_espelho where board_id = '18380777956' and etapa <> 'excluida'),
  ng as (select distinct g from n),
  notas as (
    select jsonb_agg(r order by g, k, o, i) v from (
      select g, 0 k, null::timestamptz o, '' i, jsonb_build_array(g) r from ng
      union all select g, 1, null, '', '["Name","Narrativa","Valor","Unidade","Natureza","Documento","Emissão","Status","Pedido","Contrato","Pertence a expansão ?"]'::jsonb from ng
      union all select g, k, o, i, r from n) t),
  c as (
    select c.*,
      coalesce(c.valor_fechado, 0) + coalesce((select sum(a.valor_fechado) from contratos a where a.item_id = any(c.aditivos)), 0) total,
      coalesce((select sum(m.valor) from monday_espelho m where m.item_id = any(c.notas) and m.etapa <> 'excluida'), 0) pago
    from contratos c where coalesce(c.estado, 'active') = 'active'),
  cl as (
    select coalesce(grupo_nome,'') g, 2 k, nome o,
      jsonb_build_array(coalesce(nome,''), coalesce(unidade,''), coalesce(narrativa,''), coalesce(tipologia,''), coalesce(tipo,''),
        coalesce(status,''), 'R$ ' || to_char(total - pago, 'FM999,999,999,990.00'), total::text, pago::text) r
    from c),
  cg as (select distinct g from cl),
  contratos_j as (
    select jsonb_agg(r order by g, k, o) v from (
      select g, 0 k, '' o, jsonb_build_array(g) r from cg
      union all select g, 1, '', '["Name","Unidade","Narrativa","Tipologia","Contrato","Status","Saldo","Valor Total","Pago"]'::jsonb from cg
      union all select g, k, o, r from cl) t),
  grupos as (
    select (gr->>'id') id, gr->>'titulo' titulo, pos
    from projetos_quadro q, jsonb_array_elements(q.grupos) with ordinality as x(gr, pos) where q.id = 1),
  p as (
    select gp.pos, 2 k, i.ordem o,
      jsonb_build_array(i.nome, coalesce(i.valores->'text_mm1hqpey'->>'t',''), coalesce(i.valores->'status'->>'t',''),
        coalesce(split_part(i.valores->'timerange_mm03c65f'->>'t', ' - ', 1),''), coalesce(split_part(i.valores->'timerange_mm03c65f'->>'t', ' - ', 2),''),
        coalesce(i.valores->'numeric_mm03p24q'->>'t','')) r
    from projetos_itens i join grupos gp on gp.id = i.grupo_id where coalesce(i.estado,'active') = 'active'),
  pg as (select distinct gp.pos, gp.titulo from grupos gp join p on p.pos = gp.pos),
  portfolio as (
    select jsonb_agg(r order by pos, k, o) v from (
      select pos, 0 k, 0 o, jsonb_build_array(titulo) r from pg
      union all select pos, 1, 0, '["Name","Unidade","Status","Cronograma Planejado - Start","Cronograma Planejado - End","Custo Planejado"]'::jsonb from pg
      union all select pos, k, o, r from p) t)
  select jsonb_build_object(
    'atualizadoEm', (select to_char(max(espelhado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from monday_espelho),
    'fonte', 'nosso painel',
    'notas', coalesce((select v from notas), '[]'::jsonb),
    'portfolio', coalesce((select v from portfolio), '[]'::jsonb),
    'contratos', coalesce((select v from contratos_j), '[]'::jsonb))
  into resultado;
  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.portfolio_projeto_salvar(p_id text, p_nome text, p_grupo text, p_valores jsonb, p_versao integer DEFAULT 0)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare chave text; v integer; campo record;
begin
  if auth.uid() is null or not coalesce(public.painel_portfolio_edita(),false) then raise exception 'Sem permissão de edição.'; end if;
  if coalesce(trim(p_nome),'')='' then raise exception 'Informe o nome do projeto.'; end if;
  if not exists(select 1 from projetos_quadro q,jsonb_array_elements(q.grupos) g where q.id=1 and g->>'id'=p_grupo) then raise exception 'Grupo inválido.'; end if;
  if jsonb_typeof(p_valores) is distinct from 'object' then raise exception 'Campos inválidos.'; end if;
  for campo in select key,value from jsonb_each(p_valores) loop
    if not exists(select 1 from projetos_quadro q,jsonb_array_elements(q.colunas) c where q.id=1 and c->>'id'=campo.key and c->>'tipo' not in ('name','subtasks','formula','mirror','board_relation'))
      or jsonb_typeof(campo.value) <> 'object' or jsonb_typeof(campo.value->'t') is distinct from 'string' then raise exception 'Campo inválido: %',campo.key; end if;

    if exists(select 1 from projetos_quadro q,jsonb_array_elements(q.colunas) c where q.id=1 and c->>'id'=campo.key and c->>'tipo'='numbers')
      and coalesce(campo.value->>'t','')<>'' then
      if (campo.value->>'t') !~ '^-?[0-9]+([.][0-9]+)?$' then raise exception 'Valor numérico inválido.'; end if;
      perform (campo.value->>'t')::numeric;
    end if;
    if exists(select 1 from projetos_quadro q,jsonb_array_elements(q.colunas) c where q.id=1 and c->>'id'=campo.key and c->>'tipo'='timeline')
      and coalesce(campo.value->>'t','')<>'' then
      if (campo.value->>'t') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} - [0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then raise exception 'Cronograma inválido.'; end if;
      if split_part(campo.value->>'t',' - ',1)::date>split_part(campo.value->>'t',' - ',2)::date then raise exception 'O fim deve ser igual ou posterior ao início.'; end if;
    end if;
    if exists(select 1 from projetos_quadro q,jsonb_array_elements(q.colunas) c where q.id=1 and c->>'id'=campo.key and c->>'tipo'='status' and not (coalesce(c->'cores','{}') ? (campo.value->>'t')))
      and coalesce(campo.value->>'t','')<>'' then raise exception 'Status inválido.'; end if;
  end loop;

  chave:=coalesce(nullif(p_id,''),'painel-'||gen_random_uuid()::text);
  perform pg_advisory_xact_lock(hashtextextended(chave,0));
  select versao into v from portfolio_projetos_local where item_id=chave for update;
  if coalesce(v,0)<>coalesce(p_versao,0) then raise exception 'O projeto mudou. Reabra antes de salvar.'; end if;
  if p_id is not null and not exists(select 1 from portfolio_projetos_efetivos where item_id=chave) then raise exception 'Projeto indisponível.'; end if;
  insert into portfolio_projetos_local(item_id,nome,grupo_id,valores,por_email) values(chave,trim(p_nome),p_grupo,p_valores,lower(auth.jwt()->>'email'))
    on conflict(item_id) do update set nome=excluded.nome,grupo_id=excluded.grupo_id,valores=portfolio_projetos_local.valores||excluded.valores,
      versao=portfolio_projetos_local.versao+1,por_email=excluded.por_email,atualizado_em=now();
  return chave;
end $function$;

CREATE OR REPLACE FUNCTION public.portfolio_projetos_listar()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not (coalesce(public.painel_projetos_pode(),false) or coalesce(public.painel_portfolio_pode(),false)) then raise exception 'Sem acesso ao Portfólio.'; end if;
  return jsonb_build_object('edita',public.painel_portfolio_edita(),'quadro',(select to_jsonb(q) from projetos_quadro q where id=1),
    'itens',coalesce((select jsonb_agg(to_jsonb(p) order by ordem,nome) from portfolio_projetos_efetivos p where coalesce(estado,'active')='active'),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.quadro_salvar(p_quadro text, p_item text, p_grupo text, p_nome text, p_valores jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tab text; v_qtab text; v_grupos jsonb; v_grupo_nome text; v_id text; v_ordem int; achou boolean;
begin
  if not public.painel_portfolio_edita() then raise exception 'Só o Marcos e o Gustavo criam e editam projetos e atividades.'; end if;
  if p_quadro = 'projetos' then v_tab := 'projetos_itens'; v_qtab := 'projetos_quadro';
  elsif p_quadro = 'atividades' then v_tab := 'atividades_itens'; v_qtab := 'atividades_quadro';
  else raise exception 'Quadro inválido.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  execute format('select grupos from public.%I where id = 1', v_qtab) into v_grupos;
  select g->>'titulo' into v_grupo_nome from jsonb_array_elements(coalesce(v_grupos, '[]')) g where g->>'id' = p_grupo;
  if v_grupo_nome is null then raise exception 'Escolha o grupo.'; end if;
  if p_item is null or p_item = '' then
    v_id := 'P-' || replace(gen_random_uuid()::text, '-', '');
    execute format('select coalesce(max(ordem), 0) + 1 from public.%I', v_tab) into v_ordem;
    execute format('insert into public.%I (item_id, grupo_id, grupo_nome, ordem, nome, estado, valores, subitens, origem, alterado_por, alterado_em, espelhado_em) values ($1, $2, $3, $4, $5, %L, $6, %L::jsonb, %L, $7, now(), now())', v_tab, 'active', '[]', 'painel')
      using v_id, p_grupo, v_grupo_nome, v_ordem, trim(p_nome), coalesce(p_valores, '{}'::jsonb), lower(auth.jwt() ->> 'email');
  else
    v_id := p_item;
    execute format('update public.%I set grupo_id = $2, grupo_nome = $3, nome = $4, valores = valores || $5, alterado_por = $6, alterado_em = now() where item_id = $1 returning true', v_tab)
      into achou using v_id, p_grupo, v_grupo_nome, trim(p_nome), coalesce(p_valores, '{}'::jsonb), lower(auth.jwt() ->> 'email');
    if not coalesce(achou, false) then raise exception 'Item não encontrado.'; end if;
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.atualizado_em = now();
  return new;
end;
$function$;

-- ===== Gatilhos (14)
CREATE TRIGGER aprovacoes_completar BEFORE INSERT OR UPDATE ON public.aprovacoes_notas FOR EACH ROW EXECUTE FUNCTION aprovacoes_completar_campos();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.arquivos_processados FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER compras_avisos_disparo AFTER INSERT ON public.compras_avisos FOR EACH ROW EXECUTE FUNCTION compras_disparar_aviso();
CREATE TRIGGER compras_nao_recriar BEFORE INSERT ON public.compras_requisicoes FOR EACH ROW EXECUTE FUNCTION bloquear_recriar_excluido('compras');
CREATE TRIGGER contratos_nao_recriar BEFORE INSERT ON public.contratos FOR EACH ROW EXECUTE FUNCTION bloquear_recriar_excluido('contrato');
CREATE TRIGGER controle_antes BEFORE INSERT OR UPDATE ON public.controle_lancamentos FOR EACH ROW EXECUTE FUNCTION controle_antes();
CREATE TRIGGER controle_excluir_registrar BEFORE DELETE ON public.controle_lancamentos FOR EACH ROW EXECUTE FUNCTION controle_excluir_registrar();
CREATE TRIGGER controle_registrar AFTER INSERT OR UPDATE ON public.controle_lancamentos FOR EACH ROW EXECUTE FUNCTION controle_registrar();
CREATE TRIGGER controle_comentario_registrar BEFORE INSERT ON public.controle_lancamentos_comentarios FOR EACH ROW EXECUTE FUNCTION controle_comentario_registrar();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.exclusoes_recentes FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.historico_status FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER trg_assistente_desfazer AFTER INSERT OR DELETE OR UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION fn_assistente_desfazer();
CREATE TRIGGER trg_atualizado_em BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_audit_lancamento AFTER UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION fn_audit_lancamento();
