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

## Fluxo recomendado

1. Atualizar a `main`.
2. Criar uma branch por tarefa.
3. Fazer mudanças pequenas e relacionadas.
4. Validar.
5. Commitar só os arquivos da tarefa.
6. Publicar por Git ou Vercel somente a partir de estado limpo.

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

