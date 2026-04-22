import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import "./styles.css";

export const preferredRegion = "gru1";

export async function generateMetadata(): Promise<Metadata> {
  const organizationContext = await getCurrentOrganizationContext();

  return {
    title: organizationContext.isPlatformHost ? organizationContext.platformName : organizationContext.brandName,
    description: organizationContext.isPlatformHost
      ? `${organizationContext.platformName} é a plataforma SaaS que sustenta várias bilheterias com domínio, equipe, eventos, pedidos e check-in próprios.`
      : `Bilheteria oficial da ${organizationContext.brandName} para venda de ingressos, pedidos, check-in e operação de eventos.`
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationContext = await getCurrentOrganizationContext();

  return (
    <html lang="pt-BR">
      <body
        style={
          organizationContext.organization.primaryColor
            ? ({
                ["--brand-accent" as string]: organizationContext.organization.primaryColor
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </body>
    </html>
  );
}
