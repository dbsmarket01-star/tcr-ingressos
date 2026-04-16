# TCR Ingressos - Arquitetura da Fase 1

## Direcao do produto

TCR Ingressos e uma bilheteria propria, usada por uma unica operacao interna.
Nao e SaaS, nao e white-label e nao tera painel para produtores externos.

## Stack escolhida

- Next.js com App Router para interface publica, painel administrativo e rotas server-side.
- TypeScript para reduzir erro de contrato entre telas, regras de negocio e dados.
- PostgreSQL como banco recomendado de producao.
- Prisma como camada de modelagem, migracao e acesso ao banco.
- Zod para validar entradas no backend antes de gravar dados.

## Principios de organizacao

- `app/`: rotas, layouts e paginas.
- `components/`: componentes reutilizaveis de interface.
- `features/`: regras e telas por modulo de negocio.
- `lib/`: infraestrutura compartilhada, helpers e cliente de banco.
- `prisma/`: modelagem do banco e futuras migrations.
- `docs/`: decisoes tecnicas e instrucoes de operacao.

## Consistencia em areas criticas

As fases seguintes devem concentrar operacoes criticas em services server-side dentro de `features`.
Criacao de pedido, reserva de estoque, confirmacao de pagamento, emissao de ingresso e check-in devem usar transacoes.

Para estoque, a abordagem planejada e:

- criar pedido como `PENDING`;
- reservar quantidade no lote dentro de transacao;
- impedir reserva quando `soldQuantity + reservedQuantity + quantidade > totalQuantity`;
- expirar reservas nao pagas;
- confirmar pagamento via webhook;
- converter reserva em venda paga;
- emitir ingressos somente apos pagamento aprovado.

## Banco local e producao

O schema Prisma usa PostgreSQL. Nesta maquina nao ha Docker instalado, entao a Fase 1 deixa a modelagem pronta e validada.
Quando houver um PostgreSQL local ou remoto, configure `DATABASE_URL` e rode:

```bash
npm run db:migrate
npm run db:generate
```
