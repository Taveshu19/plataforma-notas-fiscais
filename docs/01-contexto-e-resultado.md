# 01 · Contexto e resultado

## A empresa e o problema

A empresa tem **21 unidades** e três áreas que recebem notas de fornecedores todos os dias:
- **Expansão:** obras de unidades novas;
- **Engenharia:** manutenção e obras das unidades existentes;
- **Administrativo:** inclui as notas de um pagador externo, chamado aqui de **TAG**.

Antes do sistema, o caminho de uma nota era este:

1. O fornecedor mandava a nota por e-mail para a caixa da área.
2. Alguém abria cada PDF e digitava número, fornecedor, CNPJ, valor e vencimento numa planilha.
3. A aprovação acontecia num quadro do **Monday.com**: análise da engenharia, contrato, pedido no ERP e escrituração.
4. Quem lançava tinha que lembrar o que já tinha ido para pagamento.
5. Nota com link em vez de anexo exigia abrir o site da prefeitura e baixar à mão.

Os problemas eram previsíveis:
- nota esquecida até vencer;
- boleto lançado duas vezes por pessoas diferentes;
- ninguém sabendo quem mexeu em quê;
- dados redigitados em três lugares (planilha, quadro e ERP);
- regras de aprovação espalhadas em automações de ferramenta, e-mails e conhecimento das pessoas.

## O que foi construído

Um sistema próprio que cobre o caminho inteiro, em duas fases.

**Fase 1, de julho a outubro de 2026: lançamento automático.**
- O painel de lançamento vigia a pasta onde o Power Automate salva os anexos e lê cada nota.
- A leitura usa XML, depois o texto do PDF e, por fim, a IA.
- A equipe só confere e envia.
- A aprovação ainda acontecia no Monday.com, alimentado por uma função do banco.
- Foram 147 versões publicadas. A Expansão começou, depois vieram a Engenharia e o Administrativo, cada uma com banco, site e fluxo próprios.

**Fase 2, de 5 a 20 de novembro de 2026: aprovação própria e fim do Monday.com.**
- As etapas de aprovação, contratos, compras, projetos e o painel da TAG passaram para dentro do sistema, com regras no banco.
- A escrituração passou a sair do próprio painel, e o retorno do robô de aprovação do ERP entra sozinho.
- Os três painéis passaram a ficar num endereço só.
- O Monday.com virou só histórico.
- O sistema foi entregue ao responsável seguinte com documentação completa.

## Quem usa e para quê

| Perfil | Quem é | O que faz no sistema |
|---|---|---|
| Equipe de lançamento | Administrativo, 4 pessoas | Confere o que a leitura trouxe, corrige, envia, registra o pedido do ERP e envia para escriturar |
| Engenharia | Engenheiros da Expansão e da Engenharia | Analisa a nota (narrativa, é contrato?, pertence à área?) e vincula contrato |
| Compras | Comprador | Recebe requisições, cota, fecha pedido e acompanha a entrega |
| TAG | Aprovador e back-office do pagador externo | Aprova as notas do pagador e acompanha pagamento e comprovante |
| Administração | Gestores | Veem tudo, criam contratos, cuidam de acessos |

No total, foram 15 pessoas em 5 perfis, nos dois bancos.

## O resultado

- **Ninguém redigita.** O que a leitura trouxe chega às Aprovações com os campos preenchidos. A correção feita no painel vale para a escrituração.
- **Uma nota, um histórico.** Cada passo, correção, arquivo incluído ou removido, envio e retorno vira uma linha datada, com quem fez. Isso é garantido pelas funções do banco.
- **A regra mora no sistema.** Quem pode aprovar, o que precisa estar preenchido, para onde vai cada nota e quando o reenvio é aceito são regras do banco, e não combinados de pessoas.
- **Menos ferramentas pagas.** A empresa deixou de depender de um SaaS de quadros para o processo de notas.
- **Mais de 800 documentos lançados** pela equipe até novembro de 2026, nas três áreas.

## O que eu fiz

Fiz tudo sozinho:
- o levantamento com cada equipe;
- a modelagem e o banco;
- as funções do servidor e as telas;
- os fluxos do Power Automate;
- a migração, os testes e a publicação;
- o suporte do dia a dia;
- a documentação de entrega.

Os pedidos das equipes viravam entregas no mesmo dia. Cada pedido ficava registrado num documento datado, com o que foi pedido, o que foi feito e como foi conferido.
