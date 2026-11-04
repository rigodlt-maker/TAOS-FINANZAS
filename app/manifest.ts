import type { MetadataRoute } from "next";
import { supabaseConfigurado } from "@/lib/supabase/config";

export default function manifest(): MetadataRoute.Manifest {
  // Apps de demostración (sin base de datos): ícono a lápiz y "Demo" en el nombre, para no confundirlas con la app real
  const demo = !supabaseConfigurado();
  const ico = demo ? "/demo/icono" : "/icono";
  return {
    name: demo ? "Administrador Tao (demo)" : "Administrador Tao",
    short_name: demo ? "Admin Tao demo" : "Admin Tao",
    description: "Mis gastos, presupuesto, metas de ahorro y pagos",
    start_url: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    lang: "es-MX",
    icons: [
      { src: `${ico}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${ico}-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${ico}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atajos: al dejar presionado el ícono de la app (Android) aparecen estos accesos directos
    shortcuts: [
      { name: "Registrar un gasto", short_name: "Gasto", url: "/agregar" },
      { name: "Foto del ticket", short_name: "Ticket", url: "/agregar#foto" },
      { name: "Preguntarle a Tao", short_name: "Tao", url: "/asesor" },
      { name: "Pagos próximos", short_name: "Pagos", url: "/pagos" },
    ],
  };
}
