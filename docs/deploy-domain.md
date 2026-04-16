# Deploy em dominio real - TCR Ingressos

Este roteiro prepara a TCR Ingressos para sair do `localhost` e operar uma pre-venda controlada em dominio real.

## 1. Escolher hospedagem

Opcao recomendada para a primeira operacao:

- Vercel para hospedar o Next.js.
- Supabase para banco Postgres.
- Supabase Storage para banner, mapa e imagens SEO.
- Dominio proprio apontado para a Vercel.

Outras opcoes possiveis:

- Vercel/servidor serverless: rapido para publicar Next.js, mas uploads locais nao sao persistentes. Antes de vender, migrar banners, mapas e imagens SEO para Supabase Storage, S3 ou CDN.
- VPS/servidor Node.js com disco persistente: permite manter `public/uploads` na primeira etapa, desde que exista backup do disco e processo Node estavel.
- Render/Fly/Railway ou similar: validar se o plano tem disco persistente antes de usar upload local.

Decisao pratica: vamos seguir com Vercel + Supabase Storage. Isso evita depender de disco local e deixa imagens servidas por URL publica.

## 2. Variaveis de ambiente em producao

No painel do provedor de deploy, cadastrar as variaveis reais:

- `NODE_ENV=production`
- `APP_URL=https://seudominio.com.br`
- `NEXT_PUBLIC_APP_URL=https://seudominio.com.br`
- `AUTH_SECRET` forte e exclusivo
- `CRON_SECRET` forte e exclusivo
- `DATABASE_URL` do Supabase com pooling
- `DIRECT_URL` do Supabase para migracoes
- `PAYMENT_PROVIDER=ASAAS`
- `ASAAS_API_URL=https://api.asaas.com/v3`
- `ASAAS_API_KEY` de producao
- `ASAAS_WEBHOOK_TOKEN` igual ao token configurado no painel Asaas
- `RESEND_API_KEY`
- `EMAIL_FROM=TCR Ingressos <ingressos@seudominio.com.br>`
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, se o login Google ficar ativo
- `UPLOAD_STORAGE_PROVIDER=SUPABASE_STORAGE`
- `SUPABASE_URL=https://PROJECT_REF.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=event-media`

Nao colocar segredo real em arquivo versionado.

## 3. Banco Supabase

- Usar um projeto Supabase exclusivo da TCR.
- Confirmar `DATABASE_URL` com `pgbouncer=true` e `connection_limit=1`, ou configuracao equivalente.
- Confirmar `DIRECT_URL` para migracoes.
- Rodar migracoes no banco de producao antes da primeira venda.
- Conferir backup e acesso administrativo do Supabase.
- Para outra bilheteria futura, como Elo Conference, criar novo banco e nova instalacao.

## 4. Dominio e HTTPS

- Apontar o dominio para o provedor de deploy.
- Aguardar HTTPS ativo.
- Confirmar:
  - `https://seudominio.com.br/api/health`
  - `https://seudominio.com.br/robots.txt`
  - `https://seudominio.com.br/sitemap.xml`
  - pagina publica do evento
  - painel administrativo com login

## 5. Webhook Asaas definitivo

No painel Asaas, trocar qualquer URL temporaria por:

```text
https://seudominio.com.br/api/webhooks/payments/asaas?token=SEU_ASAAS_WEBHOOK_TOKEN
```

Depois testar:

- Pix real aprovado por webhook.
- Cartao real aprovado por webhook.
- Pedido recusado ou falho.
- Pedido pendente expirado.
- Split registrado no Asaas quando houver regra ativa.

## 6. Cron de expiracao de reservas

Agendar uma chamada a cada 5 minutos:

```text
https://seudominio.com.br/api/maintenance/expire-orders?token=SEU_CRON_SECRET
```

Alternativa com header:

```text
Authorization: Bearer SEU_CRON_SECRET
```

Essa rotina libera estoque de pedidos pendentes vencidos.

## 7. Midia de eventos

Antes de trafego pago, confirmar no dominio final:

- banner do topo
- enquadramento do banner
- imagem do mapa
- imagem SEO/compartilhamento
- pagina mobile

Para Vercel, usar:

```text
UPLOAD_STORAGE_PROVIDER=SUPABASE_STORAGE
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=event-media
```

No Supabase, criar um bucket publico chamado `event-media` para banners, mapas e imagens SEO.
O sistema envia as imagens pelo backend usando `SUPABASE_SERVICE_ROLE_KEY`, entao essa chave nunca deve ir para o navegador.

Se o deploy nao preservar arquivos enviados, o upload local nao deve ser usado em venda real.

## 8. Checklist minimo antes de anunciar

- 1 compra Pix real aprovada.
- 1 compra cartao real aprovada.
- Webhook do Asaas funcionando sem verificacao manual.
- E-mail de pedido recebido.
- E-mail de ingresso com QR Code recebido.
- Check-in valido em celular real.
- Reutilizacao do QR Code bloqueada.
- Exportacao CSV conferida.
- Rotina de expiracao rodando.
- Pixel/GTM configurados no evento real.
