# TCR Ingressos - Setup do Supabase

## 1. Criar o projeto

Crie um projeto no Supabase para a TCR Ingressos.
Use uma senha forte para o banco e guarde em local seguro.

## 2. Copiar as connection strings

No Supabase, abra:

Project Settings -> Database -> Connection string

Preencha o arquivo `.env` com:

```bash
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

Use a senha real do banco no lugar de `[PASSWORD]`.
O arquivo `.env` nao deve ser commitado.

## 3. Configurar admin inicial

Ainda no `.env`, ajuste:

```bash
SEED_ADMIN_NAME="Seu Nome"
SEED_ADMIN_EMAIL="seu-email@empresa.com"
SEED_ADMIN_PASSWORD="uma-senha-forte"
```

## 4. Criar tabelas no Supabase

Depois de preencher o `.env`, rode:

```bash
npm run db:migrate
npm run db:seed
```

## 5. Conferir tabelas

Para abrir o navegador de dados do Prisma:

```bash
npm run db:studio
```

## Observacao importante

O Supabase fornece modos diferentes de conexao.
Para Prisma, mantemos `DIRECT_URL` separada para migrations e `DATABASE_URL` para a aplicacao.
Isso evita problemas ao evoluir o banco com migrations.
