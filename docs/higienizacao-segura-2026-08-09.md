# Higienizacao segura - 2026-08-09

## Objetivo

Organizar a desordem tecnica do projeto sem derrubar producao, sem perder funcionalidade e sem executar operacoes destrutivas no banco.

Este documento registra a auditoria inicial somente leitura. Nada de banco foi alterado, nada foi apagado e nenhum deploy foi feito nesta etapa.

## Estado encontrado

### Producao

- Projeto Vercel: `tcr-ingressos`
- Escopo Vercel: `dbsmarket01-2189s-projects`
- Dominio inspecionado: `tcringressos.app.br`
- Deployment ativo no momento da auditoria: `dpl_By9BedSh5brseP4ETJ3vhR8PLuzw`
- URL do deployment: `https://tcr-ingressos-2hczwsfff-dbsmarket01-2189s-projects.vercel.app`
- Status: `Ready`

Observacao: o deployment ativo e mais novo que o ultimo commit publicado anteriormente nesta conversa. Isso indica que producao, `origin/main` e workspace local precisam ser tratados como fontes separadas ate a consolidacao.

### Git local

- Branch local: `main`
- Situacao: `main...origin/main [behind 31]`
- Arquivos rastreados modificados localmente: `117`
- Arquivos nao rastreados: `6111`
- Arquivos diferentes entre workspace local e `origin/main` em areas principais: `130`

Conclusao: o workspace local nao deve ser usado como base direta para deploy. Um deploy feito daqui pode sobrescrever correcoes recentes que ja estao em `origin/main` ou misturar arquivos incompletos.

### Arquivos duplicados ou lixo evidente

Foram encontrados arquivos com padrao de copia local ou gerados por ferramenta:

- `.DS_Store`
- `app/page 2.tsx`
- `app/admin/events/[eventId]/heatmap/page 2.tsx`
- `app/admin/home-list/export/pdf/route 2.ts`
- `components/admin/NumberedSeatMapEditor 2.tsx`
- `features/tracking/heatmap.service 2.ts`
- `prisma/seed 2.js`
- `tsconfig.tsbuildinfo`
- `tsconfig 2.tsbuildinfo`
- `tsconfig 3.tsbuildinfo`
- muitos arquivos duplicados dentro de `node_modules`

Esses itens sao candidatos fortes a limpeza, mas ainda devem ser removidos em uma branch controlada, com build e testes, para evitar apagar algo que tenha sido usado por acidente.

### Funcionalidades soltas ou nao consolidadas

Ha varios arquivos nao rastreados que parecem funcionalidades reais, nao lixo:

- Chat IA de evento
- Mapas numerados e editor de assentos
- Relatorios por evento e PDFs
- Heatmap e tracking publico
- Links rastreaveis
- Potencial de vendas
- Relatorios geograficos
- Publicacao/ocultacao de eventos em destaque
- Audiencias de e-mail
- Webhooks/rotinas de Resend, WhatsApp e Asaas
- Geracao de PDF de pedido/ingresso

Esses arquivos nao devem ser apagados automaticamente. Precisam ser classificados entre: ja consolidados em `origin/main`, funcionais mas pendentes de commit, experimentais, ou abandonados.

## Banco de dados e Prisma

### Migrações

- Migrações aplicadas no banco: `32`
- Migrações com arquivo local correspondente e checksum batendo: `31`
- Migração aplicada no banco sem arquivo local atual: `20260518235000_add_ticket_lot_badge`
- Migrações no workspace local que nao existem em `origin/main`: `11`
- Migração existente em `origin/main` que nao existe no workspace local atual: `20260518235000_add_ticket_lot_badge`

Migrações locais que nao aparecem em `origin/main`:

- `20260518204000_add_event_schedule_description`
- `20260519003000_add_event_costs`
- `20260519225000_add_ticket_lot_badge`
- `20260520123000_add_event_marketing_tracking`
- `20260520142000_add_sales_notifications`
- `20260521100000_add_whatsapp_click_tracking`
- `20260521112000_add_heatmap_signal_tracking`
- `20260524172000_add_event_ai_chat`
- `20260607110000_add_resend_webhook_events`
- `20260608200000_add_event_hidden_from_showcase`
- `20260720211500_add_email_audiences`

### Diagnostico

O banco recebeu migrações que nao estao completamente alinhadas com o historico versionado em `origin/main`. Isso e uma das causas-raiz da recorrencia de problemas ao mexer em deploy, Prisma, Supabase e funcionalidades recentes: o ambiente de producao pode depender de colunas/tabelas que existem no banco, mas cujo historico nao esta limpo no repositorio remoto.

Importante: nenhuma migração apresentou rollback ou logs de falha na tabela `_prisma_migrations`.

## Riscos principais

