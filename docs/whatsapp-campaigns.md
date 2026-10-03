# Campanhas WhatsApp — implementação e ativação

## Estado da entrega

Módulo implementado em `/admin/marketing/whatsapp`, com painel, listas CSV/XLSX, criação em três etapas, rascunho automático, prévia, confirmação, agendamento, ritmo e relatório. A interface segue as referências fornecidas; os números apresentados nos testes visuais são fictícios.

Esta entrega não aplica migrações em produção, não publica o sistema e não dispara mensagens reais. A ativação depende da configuração e homologação abaixo. A aprovação do número pela Meta não garante ausência de restrições.

## Arquitetura

- `features/whatsapp/campaigns`: importação, regras, serviço transacional, integração Meta, mídia, worker e webhooks.
- `WaCampaign`: rascunho versionado; confirmação congela configuração, template e mídia. Cada `WaMessageJob` congela o destinatário. Triggers impedem alteração dos snapshots e da auditoria.
- Autosave após 750 ms, ao sair do campo e ao avançar. A API compara a versão para impedir que duas abas sobrescrevam silenciosamente o trabalho. Backup local auxilia recuperação; o servidor continua sendo a fonte de verdade.
- Fila persistida no PostgreSQL. Worker independe da página aberta. Locks de campanha/contato e controladores compartilhados por telefone, WABA e portfolio coordenam campanhas concorrentes.
- Upload em partes de 2 MB, com versão, validação de assinatura do arquivo, tamanho e codecs. Mídia validada é imutável. O processo reutiliza o identificador Meta de um asset por até 24 horas; reiniciar o worker pode repetir o upload do asset, nunca autoriza repetir uma mensagem já aceita.
- Rascunho → agendada/fila → enviando → concluída, com pausa e cancelamento. Conclusão da fila não garante entrega ao dispositivo.

## Configuração antes da ativação

1. Revisar e aplicar a migração `prisma/migrations/20260930190000_whatsapp_campaigns/migration.sql` no ambiente de homologação. Gerar o Prisma Client. Revisar todas as migrações pendentes antes de executar comandos de implantação; há alterações financeiras independentes neste workspace.
2. Configurar `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` e `WHATSAPP_GRAPH_API_VERSION` (fallback atual `v23.0`). Opcional: `WHATSAPP_BUSINESS_PORTFOLIO_ID`. Para organizações diferentes de `tcr-ingressos`, usar sufixo do slug em maiúsculas, trocando caracteres não alfanuméricos por `_`, por exemplo `_MINHA_EMPRESA`. Somente `tcr-ingressos` usa fallback global.
3. Configurar `WHATSAPP_APP_SECRET` e o webhook existente `/api/webhooks/whatsapp/meta`, incluindo mensagens/status e atualizações de template. Assinaturas ausentes/inválidas são rejeitadas; falta do segredo agora também rejeita o callback. Conferir essa variável antes de publicar para não interromper o CRM existente.
4. Sincronizar a integração e templates no painel com as permissões Meta necessárias. Conferir o número e WABA corretos, qualidade e status. Acesso ao módulo exige permissão de marketing e acesso a todos os eventos da organização.
5. Escolher a execução do worker: `npm run worker:whatsapp` em serviço supervisionado, ou cron autenticado em `/api/cron/whatsapp-campaigns`. O `vercel.json` inclui frequência de um minuto; verificar suporte do plano e duração da função. Configurar `CRON_SECRET`. Não iniciar o worker contra produção antes de homologar campanhas e destinatários.
6. Para CTA rastreável, configurar `WHATSAPP_CAMPAIGN_PUBLIC_URL` HTTPS e aprovar um template cujo botão dinâmico aceite esse endereço. Links comuns não viram rastreáveis silenciosamente.
7. Homologar com destinatários internos autorizados: importação, confirmação, mensagem real, recebimento, leitura quando disponível, resposta, descadastro, pausa e retomada. A verificação local não substitui essa etapa.
8. Publicação deve seguir `AGENTS.md` e `docs/workspace-e-deploy-seguro.md`, com a skill de deploy seguro. O workspace contém outras mudanças que precisam ser preservadas e revisadas.

## Importação e consentimento

Aceita CSV (vírgula ou ponto e vírgula) e primeira planilha XLSX, até 10 MB e 20 mil linhas. Telefones são normalizados, inválidos informados e duplicados removidos. Um descadastro em linha duplicada prevalece.

Cabeçalhos recomendados:

```csv
telefone,nome,cidade,tag,consentimento,dataconsentimento,fonteconsentimento,finalidade,origemcoleta
```

Usar `opt_in`, data ISO com fuso, fonte comprovável e finalidade `marketing` ou `utility`. Sem evidência completa o contato fica `unknown` e não recebe campanha. `opt_out` entra na supressão da organização; reimportação não remove descadastro. Não preencher evidências fictícias para tornar uma lista elegível.

## Proteções e contingência

