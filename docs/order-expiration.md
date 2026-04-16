# Expiracao de pedidos

Pedidos pendentes reservam estoque por 15 minutos. Quando o prazo vence, o sistema muda o pedido para
`EXPIRED`, cancela o pagamento local pendente e devolve a quantidade reservada para o lote.

## Onde a liberacao acontece

- Ao abrir a pagina publica de um evento.
- Ao abrir a pagina administrativa de pedidos.
- Ao abrir um pedido especifico.
- Ao clicar em `Liberar reservas vencidas` no painel de pedidos.
- Pela rota de manutencao:

```txt
GET /api/maintenance/expire-orders
POST /api/maintenance/expire-orders
```

## Seguranca da rota

Em producao, configure:

```env
CRON_SECRET="token-forte"
```

Depois chame a rota com um dos formatos:

```txt
Authorization: Bearer token-forte
```

ou:

```txt
https://seudominio.com.br/api/maintenance/expire-orders?token=token-forte
```

## Pagamento depois da expiracao

Se um pagamento atrasado chegar por webhook, o sistema tenta confirmar o pedido somente se ainda
houver estoque livre no lote. Isso protege contra venda acima da capacidade.
