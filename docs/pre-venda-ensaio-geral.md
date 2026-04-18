# Ensaio geral de pre-venda - TCR Ingressos

Use este roteiro antes de abrir trafego pago. A ideia e simular uma venda real de ponta a ponta, com poucas pessoas, antes de divulgar para o publico.

## 1. Preparacao do evento

- Evento publicado no dominio final.
- Banner, mapa, descricao, local e data conferidos no desktop e celular.
- Lotes ativos com quantidade, taxa, juros do cartao e destaque revisados.
- Cupom de teste criado, se o evento for usar cupom.
- Meta Pixel e Google Tag Manager configurados no evento, se houver campanha.
- Pagina publica aberta pelo dominio final, nao por localhost.

## 2. Compra teste

Faca pelo menos estes testes:

- 1 compra Pix real.
- 1 compra cartao real em 1 parcela.
- 1 compra cartao real parcelada, se houver juros configurado.
- 1 compra com cupom.
- 1 tentativa com quantidade acima do estoque disponivel.
- 1 pedido criado e nao pago, para conferir expiracao interna depois.

Em cada compra, confira:

- Pedido criado com codigo TCR.
- Valor do ingresso, taxas e desconto corretos.
- Pix e cartao aparecem como opcoes separadas.
- Juros do cartao aparece apenas na escolha de parcelas.
- Webhook do Asaas atualiza o pedido sem acao manual.
- Ingresso com QR Code e gerado apos pagamento aprovado.

## 3. E-mail e suporte

- Comprador recebe e-mail de pedido pendente.
- Comprador recebe e-mail com ingresso aprovado e QR Code.
- Atendimento encontra o pedido por codigo, e-mail, CPF/telefone ou codigo do ingresso.
- Atendimento consegue reenviar ingresso ou link de pagamento, quando aplicavel.
- Mensagens de erro nao mostram detalhe tecnico para cliente final.

## 4. Check-in

Teste em celular real:

- QR Code valido entra como aprovado.
- Mesmo QR Code lido pela segunda vez aparece como ja utilizado.
- Codigo inexistente aparece como invalido.
- Ingresso cancelado ou pedido cancelado nao libera entrada.
- Operador de portaria consegue usar a tela com internet movel.

## 5. Financeiro e split

- Pedido aparece no painel financeiro.
- Pix e cartao aparecem separados nas metricas.
- Taxas, juros, desconto e total batem com o pedido.
- Split configurado aparece no Asaas.
- Quando o split for valor por ingresso, pedido com varios ingressos multiplica o repasse corretamente.
- Exportacao CSV de pedidos/ingressos abre corretamente.

## 6. Criterio para liberar pre-venda controlada

So avance para anuncio pequeno quando todos estes pontos estiverem OK:

- Pix aprovado e ingresso emitido.
- Cartao aprovado e ingresso emitido.
- E-mail recebido.
- QR Code validado.
- Reutilizacao bloqueada.
- Webhook Asaas funcionando no dominio final.
- Cron de expiracao ativo.
- Evento conferido no Android e iPhone.
- Suporte sabe localizar pedido e reenviar ingresso.

## 7. Primeira campanha pequena

Comece com volume controlado:

- Rodar campanha pequena por algumas horas.
- Acompanhar pedidos em tempo real.
- Conferir pagamentos pendentes e aprovados.
- Conferir logs do Asaas.
- Conferir se os clientes recebem e-mail.
- Pausar anuncio ao primeiro sinal de erro repetido.

