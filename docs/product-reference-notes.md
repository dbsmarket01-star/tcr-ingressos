# TCR Ingressos - Referencias de UX e operacao

Estas anotacoes usam bilheterias existentes apenas como referencia de padroes.
O objetivo nao e copiar visual, marca ou fluxo de terceiros, e sim definir o que faz sentido para a TCR Ingressos.

## Pagina publica do evento

A pagina publica e a tela de conversao principal. Ela deve responder rapidamente:

- o que e o evento;
- quando acontece;
- onde acontece;
- quais ingressos estao disponiveis;
- por que a pessoa deve comprar agora.

### Estrutura recomendada

- Hero com nome do evento, data, horario, local e chamada de parcelamento.
- Banner visual forte com imagem real do evento, artistas, palestrantes ou identidade da campanha.
- Conteudo principal com descricao, detalhes, informacoes importantes e mapa/setores quando fizer sentido.
- Coluna lateral de compra com lista de lotes, precos, cupom e CTA sempre visivel em desktop.
- Em mobile, compra deve ficar facil de acessar com botao fixo ou bloco logo apos o hero.

### Melhorias proprias da TCR

- Urgencia real: ultimos ingressos, virada de lote, fim da promocao.
- Prova social: total de compradores ou ingressos vendidos quando o numero ajudar na conversao.
- Ancoragem de valor: preco anterior, preco atual e economia quando houver promocao real.
- Destaque do lote recomendado: melhor custo-beneficio ou lote principal.
- CTA direto: "Garantir minha vaga agora".

## Painel administrativo

O painel e o centro de operacao interna da TCR. Ele deve priorizar velocidade de leitura e acao.

### Estrutura recomendada

Menu lateral:

- Dashboard
- Eventos
- Pedidos
- Financeiro
- Check-in
- Configuracoes

Lista de eventos:

- status;
- nome;
- data;
- local;
- vendidos / total;
- barra de progresso;
- faturamento;
- alertas;
- botao Gerenciar;
- acoes rapidas: editar, visualizar e duplicar.

### Melhorias proprias da TCR

- Faturamento por evento visivel direto na lista.
- Origem de venda quando tracking estiver implementado: Meta, Google, organico, direto.
- Taxa de conversao: visitas vs compras.
- Alertas: lote quase esgotado, lote virando hoje, pedido pendente alto.
- Tempo real ou quase tempo real para vendas em andamento.

## Decisao para as proximas fases

Na Fase 2, o foco sera o painel de eventos e lotes.
Na Fase 3, o foco sera a pagina publica de conversao.
Na Fase 4, o foco sera checkout e criacao segura de pedidos.
