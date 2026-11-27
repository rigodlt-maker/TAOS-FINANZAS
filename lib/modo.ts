// Nube F1 · Un solo código para las dos formas de usar TAOS:
// - "propia" (lo de hoy, por omisión): tu app en tu propio Vercel y Supabase, para 1 persona (ALLOWED_EMAIL).
// - "nube": el servidor de TAOS para muchas personas (Play Store). Cada quien ve solo lo suyo.
export type ModoTaos = "propia" | "nube";

export const modoTaos = (): ModoTaos => (process.env.TAOS_MODO?.trim().toLowerCase() === "nube" ? "nube" : "propia");
export const esNube = () => modoTaos() === "nube";
