# Ledger financeiro e conciliação TCR × Asaas

Implementação local de 30/09/2026. **Sem deploy, sem migração em produção e sem ativação da conta financeira.** As mudanças pré-existentes de interface e exportação foram preservadas. Nenhuma transferência, cobrança ou devolução é executada por este módulo.

## Contrato contábil

`features/finance/ledger/rules.ts` define os tipos econômicos. O valor de cada lançamento é um inteiro **positivo em centavos**, persistido como `BIGINT`. O tipo determina a conta e a direção; o chamador não informa um sinal. Valores monetários da API são convertidos por representação decimal, sem acumulação de ponto flutuante. Somas usam `BigInt` e rejeitam resultados fora do intervalo seguro suportado pela aplicação.

| Conta       | Créditos                          | Débitos                                                  |
| ----------- | --------------------------------- | -------------------------------------------------------- |
| PRODUCER    | Principal da venda                | Principal estornado; saque atribuído ao produtor         |
| FEES        | Taxa da bilheteria                | Taxa estornada                                           |
| INTEREST    | Juros cobrados do comprador       | Juros estornados                                         |
| COSTS       | Reversão de custo Asaas           | Custos Asaas                                             |
| SPLITS      | Reversão de split                 | Split                                                    |
| RECEIVABLES | Recebível bruto aberto            | Liquidação e estorno antes da liquidação                 |
| CASH        | Recebimento e reversões bancárias | Estorno, custo, split, saque e liquidação de antecipação |
| ALLOCATION  | —                                 | Parte do saque atribuída à bilheteria                    |

Essas contas são visões econômicas segregadas, **não um plano contábil completo de partidas dobradas**. Não se somam indiscriminadamente CASH e PRODUCER: caixa disponível e obrigação com o produtor são grandezas diferentes. Principal é `total − taxa da bilheteria − juros`. Estornos parciais distribuem valores acumulados proporcionalmente e conservam os centavos; cada nova notificação registra somente o incremento.

O fechamento compara saldos acumulados desde uma abertura auditada, em cada data de corte. Datas financeiras seguem `America/Sao_Paulo`. A API aceita somente dias encerrados. Abertura informa caixa, obrigação com produtor e recebíveis, com evidência e identidade da wallet Asaas. Não se presume saldo inicial zero.

## Persistência e migração

Migração: `prisma/migrations/20260930180000_financial_ledger/migration.sql`.

- `FinancialLedgerAccount`: configuração de abertura imutável, uma por organização.
- `FinancialLedgerEntry`: fato financeiro com `sourceKey`, sequência, tipo, valor, data efetiva, indicador de evidência verificada, ligações a pedido/pagamento/cobrança/transação, fingerprint e metadados.
- `FinancialClosing`: revisão e snapshot das duas fontes, hashes, contagem/sequência do ledger, diferenças, incidentes e publicação.
- `FinancialIncident`: divergências persistentes, com resolução identificada e justificada.
- `FinancialLedgerAudit`: registro imutável de abertura, lançamento, correção, classificação de saque, resolução e publicação.

O PostgreSQL impede valores não positivos, tipo/conta/sinal incompatíveis, referências a pedido de outra organização e pagamento de outro pedido. `UNIQUE(organizationId, sourceKey)` garante unicidade também para requisições concorrentes. Entradas, abertura e auditoria não aceitam UPDATE, DELETE ou TRUNCATE. O histórico de fechamentos não pode ser apagado; depois da reconciliação, seu snapshot fica congelado, e depois da publicação o registro inteiro fica imutável.

Uma correção cria uma compensação `REVERSAL` exata, ligada ao lançamento original, e um novo fato. O original permanece disponível. Uma origem só pode ser compensada uma vez. A correção, a compensação, o substituto e a auditoria são gravados na mesma transação. O cálculo considera os efeitos das compensações e não mantém bloqueio de evidência sobre um lançamento já substituído por uma correção verificada.

Não é uma proteção contra um administrador do PostgreSQL que possa desabilitar triggers ou alterar o esquema. A conta usada pela aplicação deve ter privilégios mínimos na operação definitiva.

## Integração com pagamentos

`handlePaymentWebhook` chama `recordOrderFinancialState` **dentro da mesma transação Serializable** que atualiza pedido, pagamento e estorno. Se a gravação falhar, a transação inteira falha; não há aprovação do pagamento separada da gravação do fato financeiro. Chamadas repetidas passam pelo mesmo registro idempotente, incluindo retorno de pagamento já aprovado.

