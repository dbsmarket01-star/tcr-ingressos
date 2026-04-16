# Pagamentos

A Fase 10 prepara a TCR Ingressos para pagamento real, mantendo o provedor simulado para desenvolvimento.

## Provedor padrao

Enquanto `PAYMENT_PROVIDER` nao estiver definido, o sistema usa:

```env
PAYMENT_PROVIDER="SIMULATED"
```

Nesse modo, a pagina do pedido mostra botoes para simular pagamento aprovado ou falho.

## Provedores disponiveis

```env
PAYMENT_PROVIDER="SIMULATED"
PAYMENT_PROVIDER="MERCADO_PAGO"
PAYMENT_PROVIDER="ASAAS"
```

## Mercado Pago

Para ativar Checkout Pro do Mercado Pago:

```env
PAYMENT_PROVIDER="MERCADO_PAGO"
MERCADO_PAGO_ACCESS_TOKEN="APP_USR..."
MERCADO_PAGO_WEBHOOK_SECRET="chave-secreta-do-webhook"
NEXT_PUBLIC_APP_URL="https://seudominio.com.br"
MERCADO_PAGO_USE_SANDBOX_URL="false"
```

Em ambiente de testes, use as credenciais de teste do Mercado Pago e:

```env
MERCADO_PAGO_USE_SANDBOX_URL="true"
```

## Fluxo implementado

1. O cliente cria o pedido na pagina publica.
2. O estoque fica reservado por pedido pendente.
3. A pagina `/pedido/[code]` chama `startPaymentForOrder`.
4. O provedor cria a cobranca/preferencia de pagamento.
5. O sistema salva `externalId` e `checkoutUrl` no pagamento.
6. O cliente e redirecionado para o checkout externo.
7. O webhook `/api/webhooks/payments/mercado-pago` recebe a atualizacao.
8. O sistema confirma o pedido em transacao.
9. O estoque reservado vira estoque vendido.
10. Os ingressos sao emitidos automaticamente.

## Pontos importantes para producao

- Configurar `NEXT_PUBLIC_APP_URL` com o dominio final.
- Configurar o webhook no painel do Mercado Pago apontando para:

```txt
https://seudominio.com.br/api/webhooks/payments/mercado-pago
```

- Usar credenciais reais somente em ambiente seguro.
- Preencher `MERCADO_PAGO_WEBHOOK_SECRET` para validar a assinatura `x-signature`.
- Nunca expor `MERCADO_PAGO_ACCESS_TOKEN` no frontend.
- Testar PIX, cartao aprovado, cartao recusado e pagamento pendente antes de vender evento real.

## Asaas

Para ativar o Asaas:

```env
PAYMENT_PROVIDER="ASAAS"
ASAAS_API_KEY="$aact_..."
ASAAS_API_URL="https://api-sandbox.asaas.com/v3"
ASAAS_BILLING_TYPE="PIX"
ASAAS_WEBHOOK_TOKEN="token-configurado-no-webhook"
NEXT_PUBLIC_APP_URL="https://seudominio.com.br"
```

Em producao, altere `ASAAS_API_URL` para:

```env
ASAAS_API_URL="https://api.asaas.com/v3"
```

Com `ASAAS_BILLING_TYPE="PIX"`, o sistema gera QR Code Pix e copia e cola dentro da pagina do pedido.

O fluxo implementado para Asaas e:

1. Criar cliente no Asaas com nome, e-mail, CPF/CNPJ e telefone.
2. Criar cobranca vinculada ao pedido.
3. Salvar o `id` da cobranca como `externalId`.
4. Buscar QR Code Pix quando o tipo for `PIX`.
5. Exibir QR Code e Pix copia e cola direto na TCR Ingressos.
6. Receber webhook em `/api/webhooks/payments/asaas`.
7. Confirmar o pedido quando chegar `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED`.
8. Cancelar/falhar o pedido em eventos como `PAYMENT_DELETED`, `PAYMENT_REFUNDED` ou `PAYMENT_OVERDUE`.

Configure o webhook no painel do Asaas apontando para:

```txt
https://seudominio.com.br/api/webhooks/payments/asaas
```

Para mais seguranca, configure um token no webhook do Asaas e repita o mesmo valor em `ASAAS_WEBHOOK_TOKEN`.

### Split Asaas pelo painel

O split pode ser configurado direto no painel:

```txt
/admin/settings
```

Cada regra aceita:

- porcentagem da cobranca
- valor fixo por pedido
- valor fixo por ingresso vendido

Exemplo: se a regra for R$ 1,00 por ingresso e o pedido tiver 5 ingressos, o sistema envia R$ 5,00 de split para aquela carteira no Asaas.

O valor restante fica automaticamente na conta Asaas principal que emitiu a cobranca.

### Split Asaas por variavel de ambiente

As variaveis abaixo continuam existindo como fallback tecnico. Para operacao diaria, prefira o painel.

O split por ambiente fica desligado por padrao:

```env
ASAAS_SPLIT_ENABLED="false"
```

Quando tivermos os `walletId` dos socios/parceiros, podemos ativar:

```env
ASAAS_SPLIT_ENABLED="true"
ASAAS_SPLIT_WALLET_ID_1="wallet_id_socio_1"
ASAAS_SPLIT_PERCENTUAL_VALUE_1="10"

ASAAS_SPLIT_WALLET_ID_2="wallet_id_socio_2"
ASAAS_SPLIT_PERCENTUAL_VALUE_2="15"

ASAAS_SPLIT_WALLET_ID_3="wallet_id_socio_3"
ASAAS_SPLIT_FIXED_VALUE_3="20.00"
```

Importante: o painel de configuracoes mostra se o split esta ligado, quantas carteiras existem e quantas regras foram configuradas. Sem `walletId` e regra de percentual/valor fixo, o sistema cria a cobranca sem split.
