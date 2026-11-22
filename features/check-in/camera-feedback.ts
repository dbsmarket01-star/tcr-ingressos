export function getCameraErrorMessage(error: { name: string }) {
  switch (error.name) {
    case "NotAllowedError":
      return "A permissão da câmera foi negada. Libere a câmera nas configurações deste site e toque em Abrir câmera. Você também pode digitar o código.";
    case "NotFoundError":
      return "Nenhuma câmera foi encontrada. Confira se ela está conectada ou digite o código do ingresso.";
    case "NotReadableError":
      return "A câmera está ocupada ou indisponível. Feche outros aplicativos ou abas que usam a câmera e tente novamente.";
    case "OverconstrainedError":
      return "A câmera selecionada não está disponível. Selecione Traseira automática ou outra câmera na lista.";
    default:
      return "Não foi possível iniciar a câmera. Tente novamente ou digite o código do ingresso.";
  }
}
