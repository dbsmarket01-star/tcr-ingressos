# Plano de infraestrutura - TCR Ingressos

Este documento define a infraestrutura recomendada para tirar a TCR Ingressos do MVP local e operar venda real com mais estabilidade.

## Objetivo atual

Operar eventos da TCR com:

- pagina publica rapida;
- checkout Pix e cartao;
- webhook Asaas confiavel;
- emissao de ingresso com QR Code;
- painel administrativo estavel;
- check-in em celular;
- capacidade inicial para pre-venda e trafego pago controlado.

## Camada recomendada agora

Para a primeira operacao real, a recomendacao e:

- Aplicacao: Vercel Pro.
- Banco: Supabase Pro/Postgres.
- Storage: Supabase Storage.
- Pagamentos: Asaas Producao.
- E-mail: Resend com dominio autenticado.
- Dominio: `https://www.tcringressos.app.br`.
- Cron: chamada externa a cada 5 minutos para expirar reservas.
- Monitoramento: health check, logs Vercel/Supabase/Asaas e rotina de revisao antes de trafego.

Essa arquitetura e profissional para o momento atual porque reduz manutencao de servidor, aproveita CDN/deploy automatico da Vercel e mantem o banco em Postgres real.

## Banco e indices operacionais

As consultas criticas precisam de indices no Postgres. O projeto declara estes indices no Prisma e tambem fornece o SQL direto em:

```text
prisma/production-indexes.sql
```

Indices mais importantes:

- pedidos por `status + expiresAt`, para expirar reservas sem varrer a tabela inteira;
- pedidos por `createdAt`, para painel/listagens recentes;
- pagamentos por `externalId`, para webhooks e sincronizacao com Asaas;
- pagamentos por `status + updatedAt`, para auditoria e acompanhamento operacional.

Quando o banco ja estiver em producao, aplique indices com cuidado e confira no Supabase se foram criados.

## Variaveis de ambiente de producao

Configure no provedor:

```env
NODE_ENV=production
HOSTING_PROVIDER=VERCEL
HOSTING_PLAN=VERCEL_PRO
DATABASE_PROVIDER=SUPABASE
DATABASE_PLAN=SUPABASE_PRO
NEXT_PUBLIC_APP_URL=https://www.tcringressos.app.br
APP_URL=https://www.tcringressos.app.br
UPLOAD_STORAGE_PROVIDER=SUPABASE_STORAGE
SUPABASE_STORAGE_BUCKET=event-media
PAYMENT_PROVIDER=ASAAS
ASAAS_API_URL=https://api.asaas.com/v3
```

Tambem devem existir, com valores reais e secretos:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `CRON_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Rotina de expiracao de reservas

Pedidos pendentes seguram estoque por tempo limitado. A rota abaixo precisa ser chamada a cada 5 minutos:

```text
https://www.tcringressos.app.br/api/maintenance/expire-orders?token=SEU_CRON_SECRET
```

No plano Hobby da Vercel, cron frequente pode nao estar disponivel. Use uma ferramenta externa de cron ou o plano Pro.

## O que Vercel Pro resolve

- Mais capacidade operacional para Next.js.
- Menos limites de hobby.
- Melhor base para producao com dominio, deploy e logs.
- Mais seguranca para operar campanhas sem depender de ambiente gratuito.

Vercel Pro nao substitui otimizacao de banco, imagens, consultas e rotinas de pagamento.

## O que Supabase Pro resolve

- Banco Postgres com mais folga operacional.
- Backups e recursos de producao.
- Menor risco de limite gratuito atrapalhar venda.
- Storage mais adequado para banners, mapas e imagens SEO.

O banco continua sendo o ponto mais sensivel do sistema. Estoque, pedidos, pagamentos e ingressos dependem dele.

## Quando pensar em AWS

AWS faz sentido quando a TCR precisar de mais controle ou volume, por exemplo:

- Redis dedicado para cache/reservas;
- filas para e-mail, ingresso e webhooks;
- workers separados da aplicacao web;
- Postgres dedicado em RDS;
- S3/CloudFront para midia em escala;
- balanceador de carga e containers;
- observabilidade avancada;
- controle fino de custo em alto volume.

Nao e a melhor primeira etapa se ainda nao existe equipe/rotina de DevOps. Comecar em Vercel Pro + Supabase Pro e manter o codigo organizado preserva a possibilidade de migrar depois.

## Criterio minimo antes de trafego pago

- Health check respondendo `ok`.
- Dominio final com HTTPS.
- APP_URL e NEXT_PUBLIC_APP_URL no dominio final.
- Banco em plano de producao.
- Upload em Supabase Storage.
- Webhook Asaas no dominio final.
- Cron de expiracao rodando.
- Pix real aprovado.
- Cartao real aprovado.
- Split conferido no Asaas.
- E-mail de ingresso recebido.
- QR Code validado e reutilizacao bloqueada.
