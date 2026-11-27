"use server";
// Nube F1 · «Borrar mi cuenta» (solo TAOS Nube). En tu versión propia, tus datos viven en tu Supabase: ahí los controlas tú.
import { redirect } from "next/navigation";
import { borrarCuenta } from "@/lib/mis-datos";
import { esNube } from "@/lib/modo";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function borrarMiCuenta(f: FormData) {
  if (!esNube()) redirect("/?error=solo-nube");
  // El navegador ya pide escribir BORRAR; si aun así no llega, no se borra nada
  if (String(f.get("confirmacion") ?? "").trim() !== "BORRAR") redirect("/");
  const db = await clienteServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  // El id sale de TU sesión, nunca del formulario
  await borrarCuenta(clienteAdmin(), data.user.id);
  await db.auth.signOut().catch(() => {});
  redirect("/login?cuenta=borrada");
}
