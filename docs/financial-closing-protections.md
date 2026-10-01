# Proteções de cálculo e conferência financeira

## Causa comprovada e limite da investigação

O print de 24/09 demonstra `1.484.203 - 758.810 = 725.393` centavos. A entrada deveria ter sido somada: `1.484.203 + 758.810 = 2.243.013`. A diferença local é de **1.517.620 centavos (R$ 15.176,20)**, o dobro da entrada. As linhas seguintes transportaram o saldo errado.

Esse cálculo isola o erro de sinal usando o saldo anterior impresso. Não substitui o saldo final auditado, que também considera ajustes de estornos e abertura. Evidência: `relatorios/explicacao-rastreio-9315-2026-09-29.md` e auditoria diária subsequente.

Não foi encontrada fórmula de fechamento acumulado no relatório de vendas da aplicação. O print não contém a fórmula original nem o histórico de edição. Portanto, ainda não é possível atribuir a causa a uma pessoa, fórmula digitada, importação ou versão de código. Para concluir a causa raiz é necessário o arquivo original e seu histórico. A proteção implementada cobre o mecanismo demonstrado e outros riscos encontrados; não prova a origem do incidente.

## Implementado no código

- `producer-closing.ts`: valores positivos em centavos inteiros seguros; o tipo define o sinal. Venda e ajuste de crédito somam; estorno, repasse e ajuste de débito subtraem. Datas inválidas, movimentos fora do período, campos desconhecidos e origens repetidas são recusados. Cada registro exige referência de evidência.
- O fechamento calcula todos os dias, inclusive sem movimento. O saldo informado anteriormente é apenas comparado, nunca utilizado para calcular o próximo dia. Uma segunda soma sobre todo o razão verifica o transporte diário. Divergências ou abertura/fontes não verificadas produzem `BLOCKED`.
- `financial-integrity.ts`: os pedidos são conferidos contra os totais e os agrupamentos por evento, pagamento e origem. Detecta pedidos repetidos, valores inválidos, diferença de centavos e decomposição incorreta de principal, taxa e juros. A origem de estornos maiores que o total também é sinalizada antes do rateio.
- O relatório consulta suas fontes numa transação `RepeatableRead`, evitando misturar fotografias diferentes do banco durante uma atualização de pagamento. Essa consistência é do banco da aplicação; não sincroniza automaticamente o extrato Asaas.
- A página mostra a inconsistência e retira o link do PDF. As rotas financeiras CSV e PDF retornam HTTP 409 em vez de exportar um relatório aritmeticamente inconsistente. Isso cobre essas rotas; não bloqueia planilhas ou documentos externos.
- A interface e os arquivos distinguem composição atual das vendas de fechamento de caixa. Principal, taxa cobrada, split configurado e dinheiro disponível são conceitos distintos. Estornos exibidos por data de registro não são um segundo débito a subtrair dos pedidos já líquidos.
- O processamento de estorno agora só aumenta o valor acumulado por cobrança. Notificações repetidas ou antigas não sobrescrevem o valor maior já registrado. Preserva a chave única `(orderId, externalPaymentId)` e a transação `Serializable` existentes. Não altera o provedor nem cria novos estornos.
- A suíte `test:finance-safety` faz parte do comando de build, cobrindo o incidente, transporte, estornos, duplicidade, notificações fora de ordem e bloqueio dos dois formatos de exportação.

## Uso do verificador de fechamento

```sh
npm run --silent finance:reconcile -- docs/examples/closing-2026-09-24.json
```

O exemplo retorna `BLOCKED` e código de saída 1 intencionalmente. Mostra a divergência de −1.517.620 centavos nos dois dias. Ele não autoriza publicação do saldo do print nem substitui a auditoria completa.

O arquivo de entrada identifica organização, escopo, período, abertura, evidências, movimentos e saldos publicados. Use uma chave estável por fato econômico, por exemplo `refund:<id-do-estorno>:principal`, e a data financeira efetiva comprovada. Não use a data de recebimento do webhook como substituta da data efetiva. Uma venda já líquida não deve ser lançada junto de um estorno que já foi abatido nela. Para vários estornos da mesma cobrança, envie os incrementos individuais identificados, não várias versões acumuladas.

`verified: true` é uma declaração do responsável que preparou a entrada após conferir os documentos; não é uma verificação automática do Asaas. Não marque verdadeiro para apenas eliminar o bloqueio. `RECONCILED_INPUT` significa que a entrada declarada passou nas verificações, não que o banco foi conciliado ou que um repasse está autorizado. `bankReconciled` permanece falso.

O resultado inclui data de execução e SHA-256 do arquivo para rastrear qual entrada foi usada. O hash não é assinatura digital nem armazenamento imutável. Guarde entrada, saída e documentos de origem juntos. O comando apenas lê arquivos e calcula; não grava dados financeiros nem publica o fechamento.

## Limites e operação

Validação local: 51 testes da suíte financeira/webhooks e 34 testes de segurança de pagamentos passaram. A checagem TypeScript e a compilação de produção do Next.js concluíram. O build apontou três avisos no módulo preexistente de DNS local sobre rastreamento amplo de arquivos. O exemplo executável retornou o bloqueio esperado. Os testes de transação usam mocks: não foi simulado um conflito concorrente real no PostgreSQL nem uma liquidação bancária real.

As alterações são locais até serem implantadas. Não foi realizada migração ou mutação de registros de produção nesta implementação. O modelo de estornos usado pelas proteções já estava presente no trabalho em andamento; a implantação precisa incluí-lo caso ainda não exista no ambiente de destino.

Ainda não há integração automática de extrato bancário, ledger financeiro imutável ou tela de publicação de fechamento conciliado. O verificador é uma ferramenta de conferência executável, não um novo sistema de escrituração. O relatório de vendas continua refletindo os estornos conhecidos na consulta; não é uma reconstrução histórica por data efetiva.

Nenhum controle elimina todos os erros. Estes controles detectam as classes testadas; a completude e a classificação econômica das fontes exigem conciliação. Para automatizar o fechamento bancário, é necessário fornecer uma fonte autorizada de extratos, mapear titularidade de repasses e comprovar o saldo inicial, mantendo separados competência e caixa.

## Texto para o sócio e o produtor

“Identificamos uma divergência de sinal no fechamento de 24/09: uma entrada de R$ 7.588,10 foi subtraída quando deveria ter sido somada. Isso reduziu o saldo apresentado em R$ 15.176,20 e afetou os saldos seguintes. A diferença não representa, por si só, uma saída de dinheiro; é um erro no cálculo apresentado. A auditoria também separou os ajustes de estornos e de abertura. Estamos acrescentando controles que recalculam os saldos pelos movimentos, detectam duplicidades e bloqueiam exportações inconsistentes. A origem exata da alteração depende da planilha original e do histórico de versões. Os controles de código ainda precisam ser implantados antes de valerem no sistema em produção.”
