// Nube F4 · Aviso arriba de la app cuando no hay suscripción vigente (o hay un problema de pago)
import { Suscribirme } from "@/components/suscribirme";
import { esNube } from "@/lib/modo";
import { mensajeDeEstado } from "@/lib/suscripcion";
import { suscripcionDe } from "@/lib/suscripcion-servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function AvisoSuscripcion() {
  if (!esNube() || !supabaseConfigurado()) return null;
  const { data } = await (await clienteServidor()).auth.getClaims();
  const usuario = data?.claims?.sub;
  if (!usuario) return null;
  const s = await suscripcionDe(clienteAdmin(), usuario);
  const mensaje = mensajeDeEstado(s);
  if (!mensaje) return null;
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-primary/60 bg-card p-4">
      <p className="text-sm">{mensaje}</p>
      <Suscribirme />
    </div>
  );
}
