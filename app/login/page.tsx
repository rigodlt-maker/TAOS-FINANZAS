import { headers } from "next/headers";
import Link from "next/link";
import { BotonCopiar } from "@/components/boton-copiar";
import { Copiar } from "@/components/copiar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/campos";
import { pasoDeEntrada } from "@/lib/instalacion";
import { SQL_INSTALAR } from "@/lib/sql";
import { crearContrasena, entrarConContrasena, enviarEnlace } from "./acciones";

export const dynamic = "force-dynamic";

const NOMBRE = "Administrador Tao";
// Si falta la tabla principal, es la primera vez: hay que correr el código SQL completo.
// (Lo que agregan las actualizaciones se pide adentro de la app, solo lo nuevo: lib/configuracion.ts)
const TABLAS: [string, string][] = [["accounts", "id"]];

export default async function Login({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string }> }) {
  const { enviado, error } = await searchParams;
  const estado = await pasoDeEntrada(TABLAS);
  const h = await headers();
  const direccion = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const aviso = error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardTitle className="text-xl">{NOMBRE}</CardTitle>

        {enviado ? (
          <CardDescription className="mt-3">Te enviamos un enlace para entrar. Ábrelo desde este mismo celular o computadora, en este mismo navegador.</CardDescription>
        ) : estado.paso === "variables" ? (
          <div className="mt-4 grid gap-3 text-sm">
            <p className="font-semibold">Paso 1 de 3 · Revisa tus datos en Vercel</p>
            <ul className="grid list-disc gap-2 pl-5 text-destructive">
              {estado.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <ol className="grid list-decimal gap-1 pl-5 text-muted-foreground">
              <li>
                En <strong>vercel.com</strong> abre este proyecto › <strong>Settings</strong> › <strong>Environment Variables</strong>.
              </li>
              <li>Agrega o corrige el dato (sin espacios al principio ni al final) y toca Save.</li>
              <li>
                Ve a <strong>Deployments</strong>, toca los 3 puntitos del primero › <strong>Redeploy</strong>.
              </li>
              <li>Espera 1 minuto y vuelve a abrir esta página.</li>
            </ol>
          </div>
        ) : estado.paso === "sql" ? (
          <div className="mt-4 grid gap-3 text-sm">
            <p className="font-semibold">Paso 2 de 3 · Prepara tu base de datos</p>
            <p className="text-muted-foreground">Copia este código y pégalo una vez en Supabase. Crea las tablas de {NOMBRE}, protegidas para que solo tú veas tus datos.</p>
            <ol className="grid list-decimal gap-1 pl-5 text-muted-foreground">
              <li>Toca «Copiar código».</li>
              <li>
                En <strong>supabase.com</strong> abre tu proyecto y, en el menú de la izquierda, entra a <strong>SQL Editor</strong>.
              </li>
              <li>
                Pega el código y toca <strong>Run</strong>. Si sale el aviso «Potential issues detected», toca el botón verde <strong>Run and enable RLS</strong>: no borra nada tuyo.
              </li>
              <li>Cuando diga «Success», regresa aquí y toca «Ya lo corrí».</li>
            </ol>
            <Copiar texto={SQL_INSTALAR} />
            <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl border font-semibold">
              Ya lo corrí
            </Link>
          </div>
        ) : estado.paso === "crear" ? (
          <form action={crearContrasena} className="mt-4 grid gap-4">
            <div className="grid gap-1 text-sm">
              <p className="font-semibold">Paso 3 de 3 · Crea tu contraseña</p>
              <p className="text-muted-foreground">Es la primera vez que entras. Escribe tu correo y tu código de compra (los mismos que pusiste en Vercel) y crea una contraseña. No te llegará ningún correo: entras al momento.</p>
            </div>
            <Label>
              Tu correo
              <Input name="correo" type="email" required autoComplete="email" placeholder="tunombre@gmail.com" />
            </Label>
            <Label>
              Tu código de compra (el que pegaste en Vercel)
              <Input name="codigo" required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HP…" />
            </Label>
            <Label>
              Crea una contraseña (mínimo 8 caracteres)
              <Input name="contrasena" type="password" required minLength={8} autoComplete="new-password" />
            </Label>
            <Label>
              Escríbela otra vez
              <Input name="confirmar" type="password" required minLength={8} autoComplete="new-password" />
            </Label>
            {aviso}
            <Button type="submit">Crear contraseña y entrar</Button>
            <p className="text-xs text-muted-foreground">Guárdala bien: es la misma para tus 4 apps TAOS.</p>
          </form>
        ) : (
          <>
            <form action={entrarConContrasena} className="mt-4 grid gap-4">
              <Label>
                Tu correo
                <Input name="correo" type="email" required autoComplete="email" placeholder="tunombre@gmail.com" />
              </Label>
              <Label>
                Contraseña
                <Input name="contrasena" type="password" required autoComplete="current-password" />
              </Label>
              {aviso}
              <Button type="submit">Entrar</Button>
              <p className="text-xs text-muted-foreground">Es la misma contraseña de tus otras apps TAOS.</p>
            </form>
            <details className="mt-5 border-t pt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground">¿Olvidaste tu contraseña? Entra con un enlace por correo</summary>
              <div className="mt-3 grid gap-3">
                <p className="text-muted-foreground">
                  Antes, una sola vez: en Supabase ve a <strong>Authentication</strong> › <strong>URL Configuration</strong>. En <strong>Redirect URLs</strong> toca <strong>Add URL</strong>, pega
                  esta dirección y guarda:
                </p>
                <BotonCopiar texto={`${direccion}/auth/callback`} />
                <p className="text-xs text-muted-foreground">Si no la agregas, el enlace te mandará a «localhost» y no abrirá. Supabase solo deja mandar 2 correos por hora.</p>
                <form action={enviarEnlace} className="grid gap-3">
                  <Input name="correo" type="email" required autoComplete="email" placeholder="tunombre@gmail.com" aria-label="Tu correo" />
                  <Button type="submit" variant="outline">
                    Enviarme el enlace
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">Al entrar, crea una contraseña nueva en «Menú › Ajustes».</p>
              </div>
            </details>
          </>
        )}
      </Card>
    </main>
  );
}
