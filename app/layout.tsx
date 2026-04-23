import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import "./styles.css";

export const preferredRegion = "gru1";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(value?: string | null) {
  if (!value) {
    return null;
  }

  const hex = value.trim().replace(/^#/, "");

  if (!/^[\da-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return `#${hex.toLowerCase()}`;
}

function shiftHex(hex: string, amount: number) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return hex;
  }

  const value = normalized.slice(1);
  const parts = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  const shifted = parts
    .map((part) => clamp(part + amount, 0, 255).toString(16).padStart(2, "0"))
    .join("");

  return `#${shifted}`;
}

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
  const primaryColor = normalizeHex(organizationContext.organization.primaryColor);
  const secondaryColor = normalizeHex(organizationContext.organization.secondaryColor);
  const brandStyle = organizationContext.isPlatformHost
    ? ({
        ["--brand" as string]: "#24427a",
        ["--brand-dark" as string]: "#182b55",
        ["--admin-primary" as string]: "#24427a",
        ["--admin-primary-dark" as string]: "#182b55",
        ["--admin-plum" as string]: "#24427a",
        ["--admin-plum-dark" as string]: "#182b55",
        ["--admin-surface-tint" as string]: "#eef3ff",
        ["--admin-indigo-soft" as string]: "#dbe6ff",
        ["--surface-soft" as string]: "#f5f8ff"
      } as CSSProperties)
    : primaryColor
      ? ({
          ["--brand" as string]: primaryColor,
          ["--brand-dark" as string]: shiftHex(primaryColor, -28),
          ["--admin-primary" as string]: primaryColor,
          ["--admin-primary-dark" as string]: shiftHex(primaryColor, -28),
          ["--admin-plum" as string]: primaryColor,
          ["--admin-plum-dark" as string]: shiftHex(primaryColor, -36),
          ...(secondaryColor
            ? {
                ["--admin-surface-tint" as string]: shiftHex(secondaryColor, 92),
                ["--admin-indigo-soft" as string]: shiftHex(secondaryColor, 72),
                ["--surface-soft" as string]: shiftHex(secondaryColor, 104)
              }
            : {})
        } as CSSProperties)
      : undefined;

  return (
    <html lang="pt-BR">
      <body style={brandStyle}>
        {children}
      </body>
    </html>
  );
}
