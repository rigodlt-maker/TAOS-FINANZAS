// Nube F3 · «Crear cuenta» en TAOS Nube. En tu versión propia esta pantalla no existe (te manda a la entrada).
import Link from "next/link";
import { redirect } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/campos";
import { esNube } from "@/lib/modo";
import { crearCuenta } from "./acciones";

// Se arma en cada visita: depende de TAOS_MODO, que no debe quedar fijo desde el build
export const dynamic = "force-dynamic";

const PRIVACIDAD = process.env.NEXT_PUBLIC_URL_PRIVACIDAD?.trim();
const TERMINOS = process.env.NEXT_PUBLIC_URL_TERMINOS?.trim();
const SITIO_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export default async function Registro({ searchParams }: { searchParams: Promise<{ error?: string; listo?: string }> }) {
  if (!esNube()) redirect("/login");
  const { error, listo } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardTitle className="text-xl">Crea tu cuenta TAOS</CardTitle>
        {listo ? (
          <>
            <CardDescription className="mt-3">{listo}</CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">¿No llega? Revisa «Spam» o «Promociones». El enlace funciona una sola vez.</p>
            <Link href="/login" className="mt-4 flex min-h-12 items-center justify-center rounded-xl border text-sm font-medium">
              Ir a la entrada
            </Link>
          </>
        ) : (
          <form action={crearCuenta} className="mt-4 grid gap-4">
            <CardDescription>Una sola cuenta para las 4 apps: Administrador Tao, Tao Fit, Optimizador de Vida y Segundo Cerebro.</CardDescription>
            <Label>
              Tu correo
              <Input name="correo" type="email" required autoComplete="email" placeholder="tunombre@gmail.com" />
            </Label>
            <Label>
              Contraseña (mínimo 8 caracteres)
              <Input name="contrasena" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </Label>
            <Label>
              Escríbela otra vez
              <Input name="confirmar" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </Label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="acepta" required className="mt-1 size-5 shrink-0" />
              <span>
                Acepto el{" "}
                {PRIVACIDAD ? (
                  <a href={PRIVACIDAD} target="_blank" className="text-primary underline">
                    aviso de privacidad
                  </a>
                ) : (
                  "aviso de privacidad"
                )}{" "}
                y los{" "}
                {TERMINOS ? (
                  <a href={TERMINOS} target="_blank" className="text-primary underline">
                    términos
                  </a>
                ) : (
                  "términos"
                )}
                . TAOS organiza tu vida; no da consejos médicos, financieros ni de inversión.
              </span>
            </label>
            {SITIO_TURNSTILE && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
                <div className="cf-turnstile" data-sitekey={SITIO_TURNSTILE} data-language="es" data-theme="dark" />
              </>
            )}
            {error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button type="submit">Crear mi cuenta</Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-primary underline">
                Entra aquí
              </Link>
            </p>
          </form>
        )}
      </Card>
    </main>
  );
}
