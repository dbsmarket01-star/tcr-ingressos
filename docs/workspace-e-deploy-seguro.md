# Workspace e deploy seguro

## Estado esperado antes de trabalhar

Antes de iniciar qualquer tarefa:

```bash
git status --short
git pull --ff-only origin main
```

O ideal é `git status --short` não retornar nada.

## Regra de ouro

Nunca fazer deploy com workspace sujo.

Se houver alterações soltas, primeiro separar em uma branch, commit ou stash nomeado.

O único comando autorizado para produção é:

```bash
npm run deploy:production
```

Ele bloqueia automaticamente a publicação quando:

- existe qualquer arquivo alterado ou não registrado;
- existe merge, rebase ou cherry-pick incompleto;
- a branch atual não é `main`;
- a `main` local está atrás de `origin/main`;
- existem commits locais que ainda não foram enviados ao repositório central.

Depois da liberação, o comando executa os testes de pagamentos, financeiro e WhatsApp, compila a aplicação, publica na Vercel e verifica o site, a API e o painel do produtor.

Não executar `vercel --prod`, `npx vercel --prod` ou promover manualmente uma prévia. Essas formas ignoram a trava local.

## Fluxo recomendado

1. Atualizar a `main`.
2. Criar uma branch por tarefa.
3. Fazer mudanças pequenas e relacionadas.
4. Validar.
5. Commitar só os arquivos da tarefa.
6. Enviar a branch integrada para `origin/main`.
7. Executar `npm run deploy:production`.
8. Validar visualmente no domínio publicado as telas afetadas.

Exemplo:

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/nome-da-tarefa
git status --short
```

## Arquivos temporários

Arquivos locais como `.DS_Store`, `tmp/`, `tmp-deriveddata-macos/` e `*.tsbuildinfo` devem ficar fora do Git.

## Recuperação de backups

Se uma limpeza guardou alterações em stash:

```bash
git stash list
git stash show --stat stash@{0}
```

Só aplicar um stash quando souber exatamente o que ele contém.

```bash
git stash apply stash@{0}
```
