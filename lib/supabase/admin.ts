import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// Cliente con la llave secreta: solo para los crons, que corren sin sesión de usuario. Nunca llega al navegador.
export function clienteAdmin() {
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !llave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY");
  return createClient(SUPABASE_URL, llave, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Busca el id del dueño de la app a partir de ALLOWED_EMAIL
export async function idDelDueno(): Promise<string> {
  const correo = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!correo) throw new Error("Falta ALLOWED_EMAIL");
  const admin = clienteAdmin();
  for (let pagina = 1; pagina <= 10; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 100 });
    if (error) throw new Error(error.message);
    const usuario = data.users.find((u) => u.email?.toLowerCase() === correo);
    if (usuario) return usuario.id;
    if (data.users.length < 100) break;
  }
  throw new Error("El dueño todavía no ha iniciado sesión ni una vez");
}
