# 15 · Como eu trabalhei

## Com as equipes

- **Levantar antes de construir.** Para cada processo, perguntei a quem fazia o trabalho:
  - o que entra;
  - quem decide;
  - o que precisa estar preenchido;
  - para onde vai.

  Regra de negócio não se inventa: quando eu tinha dúvida, perguntava, e a resposta virava regra escrita no banco.
- **Mostrar antes de ligar.** Cada mudança ia primeiro para a cópia de demonstração, com dados fictícios e o mesmo código da tela. Só depois da validação ela ia para o banco real.
- **Pedido no mesmo dia.** Os pedidos das equipes viravam entregas no próprio dia. Exemplos:
  - "remover arquivo da nota";
  - "enviar em lote tirando uma nota";
  - "aprovar também na etapa fiscal";
  - "o PDF abrir sempre na mesma guia".
- **Tudo registrado.** Cada rodada de pedidos virou um documento datado, com o que foi pedido, o que foi feito, onde e como foi conferido.

## Com o código

- **Regra no banco.** O que importa para o negócio fica em funções SQL com perfil, etapa, versão e histórico, e não só na tela.
- **Mudança com trava.** Geradores que param em vez de adivinhar. Montagem da demonstração que para se encontrar endereço real.
- **Ponto de retorno antes de mexer.** Backup dos bancos, cópia das páginas no ar e ID da versão publicada antes de cada virada.
- **Testar como o usuário.** Testes de regra (`node:test`) e roteiros no navegador que entram como cada perfil e fazem o caminho inteiro.
- **Documentar para quem vem depois.** O sistema foi entregue com 11 documentos e com a lista de chaves e acessos a trocar.

## Com agentes de IA

Construí este sistema sozinho, usando agentes de código no terminal como ferramenta de desenvolvimento:
- **Claude Code** e **Codex**;
- coordenados pelo **Orca**, cada um na própria cópia do repositório.

O jeito de trabalhar:
- **Eu especifico e decido.** Escrevo o pedido com a regra de negócio, o que pode e o que não pode mudar, e como conferir. A decisão sobre o negócio é minha. O agente não inventa regra; quando falta informação, ele pergunta.
- **Um escreve, outro revisa.** Quem implementa não revisa o próprio trabalho, e só um agente escreve por vez em cada repositório.
- **Contexto versionado.** Instruções do projeto (`CLAUDE.md`, `AGENTS.md`) com o porquê das decisões que não são óbvias. Isso evita que o próximo agente "simplifique" justamente o trecho que segura o sistema.
- **Ferramentas reais.** Os agentes acessam Supabase, Netlify, Microsoft 365 e GitHub por MCP e CLI, conferem no navegador o que mudou e não publicam nem enviam nada sem a minha autorização.
- **Conferência no fim.** Antes de cada publicação, eu confiro o resultado. Uma entrega só conta como pronta quando foi testada.

Mais sobre esse método no meu portfólio: [Como eu desenvolvo](https://github.com/Taveshu19/portfolio/blob/main/casos/05-desenvolvimento-com-agentes.md).