A captura automática só começa para organizações com abertura configurada. Vendas anteriores à abertura não são reimportadas como vendas novas. Não existe backfill implícito de saldos anteriores.

A combinação `order:<id>:<tipo>` identifica componentes da venda; incrementos de estorno incluem o total acumulado. Mesmo `sourceKey` com valores diferentes preserva o primeiro fato e gera `DUPLICATE_SOURCE_CONFLICT`. Uma data de estorno ausente ou com múltiplas datas possíveis gera observação não verificada e incidente; não se apresenta o horário de chegada do webhook como data de liquidação comprovada. Uma repetição sem incremento não exige uma nova data de estorno.

## Fonte Asaas e conciliação

`asaas-source.ts` expõe somente consultas GET. Consulta a wallet primeiro e compara sua identidade com a abertura. Em seguida consulta o catálogo de cobranças e o extrato financeiro completo do intervalo. Hosts são limitados às APIs oficiais Asaas, redirecionamentos são recusados e credenciais não fazem parte do snapshot persistido.

Paginação exige total estável, IDs únicos e quantidade completa, limitada a 50 mil registros por catálogo. Mudança de contagem, resposta incompleta, falha de credencial ou erro de rede produz fechamento BLOCKED com evidência de indisponibilidade. Não há uso da chave de outra organização como prova de saldo correto.

O saldo histórico é obtido do campo `balance` do último registro do extrato, quando disponível. **O saldo atual de `/finance/balance` não substitui o saldo de uma data passada.** Se o extrato retornado não trouxer essa evidência, o fechamento permanece bloqueado. Este comportamento foi testado com respostas controladas; disponibilidade e semântica do campo na conta real ainda precisam ser verificadas na homologação.

O motor verifica:

- Pedido pago sem cobrança e cobrança paga sem pedido.
- Valor bruto, data de pagamento, decomposição de principal/taxa/juros e estornos acumulados, também por pedido para impedir que diferenças se compensem no agregado.
- Caixa versus movimentos e saldo bancário; custos, splits e recebíveis separados.
- IDs duplicados, sinal invertido, tipo bancário desconhecido, falta de data e evidência não verificada.
- Saque classificado por ID de transação: produtor e bilheteria devem somar exatamente o débito bancário.
- Principal sem cobertura de caixa. Recebíveis futuros permanecem separados e não são tratados como dinheiro disponível.

Tipos novos do Asaas, antecipações, reversões de transferência e estornos de vendas anteriores à abertura exigem análise. Eles bloqueiam publicação; não são classificados por suposição. A resolução textual de um incidente não ignora uma divergência ainda existente: uma nova conciliação a detectará novamente. Para tipos não suportados, é necessário ampliar e testar as regras antes de publicar o fechamento correspondente.

A leitura externa ocorre antes da transação de gravação. O snapshot registra a evidência observada naquele momento; não representa um bloqueio transacional na infraestrutura Asaas. Mudanças posteriores no provedor exigem outra conciliação.

