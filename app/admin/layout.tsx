import { requireAdmin } from "@/features/auth/auth.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();

  return children;
}
