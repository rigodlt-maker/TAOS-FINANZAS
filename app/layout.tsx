import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Administrador Tao",
  description: "Mis gastos, presupuesto, metas de ahorro y pagos",
  appleWebApp: { capable: true, title: "Admin Tao", statusBarStyle: "default" },
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
        {process.env.NEXT_PUBLIC_TAOS_MODIFICADA === "1" && (
          <div role="alert" style={{ background: "#2a2100", color: "#f0d27a", fontSize: 13, lineHeight: 1.4, padding: "8px 16px", textAlign: "center", borderBottom: "1px solid #d4af37" }}>
            ⚠️ Esta copia de la app fue modificada: puede no funcionar como se diseñó y no tiene soporte de TAOS.
          </div>
        )}
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
