# Primeiro disparo real de WhatsApp

## Template definido

- Nome Meta: `divulgacao_evento_tcr_v1`
- Categoria: `MARKETING`
- Idioma: `pt_BR`
- Corpo: `Olá, {{1}}! Aqui é a TCR Ingressos. Temos novidades sobre {{2}}. Confira as informações no botão abaixo. Caso não queira mais receber mensagens, responda SAIR.`
- Botão: `Ver evento`
- URL dinâmica: `https://www.tcringressos.app.br/evento/{{1}}`

O disparo só pode ser confirmado depois que a Meta marcar o template como `APPROVED` e uma sincronização trouxer exatamente esse conteúdo para o sistema.

## Lista controlada de dez contatos

Preencher `docs/templates/lista-teste-whatsapp-10-contatos.csv` com dados reais. Não alterar a primeira linha.

- `telefone`: código do país e DDD, por exemplo `5511999999999`.
- `opt_in_status`: `opt_in` somente quando houver autorização comprovável.
- `opt_in_date`: data e hora ISO com fuso, por exemplo `2026-10-08T15:00:00-03:00`.
- `opt_in_source`: onde a autorização foi obtida.
- `finalidade`: `marketing` para este template.
- `origem_coleta`: identificação do formulário, evento ou processo de coleta.

Linhas vazias são ignoradas. O arquivo não contém consentimentos fictícios.

## Homologação

Usar intervalo inicial de dez segundos entre contatos. Validar aceitação, entrega, leitura quando disponível, resposta e `SAIR`. Não ampliar o público antes de concluir a conferência dos dez destinatários.
