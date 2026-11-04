import Link from "next/link";
import { redirect } from "next/navigation";
import { Copiar } from "@/components/copiar";
import { estadoBD, sqlPendiente } from "@/lib/configuracion";

export const dynamic = "force-dynamic";

// Primera vez (o tras una actualización): crea las tablas de la app en tu Supabase con un solo pegado
export default async function Configurar() {
  const bd = await estadoBD();
  if (!bd.pendientes.length) redirect("/");
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{bd.primeraVez ? "Un último paso: tu base de datos" : "Tu app se actualizó: falta 1 minuto"}</h1>
      <p className="text-sm text-muted-foreground">
        {bd.primeraVez
          ? "Copia este código y pégalo una vez en Supabase. Crea las tablas de la app, protegidas para que solo tú veas tus datos."
          : "La versión nueva trae funciones que necesitan un lugar en tu base de datos. Este código solo agrega lo nuevo: no borra ni cambia nada de lo que ya tienes."}
      </p>
      <ol className="grid list-decimal gap-2 rounded-2xl border bg-card p-4 pl-8 text-sm">
        <li>Toca «Copiar código».</li>
        <li>
          En <strong>supabase.com</strong>, abre tu proyecto y entra a <strong>SQL Editor</strong>.
        </li>
        <li>
          Pega el código y toca <strong>Run</strong>. Si sale el aviso «Potential issues detected», toca el botón verde <strong>Run and enable RLS</strong>: solo crea o reemplaza reglas de las tablas de
          esta app.
        </li>
        <li>Cuando diga «Success», toca «Ya lo corrí».</li>
      </ol>
      <Copiar texto={sqlPendiente(bd)} />
      <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl border font-semibold">
        Ya lo corrí
      </Link>
    </main>
  );
}
