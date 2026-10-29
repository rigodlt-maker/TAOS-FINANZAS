import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/campos";
import { entrarConContrasena, enviarEnlace } from "./acciones";

export default async function Login({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string }> }) {
  const { enviado, error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardTitle className="text-xl">Asesor Financiero</CardTitle>
        {enviado ? (
          <CardDescription className="mt-3">
            Te enviamos un enlace para entrar. Ábrelo desde este mismo dispositivo y navegador.
          </CardDescription>
        ) : (
          <>
            <form action={entrarConContrasena} className="mt-4 grid gap-4">
              <Label>
                Tu correo
                <Input name="correo" type="email" required autoComplete="email" placeholder="tu@correo.com" />
              </Label>
              <Label>
                Contraseña
                <Input name="contrasena" type="password" required autoComplete="current-password" />
              </Label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Entrar</Button>
            </form>
            <details className="mt-5 border-t pt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground">¿Sin contraseña? Recibe un enlace por correo</summary>
              <form action={enviarEnlace} className="mt-3 grid gap-3">
                <Input name="correo" type="email" required autoComplete="email" placeholder="tu@correo.com" aria-label="Tu correo" />
                <Button type="submit" variant="outline">
                  Enviarme el enlace para entrar
                </Button>
              </form>
            </details>
          </>
        )}
      </Card>
    </main>
  );
}
