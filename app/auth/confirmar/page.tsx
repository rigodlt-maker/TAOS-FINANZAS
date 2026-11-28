// Nube F5 · Pantalla del enlace del correo: un botón para entrar (el enlace se canjea al tocarlo, no al abrirlo)
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mensajeDeEnlace, tipoDeEnlace, tokenValido } from "@/lib/enlace-correo";
import { confirmarEnlace } from "./acciones";

export const dynamic = "force-dynamic";

const TEXTOS: Record<string, { titulo: string; boton: string }> = {
  signup: { titulo: "Confirma tu cuenta TAOS", boton: "Confirmar y entrar" },
  email: { titulo: "Entra a tu cuenta TAOS", boton: "Entrar" },
  magiclink: { titulo: "Entra a tu cuenta TAOS", boton: "Entrar" },
  recovery: { titulo: "Recupera tu cuenta TAOS", boton: "Entrar" },
  email_change: { titulo: "Confirma tu correo nuevo", boton: "Confirmar" },
  invite: { titulo: "Entra a tu cuenta TAOS", boton: "Entrar" },
};

export default async function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  const tipo = tipoDeEnlace(type);
  if (!tokenValido(token_hash) || !tipo) redirect(`/login?error=${encodeURIComponent(mensajeDeEnlace(null))}`);
  const texto = TEXTOS[tipo] ?? TEXTOS.email;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardTitle className="text-xl">{texto.titulo}</CardTitle>
        <CardDescription className="mt-2">Toca el botón para continuar.</CardDescription>
        <form action={confirmarEnlace} className="mt-4 grid gap-3">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={tipo} />
          <Button type="submit">
            {texto.boton}
          </Button>
        </form>
      </Card>
    </main>
  );
}
