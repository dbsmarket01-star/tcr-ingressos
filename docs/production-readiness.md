# Producao assistida - TCR Ingressos

Este roteiro deve ser concluido antes de abrir trafego pago para venda real.

## Deploy

- Usar tambem o roteiro detalhado em `docs/deploy-domain.md`.
- Usar tambem o plano de infraestrutura em `docs/infrastructure-plan.md`.
- Para primeira operacao real, recomendacao atual: Vercel Pro + Supabase Pro + Supabase Storage.
- Configurar dominio definitivo com HTTPS.
- Copiar `.env.example` como base e preencher as variaveis reais no provedor de deploy.
- Configurar `NEXT_PUBLIC_APP_URL` e `APP_URL` com o dominio final.
- Configurar `HOSTING_PROVIDER=VERCEL` e `HOSTING_PLAN=VERCEL_PRO` depois do upgrade.
- Configurar `AUTH_SECRET` forte e exclusivo da instalacao.
- Configurar `CRON_SECRET` forte.
- Agendar `/api/maintenance/expire-orders?token=SEU_CRON_SECRET` a cada 5 minutos.
- A rotina pode rodar a cada 5 minutos, mas o prazo real de reserva e interno e configurado em `/admin/settings`.
- Por padrao, pedidos seguram estoque por 120 minutos; ajuste conforme a estrategia do evento.
- Confirmar que `/robots.txt` e `/sitemap.xml` respondem no dominio final.
- Confirmar que `/api/health` responde `status: ok` no dominio final.
- Confirmar que `/admin`, `/api`, `/login`, `/pedido` e `/ingresso` nao devem ser indexados.
- Rodar `npm run build` antes de publicar.

## Banco e ambiente

- Usar banco Supabase/Postgres exclusivo da TCR.
- Para operacao real, usar Supabase Pro ou Postgres gerenciado equivalente.
- Configurar `DATABASE_PROVIDER=SUPABASE` e `DATABASE_PLAN=SUPABASE_PRO` depois do upgrade.
- Nao reutilizar banco da TCR em outra bilheteria/produtora.
- Para Elo Conference ou outra operacao, criar nova instalacao com novo banco, novas variaveis e novo dominio.
- Conferir backups e acesso administrativo do Supabase.
- Conferir `DATABASE_URL` com pooling para a aplicacao.
- Conferir `DIRECT_URL` para migracoes Prisma.
- Rodar migracoes Prisma no banco de producao antes da primeira venda.

## Imagens e midia

- O painel permite upload de banner e mapa do evento.
- O painel permite upload da imagem SEO/compartilhamento do evento.
- O banner possui controle de enquadramento para topo, centro, base, esquerda ou direita.
- O limite de Server Actions esta ajustado para aceitar imagens ate 10MB.
- O mapa pode usar imagem propria ou modelos de setores sem cadeira numerada.
- `UPLOAD_STORAGE_PROVIDER=LOCAL` funciona para desenvolvimento e servidor com disco persistente.
- `UPLOAD_STORAGE_PERSISTENT=true` deve ser usado apenas quando o servidor realmente preserva arquivos enviados.
- Em ambiente local ou servidor proprio com disco persistente, os arquivos ficam em `/public/uploads`.
- Se o deploy for em ambiente sem disco persistente, como serverless/Vercel, migrar uploads para Supabase Storage, S3 ou CDN antes de operar vendas reais.
- Conferir se banner, mapa do evento e imagem SEO aparecem no dominio final.

## Pagamento Asaas

- Configurar `PAYMENT_PROVIDER=ASAAS`.
- Configurar `ASAAS_API_KEY` de producao quando for vender publicamente.
- Configurar `ASAAS_API_URL` de producao.
- Configurar webhook no Asaas apontando para:
  - `/api/webhooks/payments/asaas?token=...`
- Conferir `ASAAS_WEBHOOK_TOKEN`.
- O webhook definitivo deve usar o dominio final, nao URL temporaria de tunnel.
- Testar Pix real.
- Testar cartao real.
- Testar pagamento recusado.
- Testar pedido expirado.
- Testar tentativa de compra sem estoque suficiente e confirmar que a pagina mostra erro amigavel.
- Confirmar protecao de tentativas repetidas no checkout/pagamento e, em producao, reforcar com WAF/proxy quando houver trafego pago alto.
- Testar confirmacao por webhook sem clicar em "Verificar pagamento".
- Para split automatico, configurar regras em `/admin/settings`.
- Cada regra de split pode ser porcentagem, valor fixo por pedido ou valor fixo por ingresso vendido.
- Para valor por ingresso, conferir se um pedido com multiplos ingressos multiplica o repasse corretamente.
- Fazer compra teste com split e conferir extrato/repasse dentro do Asaas antes de vender publicamente.

## E-mail

- Configurar `RESEND_API_KEY`.
- Configurar `EMAIL_FROM`.
- Autenticar dominio de envio com SPF/DKIM/DMARC.
- Testar e-mail de pedido pendente.
- Testar e-mail de ingresso aprovado.
- Testar reenvio de ingresso pelo suporte.
- Testar reenvio de link de pagamento para pedido pendente pelo atendimento.
- Testar busca no atendimento por pedido, e-mail, CPF/telefone e codigo de ingresso.

## Login Google no checkout

- Configurar `GOOGLE_CLIENT_ID`.
- Configurar `GOOGLE_CLIENT_SECRET`.
- Cadastrar callback de producao no Google Cloud:
  - `/api/auth/google/callback`
- Conferir se o botao Google preenche nome e e-mail do comprador.

## Operacao

- Criar usuarios internos com papeis corretos.
- Criar usuario de portaria/check-in.
- Conferir permissao de financeiro apenas para quem deve ver valores e exportacoes.
- Testar check-in em celular real.
- Testar ingresso valido.
- Testar ingresso ja usado.
- Testar ingresso invalido.
- Testar exportacao CSV de pedidos e ingressos.
- Testar exportacao CSV do financeiro e conferir bruto, taxas, descontos, juros e liquido aproximado.
- Comparar liquido aproximado do sistema com o liquido informado pelo Asaas no extrato.
- Testar cancelamento manual de pedido pendente.

## Trafego pago

- Confirmar Meta Pixel e Google Tag Manager no evento.
- Criar compra teste com UTM.
- Conferir origem/campanha nos pedidos.
- Conferir `event_id`/codigo do pedido nos eventos de checkout e compra para reduzir duplicidade de conversao.
- Confirmar que a pagina publica carrega rapidamente no celular.

## Criterio minimo para primeira venda real

- 1 compra Pix real aprovada.
- 1 compra cartao real aprovada.
- 1 QR Code lido com sucesso.
- 1 tentativa de reutilizacao bloqueada.
- 1 e-mail de ingresso recebido.
- 1 exportacao CSV conferida.
- Rotina de expiracao rodando com token.
