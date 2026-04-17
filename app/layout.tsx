import type { Metadata } from "next";
import "./styles.css";

export const preferredRegion = "gru1";

export const metadata: Metadata = {
  title: "TCR Ingressos",
  description: "MVP de bilheteria online para eventos"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
