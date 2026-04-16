# Login Google no checkout

O checkout publico pode preencher nome e e-mail do comprador usando Google OAuth.

## Variaveis necessarias

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Rotas

- Inicio do fluxo: `/api/auth/google/start`
- Callback configurado no Google: `/api/auth/google/callback`

Em desenvolvimento local, a URL de callback fica:

```txt
http://localhost:3000/api/auth/google/callback
```

Em producao:

```txt
https://seudominio.com.br/api/auth/google/callback
```

## O que o Google preenche

- Nome
- E-mail

Telefone e CPF continuam sendo digitados pelo comprador, porque o Google normalmente nao entrega esses dados de forma confiavel para esse fluxo.
