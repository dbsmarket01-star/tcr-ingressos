# Politica de deploy e higiene tecnica

## Objetivo

Evitar que a plataforma volte a acumular arquivos soltos, migracoes fora do Git, funcionalidades antigas abandonadas e deploys feitos a partir de uma pasta suja.

## Regra principal

Toda mudanca pedida pelo dono da plataforma deve terminar em um destes estados:

1. Publicada em producao com aprovacao.
2. Commitada em branch de revisao, aguardando aprovacao.
3. Descartada com registro claro do motivo.
4. Arquivada temporariamente fora das rotas ativas, com prazo para exclusao.

Nada deve ficar perdido como arquivo solto na pasta principal.

## Antes de qualquer deploy

O responsavel tecnico deve executar:

```bash
npm run release:check
```

Esse comando valida:

- higiene do repositorio;
- historico de migracoes Prisma contra o banco;
- schema Prisma;
- testes automatizados;
- TypeScript;
- build de producao.

Se qualquer etapa falhar, nao deve haver deploy.

Auditoria de seguranca deve ser executada periodicamente com:

```bash
npm run security:audit
```

Quando houver alerta de dependencia em producao, a correcao deve ser tratada em tarefa propria. Nao usar `npm audit fix --force` sem validar impacto, porque ele pode trocar versoes principais do Next.js ou de bibliotecas de pagamento/e-mail.

## Banco de dados

Nunca executar em producao sem justificativa e backup:

- `prisma migrate reset`
- `prisma db push`
- alteracao manual de tabela
- remocao de coluna/tabela
- reset de Supabase

Migrações ja aplicadas no banco devem existir no Git com o mesmo checksum.

## Funcionalidade substituida

Quando uma funcionalidade nova substituir uma antiga:

1. Remover a rota/componente antigo no mesmo trabalho, se nao houver dependencia.
2. Se houver risco, mover somente documentacao ou referencia para uma pasta de arquivo morto fora de `app/`, `components/`, `features/` e `lib/`.
3. Registrar no documento do trabalho o que ficou pendente de remocao.
4. Revisar depois de 30 dias; se nao foi reutilizado, excluir definitivamente.

Codigo antigo nao deve ficar ativo em rota escondida sem dono.

## Arquivos proibidos

Nao devem entrar no Git:

- `.DS_Store`
- `* 2.*`
- `* 3.*`
- `* copy.*`
- `*.tsbuildinfo`
- caches temporarios
- duplicatas dentro de `node_modules`

## Regra operacional para Codex

Ao finalizar uma tarefa tecnica, Codex deve informar:

- o que foi feito;
- arquivos alterados;
- se houve commit;
- se houve push;
- se houve deploy;
- link de producao ou dizer claramente que nao foi publicado;
- como testar.

Se o usuario pediu uma correcao para producao, a tarefa nao deve terminar apenas com alteracao local. Ela deve terminar publicada ou explicitamente aguardando aprovacao de deploy.
