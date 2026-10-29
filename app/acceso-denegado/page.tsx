export const dynamic = "force-dynamic";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { correosPermitidos, supabaseConfigurado } from "@/lib/supabase/config";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function AccesoDenegado({ searchParams }: { searchParams: Promise<{ correo?: string }> }) {
  let { correo } = await searchParams;
  // Si alguien con otro correo llegó a iniciar sesión, se cierra su sesión
  if (supabaseConfigurado()) {
    const db = await clienteServidor();
    correo ??= (await db.auth.getUser()).data.user?.email ?? undefined;
    await db.auth.signOut();
  }
  const configurado = correosPermitidos().length > 0;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm text-center">
        <CardTitle className="text-xl">Acceso denegado</CardTitle>
        <CardDescription className="mt-2">Esta es una aplicación personal y tu correo no tiene acceso.</CardDescription>
        <p className="mt-4 text-xs text-muted-foreground">
          {correo && <>Intentaste entrar con: {correo}. </>}
          {configurado ? "El correo permitido está configurado." : "Falta configurar ALLOWED_EMAIL en Vercel."}
        </p>
        <a href="/login" className="mt-3 inline-block text-sm underline">
          Intentar con otro correo
        </a>
      </Card>
    </main>
  );
}