- Templates precisam estar aprovados e corresponder ao conteúdo, variáveis e botão. Campanhas promocionais usam consentimento e categoria de marketing. Mensagem livre exige janela de atendimento válida; áudio livre não aceita legenda/botão neste módulo.
- Supressão, frequência, descanso, janela e situação da integração são reavaliados antes do POST. Regras individuais podem reduzir o público elegível entre a prévia e a confirmação/envio.
- Intervalo configurável de 1 a 3.600 segundos ou lotes; o controlador pode reduzir o ritmo quando necessário. Não há aleatoriedade para contornar restrições. A estimativa não garante horário exato, pois execução do worker, resposta da Meta, pausas e limites interferem.
- Limites explícitos e falhas transitórias usam espera crescente e reduzem o ritmo. Ao vencer a espera, uma nova sincronização de saúde é obrigatória antes de retomar apenas campanhas pausadas por aquele motivo. Cinco falhas consecutivas, qualidade ruim, problemas de credencial ou resultado incerto exigem investigação; pausas manuais não são retomadas automaticamente.
- Erros de destinatário/frequência geram descanso quando aplicável. Atualização de template não aprovado pausa campanhas afetadas.
- Se o POST pode ter sido aceito mas a resposta se perde, o job fica `uncertain`. Não existe garantia de “exactly once” entre banco e provedor externo: o sistema prefere não duplicar. O webhook pode reconciliar pelo ID da mensagem ou identificador da tentativa. Ausência de callback não é evidência de que nada foi enviado; investigar antes de qualquer intervenção manual.
- O controlador compartilhado cobre este módulo de campanhas. Envios legados do CRM/transacionais não passam por essa mesma fila. Limites Meta de capacidade são tratados por ritmo e resposta do provedor; não há reserva preventiva de toda a capacidade diária do portfolio. Validar volume agregado antes de ativar grande escala.

A [política oficial do WhatsApp](https://whatsappbusiness.com/policy/) exige autorização e respeito ao descadastro. Os formatos e limites de mídia seguem a [referência oficial da Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/13382743-ecb27be5-4d27-4763-bbee-6a8002c04bf3): imagens JPEG/PNG até 5 MB; áudio/vídeo até 16 MB, com validação de codec. Template não transforma um formato não suportado em mensagem permitida.

## Métricas

Aceitação HTTP da API é distinta de envio, entrega e leitura. Webhooks autenticados e deduplicados registram os estados sem regredir leitura para enviado. No painel, a taxa de entrega usa a coorte enviada no período; respostas são contadas pela data da resposta. Nos relatórios, os totais abrangem a campanha inteira.

Respostas com referência são atribuídas ao envio correspondente; sem referência, ao último envio aceito nos sete dias anteriores. Essa segunda atribuição é uma estimativa. Cliques dependem de link rastreável aprovado e podem incluir robôs/prévias; leitura depende da informação fornecida pelo WhatsApp.

## Verificação realizada

- 45 testes de WhatsApp: regras, importação, assinatura, migração em PostgreSQL isolado (PGlite), aceitação/entrega, concorrência dos controladores, descadastro, timeout incerto, backoff e recuperação.
- TypeScript e build Next.js; suites existentes financeira (91) e pagamentos (34) também passaram durante a implementação.
- Componentes reais verificados em navegador com API local de teste: painel, três etapas, edição/autosave, recarregamento, confirmação simulada e apresentação em desktop/celular.
- Não foram exercitados credenciais Meta reais, banco de produção, cron hospedado ou entrega a telefones. A base PostgreSQL e o transporte do worker são simulados nos testes de execução; os triggers de migração são executados no PGlite.
# Proteções obrigatórias de disparo

- Campanhas vinculadas a eventos só podem ser salvas, confirmadas e enviadas quando o evento estiver `PUBLISHED` e ainda não tiver terminado.
- A condição do evento é revalidada no servidor na edição, na confirmação, ao reservar cada envio e imediatamente antes da chamada à Meta.
- O template precisa existir na conta, estar `APPROVED`, manter idioma, categoria e conteúdo sincronizados e corresponder ao snapshot confirmado.
- Erros de template da família `132xxx`, incluindo `132001`, abrem o circuito e pausam todas as campanhas da integração no primeiro erro.
- Confirmações são idempotentes, cada contato/telefone só gera um trabalho por campanha e envios sem confirmação nunca são repetidos automaticamente.
- Toda criação, confirmação, pausa, início, falha e aceite registra ator, campanha, horário e contexto em `WaAudit`.

## Revisão de uploads e ritmo — 03/10/2026

Normalização de MIME entre navegadores (incluindo M4A), validação real de codecs e limite de 1.024 caracteres nas legendas de imagem/vídeo. Repetir o clique no tipo selecionado preserva o anexo; o seletor permite repetir o mesmo arquivo após erro. A importação mostra totais de inválidos e duplicados; a estimativa usa destinatários elegíveis e inclui segundos.

O worker reserva os controladores compartilhados durante a preparação e a requisição. O próximo horário da campanha é calculado a partir da tentativa real na Meta, evitando encurtar o intervalo após upload lento. Reservas vencidas impedem o POST. O intervalo é mínimo; cron, processamento e restrições podem aumentar a espera. Os testes de ritmo usam transporte simulado, sem mensagens reais.
