import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asesor Financiero",
  description: "Mis gastos, presupuesto, metas de ahorro y pagos",
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
