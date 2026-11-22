# 13 · Desafios e lições

Problemas que aconteceram de verdade, com o sistema em uso, e como foram resolvidos. A maioria está comentada no próprio código, no ponto da correção.

## Concorrência e consistência

**1. Notas duplicadas.**
Toda a equipe vigiava a mesma pasta. Duas pessoas liam o mesmo arquivo ao mesmo tempo, as duas ouviam "não existe" e criavam duas linhas.
→ O painel grava o **hash do arquivo** numa coluna única **antes** de ler. Quem consegue gravar segue; o outro desiste. *Lição: quem decide a corrida é o banco.*

**2. Duas pessoas editando a mesma nota.**
A trava era conferida só no navegador, e dois cliques no mesmo instante passavam.
→ A trava passou para o banco: só fica com ela quem conseguir gravar. Nas aprovações, cada função confere a **versão** da nota e recusa se outra pessoa alterou antes.

**3. A tela mentia depois que a internet caía.**
O tempo real do Supabase não reenvia o que se perdeu durante a queda, e o indicador voltava a ficar verde com a tela desatualizada.
→ Quando a conexão volta, o painel **recarrega os dados**, esperando a rede estabilizar e sem atrapalhar quem está digitando.

**4. Nota apagada que voltava sozinha.**
O arquivo continuava na pasta, e a nota era recriada segundos depois.
→ A exclusão deixa uma **marca** no banco antes de apagar, e o painel ignora aquele arquivo.

**5. Histórico sumindo.**
A API devolve no máximo **1.000 linhas** por consulta, sem avisar. O painel mostrava só as mais antigas.
→ Todas as consultas grandes passaram a buscar **em páginas**.

## Leitura de documentos

**6. A IA erra com confiança.**
→ Saída em JSON Schema, lista de campos incertos e conferências independentes: dígito do CNPJ, número e valor no texto do PDF, valor contra a linha digitável. Qualquer divergência vira aviso ([04](04-entrada-e-leitura.md#conferir-o-que-a-ia-leu)).

**7. Cota e instabilidade da API direta.**
A chave gratuita da API do modelo dava erro 503 o tempo todo e estourou a cota com cerca de 20 notas.
→ A chamada passou a usar o **OpenRouter**, com modelo de reserva, novas tentativas só para erros passageiros e provedores que não guardam dados.

**8. Unidade errada é pior que vazia.**
→ A unidade sai por **votos** do CNPJ do tomador, entre a tabela verificada e as confirmações humanas. Só preenche com unanimidade.

**9. Mesma nota, CNPJs diferentes.**
Um fornecedor emitia a nota por uma filial e o boleto pela matriz. O painel dizia "nenhuma nota disponível" para o boleto.
→ Duas linhas passaram a ser do mesmo emissor quando o CNPJ é igual ou quando são **matriz e filial**. Para isso, precisam ter a mesma raiz de 8 dígitos **e** nome parecido, com 14 dígitos dos dois lados. Só a raiz não basta: CPF tem 11 dígitos, e "os 8 primeiros iguais" não quer dizer nada entre duas pessoas.

**10. Um boleto, quinze notas.**
Um fornecedor mandou 15 notas de cerca de R$ 2 mil e um único boleto com o total.
→ Entrou o **boleto conjunto**: um boleto vira arquivo de várias notas, e a confirmação fica com uma pessoa, em vez de um palpite.

**11. Portal da prefeitura que bloqueia a nuvem.**
O site de um município derrubava conexões vindas da AWS, onde as Edge Functions rodam.
→ Um **Worker na Cloudflare** busca a página e devolve o PDF, e a função usa esse caminho quando o direto falha.

**12. Medir antes de automatizar.**
→ Antes de ligar o envio automático, o painel ficou cerca de três semanas em **modo sombra**: gravava o que teria enviado e comparava com o que a equipe enviou de fato ([04](04-entrada-e-leitura.md#7-medir-antes-de-automatizar-o-modo-sombra)).

## Integrações

**13. Dados trocados no quadro antigo sem nenhum erro.**
Dois quadros usavam o mesmo código de coluna para coisas diferentes: num era vencimento, no outro data de pagamento. Depois que um item mudava de quadro, a gravação escrevia vencimento por cima do pagamento.
→ A função passou a conferir **em que quadro o item está** antes de escrever.

**14. Item da escrituração em nome de quem enviou.**
O item no SharePoint precisava ser criado pela pessoa que mandou escriturar.
→ O e-mail `[ESCRITURAR]` vai para a **caixa de quem clicou**, e um fluxo na conta dessa pessoa cria o item.

**15. E-mails com muitos anexos.**
O Microsoft Graph recusa e-mail grande numa chamada só.
→ Nos avisos de Compras, o anexo vai direto até cerca de 3 MB; acima disso, o envio é feito em partes. Se ainda não couber, o e-mail lista o que ficou de fora.

**16. Retorno do robô em texto livre.**
→ A função lê o e-mail com uma regra fixa, para pedido, resultado, quem e motivo. Ela é **idempotente**, não duplica histórico, e só registra quando a nota está na etapa certa.

## Engenharia de software

**17. Evoluir um arquivo de 16 mil linhas sem quebrar o que estava em uso.**
→ Geradores com **trechos exatos**, que param em vez de adivinhar ([11](11-build-testes-e-deploy.md)).

**18. Demonstração que vira protótipo descartável.**
→ A mesma tela, com outra camada de dados. A demonstração serviu para validar cada mudança com as equipes e virou a vitrine deste repositório.

**19. O assistente pedindo desculpas por números certos.**
→ Cada resposta guarda a **hora** e as consultas feitas, e o modelo entende que "últimos 20 minutos" em horários diferentes são janelas diferentes ([09](09-assistente-com-ia.md#problemas-reais)).

**20. "Onde está a verdade?"**
Enquanto o sistema antigo existia, surgiam pedidos de "corrige lá também".
→ Corte completo dos vínculos e uma regra para o futuro: dado que só existe fora é trazido **uma vez** para o banco, e a dependência acaba ([12](12-migracao.md#7-corte-1911)).
