import { createHash, timingSafeEqual } from "node:crypto";
import { repoMemoria } from "./datos/memoria";
import type { Repo } from "./datos/repo";
import { repoSupabase } from "./datos/supabase";
import { clienteAdmin, idDelDueno } from "./supabase/admin";
import { supabaseConfigurado } from "./supabase/config";
import { modoTaos, type ModoTaos } from "./modo";

// Compara claves sin que el tiempo de respuesta delate cuántos caracteres coinciden
export function mismaClave(recibida: string | null, esperada: string): boolean {
  const huella = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(huella(recibida ?? ""), huella(esperada));
}

// Los crons de Vercel mandan "Authorization: Bearer <CRON_SECRET>"
export function cronAutorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  return !!secreto && mismaClave(req.headers.get("authorization")?.trim() ?? null, `Bearer ${secreto}`);
}

// Los crons corren sin sesión: usan la llave secreta y los datos del dueño
export async function repoDelDueno(): Promise<Repo> {
  if (!supabaseConfigurado()) return repoMemoria();
  return repoSupabase(clienteAdmin(), await idDelDueno());
}

// ---------- Nube F1 · los avisos diarios recorren a cada usuario ----------
// En "propia" solo está el dueño (ALLOWED_EMAIL), como siempre. En "nube", todos los que confirmaron su correo.
export type UsuarioCron = { id: string; correo: string | null }; // correo null = el de ALLOWED_EMAIL (modo propia)
type UsuarioAuth = { id: string; email?: string | null; email_confirmed_at?: string | null };
export const TOPE_POR_RONDA = 500;

async function listarUsuarios(): Promise<UsuarioAuth[]> {
  const admin = clienteAdmin();
  const todos: UsuarioAuth[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 100 });
    if (error) throw new Error(error.message);
    todos.push(...data.users);
    if (data.users.length < 100) break;
  }
  return todos;
}

export type OpcionesCron = { modo?: ModoTaos; listar?: () => Promise<UsuarioAuth[]>; dueno?: () => Promise<string>; repoDe?: (id: string) => Repo };

export async function usuariosDelCron(o: OpcionesCron = {}): Promise<UsuarioCron[]> {
  if ((o.modo ?? modoTaos()) === "propia") return [{ id: await (o.dueno ?? idDelDueno)(), correo: null }];
  const todos = await (o.listar ?? listarUsuarios)();
  return todos
    .filter((u) => u.email && u.email_confirmed_at)
    .slice(0, TOPE_POR_RONDA)
    .map((u) => ({ id: u.id, correo: u.email! }));
}

// Corre el trabajo del cron para cada usuario con SU repositorio (todas sus consultas llevan su user_id).
// Si a una persona le falla algo, se anota y se sigue con las demás. En el registro no se escribe su correo.
export async function porCadaUsuario<T>(trabajo: (repo: Repo, u: UsuarioCron) => Promise<T>, o: OpcionesCron = {}) {
  const resultados: T[] = [];
  let fallas = 0;
  if (!supabaseConfigurado() && !o.repoDe) return { usuarios: 1, fallas, resultados: [await trabajo(repoMemoria(), { id: "demo", correo: null })] };
  const usuarios = await usuariosDelCron(o);
  const repoDe = o.repoDe ?? ((id: string) => repoSupabase(clienteAdmin(), id));
  for (const u of usuarios) {
    try {
      resultados.push(await trabajo(repoDe(u.id), u));
    } catch (e) {
      fallas++;
      console.error("Cron: falló un usuario", u.id.slice(0, 8), e instanceof Error ? e.message : String(e));
    }
  }
  return { usuarios: usuarios.length, fallas, resultados };
}
