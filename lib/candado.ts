// Nube F4 · Sin suscripción vigente, TAOS Nube queda en SOLO LECTURA: ves y descargas todo, pero no guardas cambios.
// Se aplica al repositorio de la sesión: los métodos que crean, cambian o borran preguntan antes por la suscripción.
// (Borrar tu cuenta, descargar tus datos y los avisos automáticos no pasan por aquí.)
import { mensajeDeEstado, puedeEscribir, type Suscripcion } from "./suscripcion";

const ESCRIBE = /^(crear|editar|borrar|insertar|guardar|mover|marcar|separar|actualizar|aplicar|registrar|cambiar|subir|unir|quitar|deshacer|vincular|releer)/;
// Activar o quitar las notificaciones de tu celular siempre se puede
const SIEMPRE = new Set(["guardarSuscripcionPush", "borrarSuscripcionPush"]);

export const escribe = (metodo: string) => ESCRIBE.test(metodo) && !SIEMPRE.has(metodo);

export function conCandado<T extends object>(repo: T, leerSuscripcion: () => Promise<Suscripcion | null>, ahora = () => Date.now()): T {
  let revision: Promise<Suscripcion | null> | null = null; // una sola consulta por petición
  return new Proxy(repo, {
    get(objetivo, prop, receptor) {
      const valor = Reflect.get(objetivo, prop, receptor);
      if (typeof valor !== "function" || typeof prop !== "string" || !escribe(prop)) return typeof valor === "function" ? valor.bind(objetivo) : valor;
      return async (...args: unknown[]) => {
        const s = await (revision ??= leerSuscripcion().catch(() => null));
        if (!puedeEscribir(s, ahora())) throw new Error(mensajeDeEstado(s, ahora()) ?? "Necesitas una suscripción activa para guardar cambios.");
        return valor.apply(objetivo, args);
      };
    },
  });
}