Referências oficiais utilizadas: [Extrato financeiro](https://docs.asaas.com/reference/retrieve-extract), [Listagem de cobranças](https://docs.asaas.com/reference/list-payments), [Wallet ID](https://docs.asaas.com/reference/retrieve-walletid), [Saldo atual](https://docs.asaas.com/reference/retrieve-account-balance).

## Estados e publicação

Fluxo: `DRAFT → BLOCKED` ou `DRAFT → RECONCILED → PUBLISHED`. Uma nova tentativa cria outra revisão; não sobrescreve a evidência de uma tentativa anterior.

Qualquer diferença de **1 centavo**, incidente pendente ou evidência incompleta impede RECONCILED/PUBLISHED. Publicar exige OWNER, fechamento reconciliado, hash atual do ledger igual ao snapshot e ausência de incidentes pendentes. Banco e serviço serializam operações pelo registro da conta. O banco também verifica contagem/sequência antes de publicar. Não é permitido inserir um fechamento diretamente como PUBLISHED.

Lançamento retroativo após publicação gera `LATE_ENTRY_AFTER_PUBLICATION`. O documento publicado não é reescrito; é necessária revisão posterior auditada. Transações do serviço financeiro usam Serializable com até três novas tentativas para conflitos P2034. A rotina não publica automaticamente.

## Rotas e integração futura com a interface

### `/api/admin/finance/ledger`

GET: últimos 30 fechamentos e 100 incidentes pendentes da organização autenticada.

POST: sessão administrativa com acesso financeiro a todos os eventos, organização ativa `tcr-ingressos` e Origin igual ao da requisição. Apenas `reconcile` está disponível a usuário financeiro que não seja OWNER. Demais operações exigem OWNER.

```json
{ "operation": "reconcile", "date": "2026-09-24" }
```

Operações adicionais:

- `configure`: `opening` com `providerAccountId`, `startsOn`, `openingCashInCents`, `openingProducerInCents`, `openingReceivablesInCents`, `openingEvidence`.
- `publish`: `closingId`.
- `correct`: `entryId`, `reason`, `replacement` contendo `sourceKey` novo, `type`, `amountInCents` positivo, `effectiveDate`, `verified`, `evidence` e referências/metadados aplicáveis.
- `allocate-withdrawal`: `transactionId`, `producerInCents`, `evidence`. A diferença é atribuída à bilheteria; classificação anterior divergente gera incidente, não sobrescrita.
- `resolve-incident`: `incidentId`, `evidence`; exige nova conciliação para criar revisão publicável.

A rota não aceita snapshot fornecido pelo cliente nem organizationId arbitrário. Campos BIGINT da resposta são strings decimais em centavos. Respostas usam `Cache-Control: no-store`. Erros de validação retornam 400, falta de autorização 403, operação bloqueada 409.

### `/api/maintenance/reconcile-financial-ledger`

GET diário do Vercel Cron com `Authorization: Bearer <CRON_SECRET>`, conciliando automaticamente o dia anterior no fuso `America/Sao_Paulo`. O POST autenticado com corpo `{"date":"AAAA-MM-DD"}` continua disponível para manutenção de uma data específica. Comparação do segredo em tempo constante; segredo ausente falha fechado. Organização fixa TCR; a rota apenas concilia e nunca publica automaticamente.

## Ativação e limites operacionais

1. Em homologação, aplicar as migrações pendentes na ordem e gerar o Prisma Client. O código depende das tabelas novas; aplicar a migração antes da implantação do código.
2. Validar a identidade da wallet, permissões GET, formato real do extrato e disponibilidade de saldo histórico.
3. Documentar e conferir os três saldos de abertura. Configuração de abertura é imutável; não inventar valores para destravar uma conciliação.
4. Conciliar um dia com valores conhecidos, conferir a evidência persistida e provocar uma divergência de 1 centavo para confirmar o bloqueio.
5. Conectar posteriormente interface/exportação ao estado PUBLISHED. **Este trabalho de backend não altera nem afirma que as telas/exportações existentes já consumam o novo ledger.**
6. A conciliação automática está agendada para 00h10 de São Paulo (03h10 UTC). A transação financeira tem limite de 30 segundos; o webhook conserva seu limite existente de 10 segundos. A ativação depende da configuração auditada dos saldos de abertura.

A correção genérica exige revisão consciente: qualquer lançamento substituto continua sujeito à conciliação independente com pedidos e Asaas. O sistema não promete ausência de todo erro futuro; torna os casos cobertos detectáveis, bloqueia publicação e preserva evidências de correção.

## Validação

- Testes de regras, valores exatos, estornos, idempotência, concorrência de inserções, conflitos de origem e autorização de API.
- Migração executada em PostgreSQL isolado via PGlite, incluindo triggers, unicidade, referências de organização, compensação única, estados e publicação obsoleta.
- PGlite testa SQL real e inserções simultaneamente solicitadas, mas não substitui teste de carga com múltiplas conexões/processos PostgreSQL de produção.
- `npm run test:finance-safety`, `npm run test:payment-safety`, `npm run test:whatsapp-safety`, validação Prisma, TypeScript e build de produção local.
- Nenhuma escrita ou migração no banco de produção; nenhuma chamada financeira mutante ao Asaas.

### Resultado da execução local

`npm run build` concluído com sucesso: **128 testes aprovados** (34 de pagamentos, 91 financeiros/webhooks e 3 de WhatsApp), geração do Prisma Client, compilação Next.js, TypeScript e geração das páginas. A suíte inclui 40 testes novos do ledger; oito executam a migração e suas restrições em PostgreSQL isolado. `prisma validate` também passou.

O build mantém avisos preexistentes de rastreamento amplo de arquivos em `apple-local-dns-status.service.ts`; não houve erro de compilação. Esses avisos não foram alterados pelo trabalho financeiro.
