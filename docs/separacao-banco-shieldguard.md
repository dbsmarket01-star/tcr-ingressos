# Separação segura do banco ShieldGuard / TCR

## Estado verificado em 13/10/2026

Leitura somente no banco configurado para produção da TCR, sem exportar dados pessoais ou alterar registros:

| Conjunto | Registros |
| --- | ---: |
| Pedidos da bilheteria | 1.658 |
| Usuários ShieldGuard (`AppUser`) | 1 |
| Sessões do app | 5 |
| Assinaturas do app | 1 |
| Dispositivos protegidos | 2 |
| Incidentes de bypass | 3 |
| Políticas / fontes / entradas de bloqueio | 1 / 1 / 8 |
| Demais eventos de proteção, pagamentos de assinatura, vínculos e desbloqueios | 0 |

A organização `shieldguard` também existe na TCR, com 1 `CompanySettings` e sem administradores, eventos ou regras de split. Os modelos `AppUser`, `Subscription`, `ProtectedDevice` e demais modelos de proteção **não têm chave de organização**; não devem ser separados por um filtro de `organizationId`. `PaymentGateway` e `ASAAS` são enumerações compartilhadas e não podem ser removidas apenas por pertencerem ao app.

O código das páginas e APIs do ShieldGuard já foi retirado da aplicação TCR no commit `77d8a88`. Os dados e modelos Prisma foram mantidos deliberadamente. Não há migração destrutiva neste documento.

## Sequência de migração proposta

1. Confirmar o repositório, ambiente e banco **exclusivos** do ShieldGuard. Não reutilizar a `DATABASE_URL` da TCR nem criar recursos no projeto Vercel da bilheteria. Definir o responsável pelo app antes de qualquer troca de credenciais.
2. Fazer backup completo e criptografado do banco TCR com ferramenta do provedor ou `pg_dump` em armazenamento privado; registrar horário, checksum, tamanho e teste de restauração em banco descartável. Não guardar o dump no Git, em Downloads compartilhados ou em logs de CI.
3. Exportar somente as tabelas de proteção/assinatura e os registros da organização `shieldguard` com suas dependências. Preservar chaves primárias, relações, timestamps e eventos brutos; nunca copiar pedidos, pagamentos, clientes ou chaves da TCR.
4. Restaurar no banco novo do ShieldGuard, aplicar seu schema e comparar contagens por tabela, IDs e checksums de conteúdo. Conferir uma assinatura e um dispositivo ponta a ponta em ambiente de teste, sem acionar cobrança ou notificação real.
5. Apontar apenas o app ShieldGuard para o banco novo e validar login, política, heartbeat, dispositivos e eventual webhook de assinatura. Observar durante um período acordado. A TCR continua usando seu banco atual e seus fluxos de ingressos sem alteração.
6. Somente depois de backup restaurável, validação funcional e aceite explícito, criar uma migração separada para retirar os modelos/tabelas exclusivos do ShieldGuard da TCR e a organização residual. Revisar dependências e `ON DELETE` antes de qualquer `DROP`; testar a migração e a restauração em cópia do banco.

## Critérios de parada e reversão

- Parar se qualquer contagem, chave estrangeira, checksum ou fluxo divergir, se o backup não restaurar, se houver outro deploy/migração em andamento ou se o banco destino não for comprovadamente isolado.
- Não excluir dados de produção como forma de corrigir erro de aplicação ou de acelerar deploy.
- Antes da exclusão final, manter o banco TCR como fonte íntegra; a reversão consiste em apontar o ShieldGuard de volta ao estado anterior e restaurar o backup testado, conforme o incidente. Não fazer rollback cego de dados novos.
- A publicação de código TCR continua sujeita a `npm run deploy:production` e às travas de Git; a migração de dados exige janela própria e autorização específica para a exclusão final.
