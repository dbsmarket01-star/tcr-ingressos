# Autenticacao administrativa

A Fase 9 adiciona login para proteger o painel interno da TCR Ingressos.

## Como funciona

- O acesso publico continua livre em rotas como `/`, `/evento/[slug]`, `/pedido/[code]` e `/ingresso/[code]`.
- O painel administrativo em `/admin` exige sessao.
- A tela de login fica em `/login`.
- A sessao e gravada em cookie HTTP-only, com validade de 8 horas.
- O usuario interno vem da tabela `AdminUser`.
- A senha e validada com `bcryptjs`, usando o hash salvo no banco.

## Variaveis de ambiente

Em producao, configure obrigatoriamente:

```env
AUTH_SECRET="gere-uma-chave-forte-para-assinar-sessoes"
```

Essa chave assina o cookie de sessao. Ela deve ser longa, privada e diferente da senha do banco.

## Usuario inicial

O seed cria ou atualiza um administrador usando:

```env
SEED_ADMIN_NAME="Administrador TCR"
SEED_ADMIN_EMAIL="admin@tcringressos.com.br"
SEED_ADMIN_PASSWORD="troque-esta-senha"
```

Depois de alterar esses valores, rode o seed para atualizar tambem o hash da senha no banco:

```bash
npm run db:seed
```

## Rotas protegidas

Toda rota dentro de `/admin` passa pelo layout:

```txt
app/admin/layout.tsx
```

Esse layout chama `requireAdmin()` antes de renderizar a pagina.
