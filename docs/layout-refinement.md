# Refinamento visual - TCR Ingressos

Registro dos ajustes de layout aplicados nesta rodada.

## Admin

- Menu lateral organizado por grupos: visao geral, operacao, vendas, analise e sistema.
- Grupos ganharam cores de apoio para separar assuntos sem aumentar a quantidade de itens.
- Subitens continuam dentro dos grupos, mantendo acesso a pedidos, ingressos, usuarios, auditoria e configuracoes.
- Menu lateral destaca automaticamente a pagina atual.
- Tabelas operacionais de dashboard, eventos e pedidos ganharam scroll horizontal controlado e destaque de linha.

## Eventos

- Criacao e edicao de evento permitem upload de banner e imagem do mapa.
- Criacao e edicao de evento tambem permitem upload da imagem SEO/compartilhamento.
- Upload de imagem agora mostra previa antes de salvar.
- Upload de imagem aceita ate 10MB e valida arquivos grandes antes do envio.
- Banner do evento possui controle de enquadramento: centro, topo, base, esquerda ou direita.
- A pagina publica usa o enquadramento salvo no evento.
- Mapa do evento possui modelos pre-prontos: automatico por lotes, auditorio, teatro, galpao/arena, clube/pista e livre por setores.

## Pagina publica

- Se o evento tiver imagem de mapa, a pagina mostra a imagem enviada.
- Se nao tiver imagem de mapa, o sistema gera um mapa pelo modelo escolhido usando os nomes reais dos lotes disponiveis.
- No celular, a pagina exibe um botao fixo de compra apontando para a area de ingressos.
- Os cards de lote agora exibem ingresso, taxas em reais e total unitario em bloco mais claro, sem mostrar porcentual da taxa ao comprador.

## Pedido e pagamento

- A tabela de itens do pedido ganhou scroll horizontal controlado.
- O resumo financeiro do pedido ficou separado em um bloco proprio.
- Pix e cartao receberam caixas visuais mais claras.
- O formulario de cartao ganhou mais espaco para mes, ano e CVV, principalmente no celular.
- As parcelas do cartao mostram juros apenas no seletor de parcelas, quando houver acrescimo configurado.

## Ingresso e check-in

- A pagina do ingresso ganhou cabecalho visual, QR Code centralizado e bloco de detalhes mais facil de conferir.
- O ingresso permite copiar codigo e token do QR Code.
- O historico recente de check-in ganhou scroll horizontal controlado.
- A area de resultado do check-in anuncia mudancas para tecnologias assistivas.

## Atendimento e financeiro

- A busca de atendimento ganhou exemplos de consulta por pedido, e-mail, CPF/telefone e ingresso.
- O atendimento permite copiar e-mail e telefone do comprador.
- Tabelas financeiras ganharam scroll horizontal controlado para nao apertar colunas.
- Grids de suporte, financeiro e detalhes do ingresso empilham melhor no celular.

## Split Asaas

- O painel de configuracoes permite editar regras de split sem alterar codigo.
- As regras aceitam porcentagem, valor fixo por pedido e valor fixo por ingresso vendido.
- O valor fixo por ingresso multiplica a regra pela quantidade total de ingressos do pedido.

## Proximo refinamento visual recomendado

- Criar editor de recorte avancado com zoom e arraste, caso o controle simples de enquadramento nao seja suficiente.
- Migrar uploads para Supabase Storage/S3/CDN antes de deploy serverless.
- Fazer uma rodada visual completa depois que os fluxos finais de operacao estiverem fechados.
