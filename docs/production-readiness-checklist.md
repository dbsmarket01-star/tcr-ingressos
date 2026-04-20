# Checklist de Produção - TCR Ingressos

## Deploy e domínio
- Domínio público configurado com HTTPS
- Subdomínio interno do painel configurado
- `APP_URL` e `NEXT_PUBLIC_APP_URL` apontando para o domínio final
- `ADMIN_HOST` configurado para isolar `/admin` e `/login`
- Health check respondendo em produção

## Banco, mídia e infraestrutura
- `DATABASE_URL` e `DIRECT_URL` configuradas
- Pooling do banco habilitado
- Supabase em plano de produção
- Storage de imagens em produção validado
- Backup do banco conferido

## Pagamentos
- Asaas em produção
- `ASAAS_API_KEY` configurada
- Webhook do Asaas atualizado para o domínio definitivo
- Split configurado com `walletIds` e regras válidas
- Compra Pix real aprovada
- Compra com cartão real aprovada

## Evento e checkout
- Evento publicado com banner, descrição e local corretos
- Lotes ativos e com estoque correto
- Taxas e juros revisados
- Desconto no Pix revisado, se estiver em uso
- CTA da página pública claro no desktop e no mobile
- Nenhum ingresso pré-selecionado automaticamente

## Pós-compra e suporte
- E-mail transacional chegando com QR Code
- Tela do pedido exibindo Pix, cartão e totais corretamente
- Botão de suporte no WhatsApp funcionando na página do evento
- Botão de suporte no WhatsApp funcionando no pedido pendente
- Ingresso individual abrindo corretamente

## Operação e portaria
- Check-in validando QR Code em celular real
- Releitura do mesmo ingresso bloqueada
- Pedido pendente expirando e devolvendo estoque
- Reembolso manual cancelando ingressos e devolvendo estoque
- Auditoria registrando ações críticas

## Antes de tráfego pago
- Pixel e GTM configurados no evento real
- Teste completo em Android
- Teste completo em iPhone
- Pedido de suporte simulado: “não recebi meu ingresso”
- Equipe alinhada sobre cancelamento, reembolso e check-in
