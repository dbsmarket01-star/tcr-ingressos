# Auditoria operacional da Assistente IA — TCR Ingressos

Data: 09/11/2026, horário de Brasília. Auditoria iniciada a pedido de Diego, com preservação de vendas e configurações dos eventos reais.

## Método e ambiente

Revisão da rota HTTP, orquestração, ferramentas de investigação, autorização, propostas, confirmação, serviços de eventos/lotes e interface. Testes automatizados com dependências simuladas são identificados separadamente dos testes reais. Nenhum teste automatizado de concorrência equivale a um ensaio de carga em produção.

Os testes reais usaram a sessão de Diego no painel e um único cadastro fictício: **AUDITORIA INTERNA ASSISTENTE 2027**, ID `cmwa2o2zf000el1081ssvh6hl`, slug `auditoria-interna-assistente-2027`. O evento permanece DRAFT, sem pedidos, sem vendas e fora do site público (HTTP 404). Nenhum evento comercial foi publicado, pausado ou editado para esta auditoria. Lucas e Diego têm perfil OWNER e acesso geral; não foi necessário alterar permissões nem simular login de outro usuário.

## Falhas encontradas e corrigidas

1. A verificação de proposta concluída não impedia duas confirmações simultâneas. Foi criada uma reivindicação persistente e única por proposta. Confirmação, repetição e cancelamento disputam o mesmo identificador. Em falha de resultado incerto, a proposta não é reexecutada automaticamente; é necessário consultar o estado e gerar outra.
2. Uma alteração de preço podia sobrescrever mudanças ocorridas entre a leitura inicial e a gravação. A confirmação agora verifica o preço dentro do bloqueio do evento e altera somente o preço, preservando taxas e descontos atualizados. Mudanças de status também usam comparação atômica.
3. O cancelamento da interface não verificava erros HTTP. Agora informa falha e restaura a proposta. Respostas antigas da atualização periódica não substituem propostas novas; mensagens recebidas por duas vias são deduplicadas.
4. A criação do primeiro ingresso rejeitava a expressão válida “a partir da 2ª parcela”. O parser agora aceita os indicadores ordinais portugueses. A falha foi reproduzida no painel; a correção foi coberta por teste automatizado.
5. A consulta de um link externo podia devolver ingressos do evento anterior da conversa. Reproduzido em produção, corrigido e repetido com sucesso: a referência do Fernandinho retornou Pista Meia R$ 67,90, Black November R$ 67,90 e Inteira R$ 197,90.
6. Um print citado como referência podia ser tratado como substituição de banner/mapa. A análise de imagem foi separada do pedido explícito de substituição.
7. Um evento descoberto pelas ferramentas, mas ausente do ranking inicial, não podia ser usado para uma proposta. Seus dados agora são relidos com o escopo de autorização antes da validação.
8. Uma solicitação conjunta de cor e preço podia entrar no atalho exclusivo de cor. A proposta geral passou a contemplar os dois campos; o caso foi testado automaticamente e no painel.
9. O estoque de novos lotes não tinha proteção contra nomes duplicados criados pela assistente. A criação agora verifica duplicação sob o bloqueio do evento.
10. A consulta do histórico com cursor fora do dia escolhido podia alargar o período. O limite do período agora prevalece. Usuários com escopo restrito não recebem o histórico e imagens de outros operadores.
11. Faltava ferramenta para consultar a página pública real. Foi acrescentada `inspect_public_event`, limitada a eventos autorizados e ao domínio oficial. O prompt distingue leitura do banco de verificação pública.
12. A taxa de bilheteria explícita passou a integrar a proposta de atualização, com valor anterior/novo visível. Juros e descontos existentes são preservados.
13. As propostas de mídia mostravam identificador interno e nomes técnicos. A interface passou a exibir rótulos compreensíveis e prévia da imagem anexada.
14. Um pedido explícito de pausa foi rejeitado pelo caminho genérico de decisão. Pausa e reativação de um lote identificado inequivocamente agora geram a proposta a partir dos valores reais, sem reconstrução de preço/estoque pelo modelo.
15. Os testes da assistente não faziam parte do build/deploy obrigatório. Agora `npm run build` começa por `test:assistant-safety`.

## Evidências e matriz de capacidades

