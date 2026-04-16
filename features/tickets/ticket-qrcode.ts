import QRCode from "qrcode";

export async function createTicketQrCodeSvg(value: string) {
  return QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#111111",
      light: "#ffffff"
    }
  });
}
