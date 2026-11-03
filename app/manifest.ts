import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Administrador Tao",
    short_name: "Admin Tao",
    description: "Mis gastos, presupuesto, metas de ahorro y pagos",
    start_url: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    lang: "es-MX",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
