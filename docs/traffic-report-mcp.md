# Relatórios TCR para agente de tráfego (somente leitura)

O conector MCP remoto fica em `https://www.tcringressos.app.br/api/integrations/traffic-mcp`.
Ele expõe apenas `listar_eventos` e `vendas_por_evento`; não oferece escrita nem retorna nome,
CPF, telefone, e-mail ou pedidos individuais. A organização é sempre a TCR Ingressos.

O acesso requer o segredo servidor `TRAFFIC_REPORT_API_TOKEN` (mínimo de 32 caracteres),
enviado no cabeçalho `Authorization: Bearer <segredo>`. O segredo deve existir como variável
Secret de produção na Vercel e nunca ser colocado no repositório, URL ou mensagem de chat.
Sem o segredo configurado, o endpoint responde 401. Para revogar o acesso, rotacione ou
remova esse segredo na Vercel e desconecte o conector no Claude.

No Claude, adicione um conector personalizado Web com a URL acima, autenticação "No sign in"
e o cabeçalho fixo `Authorization` com o valor Bearer. O segredo deve ser inserido pelo
proprietário da conta diretamente na interface de conectores.

`vendas_por_evento` recebe `data_inicio`, `data_fim` (AAAA-MM-DD) e `evento_id` opcional.
As datas são inclusivas no fuso `America/Sao_Paulo`, pela confirmação do pagamento (`paidAt`).
Sem `evento_id`, retorna todos os eventos TCR, uma linha por evento e dia. Os valores
monetários são inteiros em centavos de BRL; divida por 100 para exibição. Pedidos pagos
com estorno parcial são reduzidos proporcionalmente conforme o mesmo cálculo do dashboard.
Estornos não são atribuídos ao dia da devolução. O relatório não representa o sistema antigo
PHSIS, nem gasto de anúncios do Meta.

Validação de referência: em 28/10/2026, comparar com o painel da TCR:
40 pedidos pagos, 95 admissões, R$ 16.232,00 em ingressos, R$ 3.246,40 em taxa de
bilheteria e R$ 470,73 em juros de cartão. Conferir o mesmo total no MCP após publicar.
