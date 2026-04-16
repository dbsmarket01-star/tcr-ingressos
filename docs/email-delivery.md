# Envio de ingressos por e-mail

A Fase 11 prepara o envio automatico de ingressos apos pagamento aprovado.

## Provedor

O provedor recomendado para comecar e Resend.

```env
RESEND_API_KEY=""
EMAIL_FROM="TCR Ingressos <ingressos@tcringressos.com.br>"
NEXT_PUBLIC_APP_URL="https://seudominio.com.br"
```

Enquanto `RESEND_API_KEY` nao estiver configurado, o sistema nao quebra o pagamento. Ele apenas registra no log do servidor quais ingressos seriam enviados.

## Fluxo

1. Pagamento aprovado por Pix, cartao ou webhook.
2. Sistema gera os ingressos.
3. Sistema monta os links publicos `/ingresso/[code]`.
4. Sistema envia e-mail ao comprador com os links dos ingressos.

## Observacao

Antes de producao, o dominio usado no `EMAIL_FROM` precisa estar validado no provedor de e-mail.
