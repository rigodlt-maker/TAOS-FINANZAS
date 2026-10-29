import Link from "next/link";
import { redirect } from "next/navigation";
import { Copiar } from "@/components/copiar";
import { configuracionPendiente } from "@/lib/configuracion";
import { SQL_INSTALAR } from "@/lib/sql";

export const dynamic = "force-dynamic";

// Primera vez (o tras una actualización): crea las tablas de la app en tu Supabase con un solo pegado
export default async function Configurar() {
  if (!(await configuracionPendiente())) redirect("/");
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Un último paso: tu base de datos</h1>
      <p className="text-sm text-muted-foreground">Copia este código y pégalo una vez en Supabase. Crea las tablas de la app, protegidas para que solo tú veas tus datos.</p>
      <ol className="grid list-decimal gap-2 rounded-2xl border bg-card p-4 pl-8 text-sm">
        <li>Toca «Copiar código».</li>
        <li>
          En <strong>supabase.com</strong>, abre tu proyecto y entra a <strong>SQL Editor</strong>.
        </li>
        <li>
          Pega el código y toca <strong>Run</strong>. Si sale un aviso de «destructive operations», toca <strong>Run query</strong>: solo crea o reemplaza reglas de las tablas de
          esta app.
        </li>
        <li>Cuando diga «Success», toca «Ya lo corrí».</li>
      </ol>
      <Copiar texto={SQL_INSTALAR} />
      <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl border font-semibold">
        Ya lo corrí
      </Link>
    </main>
  );
}
