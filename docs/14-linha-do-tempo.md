# 14 · Linha do tempo

## Fase 1 · Lançamento automático (julho a outubro de 2026)

| Quando | O quê |
|---|---|
| Julho | Painel de lançamento da **Expansão** em produção: e-mail → Power Automate → pasta → painel → banco → quadro de aprovação |
| Julho e agosto | **Auditoria de tempo real**: notas duplicadas, trava de edição decidida pelo banco, recarga depois de queda de conexão, nota excluída que voltava, paginação além de 1.000 linhas |
| Agosto | Casos reais de boleto: matriz e filial, boleto conjunto, boleto com valor líquido. Unidade pelo CNPJ do tomador, com votos |
| Setembro | O mesmo painel levado para a **Engenharia** e o **Administrativo**, cada um com banco, site e fluxo próprios |
| Outubro | **Gemini** vira o leitor principal dos PDFs, pelo OpenRouter, com JSON Schema e conferências. **Assistente com Claude** no painel, com papéis de banco e propostas confirmadas |
| 07/10 | **Modo sombra**: o painel mede se o envio automático acertaria, sem enviar nada (build103) |
| Outubro | Estudo da integração com o ERP: análise de 3.234 notas do histórico antes de construir ([estudo de caso](https://github.com/Taveshu19/portfolio/blob/main/casos/04-integracao-com-erp.md)) |
| 29/10 | **Envio automático** das linhas que passam em todas as conferências (build141) |
| 05/11 | Build147. O envio automático é desligado de propósito, para começar a fase 2 |

## Fase 2 · Aprovação própria e fim do quadro SaaS (novembro de 2026)

| Dia | O quê |
|---|---|
| 05/11 | Levantamento dos quadros, colunas e automações. **Proposta navegável** com dados fictícios. Reunião com Compras |
| 06/11 | Remodelação da interface: navegação lateral, fila de decisões, temas claro e escuro, documento ao lado do formulário |
| 09/11 | Plano de produção para Aprovações e Compras no painel real. Primeira homologação |
| 10/11 | Avisos de Compras por e-mail, sempre com os documentos. Aba de Contratos |
| 11/11 | Arquivos do sistema antigo servidos pelo painel (os links de lá expiram em horas) |
| 12/11 | Conferência entre o quadro antigo e o painel. Estudo do Portfólio de Projetos |
| 14/11 | Aprovações da Engenharia (demonstração). Contratos com saldo, Compras em grupos e Projetos. "Esqueci minha senha" próprio. Regra da TAG |
| 15/11 | **Site único**: menu, Expansão, Engenharia e TAG num endereço. Login igual nos três. Notas da Engenharia com Pagador TAG vão para o painel da TAG |
| 16/11 | **Virada:**<br>• aprovações no banco real;<br>• TAG com login e dados no Supabase;<br>• escrituração e retorno do robô pelo painel;<br>• auditoria de paridade;<br>• backups e pontos de retorno |
| 17/11 | Revisão geral dos painéis. Data de envio e pastas. Pedidos das equipes. TAG só para quem aprova |
| 18/11 | Arquivos incluídos pelo painel vão no envio. E-mail de reprovação na TAG. Arquivos antigos 100% copiados |
| 19/11 | **Corte total do sistema antigo** (funções, chaves e textos). Controle de Lançamentos. Remessa sempre ao fiscal. Arquivos removíveis em todas as etapas. Segundo boleto no envio. Aprovação da TAG travada depois de aprovada |
| 20/11 | **Entrega** ao responsável seguinte: pacote com o código e 11 documentos |

## Em números

- 147 versões do painel de lançamento.
- 15 dias entre o levantamento e a entrega da fase 2.
- 11 Edge Functions, 103 funções SQL e 29 gatilhos.
- 78 tabelas e 167 políticas de acesso.
- 48 testes automatizados.