1. Deploy a partir do workspace local pode sobrescrever correcoes recentes.
2. Rodar `prisma migrate deploy` sem reconciliar arquivos pode gerar erro de historico de migracoes.
3. Rodar `prisma db push`, `migrate reset`, reset de Supabase ou alteracoes manuais pode causar perda de dados ou divergencia maior.
4. Apagar arquivos nao rastreados sem classificacao pode remover funcionalidades reais que estao em uso ou em preparacao.
5. A existencia de arquivos duplicados `* 2.*` pode fazer alguem corrigir o arquivo errado e acreditar que a correcao foi publicada.

## Plano seguro recomendado

### Fase 1 - Congelar a fonte segura

- Usar `origin/main` como base tecnica inicial.
- Nao usar o workspace local sujo para deploy.
- Criar uma branch limpa `codex/higienizacao-segura`.
- Trabalhar em clone limpo ou worktree separado.

### Fase 2 - Reconciliar Prisma sem tocar dados

- Copiar para a branch limpa todos os arquivos de migração ja aplicados no banco e que ainda nao estao em `origin/main`.
- Garantir que o checksum dos arquivos versionados bata com o checksum registrado no banco.
- Nao criar migração nova nesta fase.
- Nao executar `db push`, `reset`, `migrate reset` ou alteracao manual de tabela.

### Fase 3 - Classificar arquivos soltos

Classificar cada arquivo nao rastreado em:

- `manter`: funcionalidade real que deve entrar no Git.
- `ja existe`: funcionalidade ja presente em `origin/main`.
- `descartar`: duplicata, cache, build artifact, `.DS_Store`, arquivo ` 2`, `tsbuildinfo`, node_modules duplicado.
- `avaliar`: funcionalidade incompleta que nao deve ir para producao ainda.

### Fase 4 - Limpeza controlada

- Ajustar `.gitignore` para impedir retorno de `.DS_Store`, `tsbuildinfo`, copias numeradas e caches.
- Remover lixo evidente somente na branch limpa.
- Nunca remover uma funcionalidade sem confirmar que ela nao e usada.

### Fase 5 - Validacao antes de deploy

Executar pelo menos:

- `npm test`
- `npx tsc --noEmit`
- build local
- teste de paginas publicas de eventos
- checkout com reserva ate etapa de Pix/cartao
- webhook Asaas em rota controlada/teste
- painel admin: Congressos e eventos, Ingressos e lotes, Pedidos, Venda de ingressos, Check-in
- verificacao multi-tenant: TCR, A2 e Elo

### Fase 6 - Deploy controlado

- Fazer deploy somente a partir da branch limpa validada.
- Manter rollback pronto pelo deployment anterior da Vercel.
- Conferir dominios e rotas criticas apos deploy.

## O que nao fazer

- Nao apagar o workspace local sujo agora.
- Nao resetar banco.
- Nao rodar `prisma migrate reset`.
- Nao rodar `prisma db push` em producao.
- Nao fazer deploy a partir da pasta local atual.
- Nao juntar todos os arquivos nao rastreados em um unico commit sem revisao.

## Proximo passo pratico

O proximo passo seguro e criar uma branch/clone limpo a partir de `origin/main`, trazer apenas as migracoes ja aplicadas no banco que estao faltando no remoto, validar checksums e abrir um commit pequeno chamado algo como:

`chore: reconcile applied prisma migrations`

Depois disso, seguimos para a classificacao dos arquivos soltos por modulo.

## Protecoes adicionadas

Para reduzir a chance de o problema voltar:

- O `.gitignore` deve bloquear arquivos locais duplicados como `page 2.tsx`, `route 2.ts`, `tsconfig 2.tsbuildinfo`, caches temporarios e copias locais.
- O comando `npm run repo:check-hygiene` deve avisar quando arquivos locais suspeitos forem encontrados.
- O comando `npm run db:check-migrations` deve ser usado antes de qualquer deploy que envolva Prisma ou banco.
- Esse comando compara a tabela `_prisma_migrations` com os arquivos em `prisma/migrations` e falha quando encontra migracao aplicada no banco sem arquivo correspondente, checksum alterado, rollback ou migracao com log de falha.
- O comando `npm run release:check` consolida as validacoes antes de publicar.

Regra operacional: nenhum deploy deve ser feito se `npm run db:check-migrations` apontar divergencia.

Ver tambem: `docs/politica-deploy-e-higiene.md`.

## Pendencias encontradas na validacao

### Dependencias com alerta de seguranca

`npm audit --omit=dev` apontou vulnerabilidades de producao envolvendo principalmente `next`, `postcss`, `sharp`, `nanoid`, `uuid` e dependencias transitivas do `resend`.

Nao foi executado `npm audit fix --force`, porque ele sugere troca de versoes fora do intervalo atual e pode alterar comportamento de producao. A correcao deve ser feita em uma tarefa propria, com upgrade controlado e regressao completa de checkout, admin, webhooks e paginas publicas.

### Aviso de build Turbopack

O build passou, mas emitiu aviso sobre rastreamento amplo vindo de:

- `features/apple-local-dns/apple-local-dns-status.service.ts`
- `app/api/apple/local-dns/status/route.ts`

Esse aviso nao impediu o build, mas indica codigo auxiliar que deve ser revisado para reduzir ruido e risco em builds futuros.