| Caminho | Evidência / resultado |
| --- | --- |
| Criação de evento | Teste real: proposta, confirmação e rascunho persistido; data 12/12/2027 18h convertida corretamente para 21h UTC. |
| Primeiro ingresso | Teste real: criação após confirmação, preço R$ 100, estoque 10, PAUSED, taxa 10%, juros 2% desde a segunda parcela. |
| Preço, estoque e taxa | Teste real e consulta ao banco: R$ 110, estoque 12, taxa 12%; PAUSED e juros preservados. |
| Cancelamento | Teste real: proposta de R$ 120 cancelada; banco permaneceu em R$ 110. |
| Cor, preço e reativação juntos | Teste real: proposta de R$ 111, #24865D e ACTIVE no evento fictício. |
| Nome/descrição/local/endereço/data | Propostas e validação automatizadas; descrição/local/endereço/horário também confirmados no painel e no banco. Horário alterado para 19h Brasília = 22h UTC. |
| Banner por arquivo | Teste real: anexo, proposta, confirmação, URL persistida e imagem respondendo HTTP 200 image/png. |
| Mapa por URL | Teste real: URL pública salva no campo do mapa, confirmada no banco, mantendo DRAFT. |
| Leitura de print | Teste real: data, horário e cidade transcritos corretamente, sem proposta de alteração. |
| Link externo | Teste real após correção, com preços correspondentes à referência enviada. |
| Leitura do repositório | Teste real: funções exportadas de assistant-request.ts e commit 75e4127 identificados corretamente. Escrita de código não faz parte dessas ferramentas. |
| Ordenação | Testes automatizados preservam setores, pausados e identidade dos lotes; revisão pública descrita na conclusão desta auditoria. |
| Autorização | Testes automatizados de evento fora de escopo, perfil sem permissão de alteração e proposta de outro operador. Não foram modificadas permissões reais. |
| Confirmação repetida / concorrência | Testes automatizados de reivindicação única, preço alterado antes da obtenção do bloqueio e preservação das taxas. Não foi disparada carga concorrente contra vendas reais. |
| Arquivos inválidos / SSRF | Testes automatizados de MIME falso, formato/tamanho, endereços privados, caminhos de segredo e traversal. |
| Histórico compartilhado / filtros | Código revisado e teste de limite de período; validação visual descrita na conclusão. |
| Erro externo / timeout | Respostas de erro não registram execução como concluída; limite de tempo total da investigação, com proposta necessária antes de qualquer mutação. |

## Limites que não devem ser vendidos como recursos prontos

- As ferramentas de GitHub são **somente leitura**. A assistente não possui terminal, runner isolado, escrita em branch/PR nem capacidade de desenvolver/deployar código autonomamente. Isso não foi criado nem autorizado por um token implícito.
- Não existem ferramentas de pagamento, split, estorno ou transferência. Essas operações não foram testadas com movimentação real e continuam fora do escopo.
- Criação de mapas numerados, alteração das opções de camarotes/assentos/hotel e estoque de lote com opções exigem o cadastro específico. A ferramenta de lotes recusa modelos com essas configurações especiais.
- Atualização genérica dos juros/descontos de um lote existente não é uma operação exposta pela assistente. A taxa de bilheteria explícita foi implementada e testada; não confundir uma com a outra.
- Criação de eventos gera rascunho. Publicação automática de novo evento e alteração simultânea de vários eventos não foram habilitadas. A proposta opera em um evento por vez, até 20 mudanças de lotes ou 16 campos de evento.
- O catálogo retorna até 60 eventos por chamada de investigação; arquivos de código e páginas externas têm limites de tamanho. Fontes indisponíveis ou sem dados essenciais exigem esclarecimento, não invenção.
- Não existe verificação visual autônoma por navegador dentro da assistente. A nova ferramenta consulta HTML público; esta auditoria verificou visualmente os fluxos pelo navegador.
- Uma auditoria finita não comprova ausência de toda falha futura. A proteção prática é confirmação, comparação com o estado atual, transações, regressões obrigatórias e relato honesto dos resultados.

## Próxima arquitetura, caso a escrita autônoma de código seja solicitada

GitHub App restrita a este repositório, criação de branch/PR sem acesso direto a produção, runner isolado sem credenciais de pagamentos, testes obrigatórios, revisão/aprovação e publicação exclusivamente por `npm run deploy:production`. A instalação e concessão de escrita dessa integração dependem de autorização específica do proprietário. Nada dessa ampliação de acesso foi feito durante a auditoria.
