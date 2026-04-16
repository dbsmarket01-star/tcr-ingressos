export const manualPresaleChecklistItems = [
  {
    key: "domain_https_ready",
    label: "Dominio e HTTPS publicados",
    description: "Evento acessa em dominio real com certificado HTTPS ativo."
  },
  {
    key: "app_urls_production",
    label: "APP_URL/NEXT_PUBLIC_APP_URL revisados",
    description: "Variaveis apontam para o dominio final, sem localhost ou tunnel."
  },
  {
    key: "asaas_webhook_final",
    label: "Webhook definitivo do Asaas",
    description: "Webhook do Asaas usa o dominio final e confirmou Pix/cartao automaticamente."
  },
  {
    key: "reservation_cron_running",
    label: "Expiracao de reservas agendada",
    description: "Rotina automatica roda a cada poucos minutos para liberar estoque vencido."
  },
  {
    key: "storage_confirmed",
    label: "Storage de imagens confirmado",
    description: "Banner, mapa e SEO ficam salvos em storage seguro para o tipo de deploy escolhido."
  },
  {
    key: "pixel_gtm_checked",
    label: "Pixel/GTM conferido",
    description: "PageView, checkout iniciado e purchase aparecem nas ferramentas de tracking."
  },
  {
    key: "pix_real_person_test",
    label: "Pessoa real comprou via Pix",
    description: "Teste feito fora do seu computador, com e-mail e QR Code recebidos."
  },
  {
    key: "card_real_person_test",
    label: "Pessoa real comprou no cartao",
    description: "Checkout transparente aprovou cartao e emitiu ingresso automaticamente."
  },
  {
    key: "android_checkout_test",
    label: "Checkout testado no Android",
    description: "Compra, pagamento e abertura do ingresso funcionam em celular Android."
  },
  {
    key: "iphone_checkout_test",
    label: "Checkout testado no iPhone",
    description: "Compra, pagamento e abertura do ingresso funcionam em iPhone."
  },
  {
    key: "checkin_team_test",
    label: "Equipe testou check-in",
    description: "Portaria leu QR Code valido e bloqueou reutilizacao no celular."
  },
  {
    key: "support_missing_ticket_test",
    label: "Suporte simulou nao recebi ingresso",
    description: "Atendimento encontrou pedido e reenviou/abriu ingresso para o cliente."
  },
  {
    key: "small_ads_plan_ready",
    label: "Plano de trafego pequeno pronto",
    description: "Orcamento inicial, evento real, UTM e monitoramento foram definidos."
  }
] as const;
