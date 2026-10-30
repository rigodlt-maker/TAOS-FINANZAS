import type { NextConfig } from "next";

// Encabezados de seguridad: nadie puede meter la app en un <iframe> (clickjacking), el navegador
// no adivina tipos de archivo y no se filtra la dirección completa a otros sitios
const seguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const config: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: seguridad }];
  },
  experimental: {
    // Los estados de cuenta en PDF pueden pesar varios MB
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default config;
