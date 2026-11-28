// Nube · Crear tu contraseña nueva (después de «¿Olvidaste tu contraseña?»). Sirve para las 4 apps TAOS.
import Link from "next/link";
import { FormularioContrasena } from "@/components/contrasena";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function NuevaContrasena() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardTitle className="text-xl">🔑 Crea tu contraseña nueva</CardTitle>
        <CardDescription className="mt-2">Es una sola para tus 4 apps TAOS: Administrador Tao, Tao Fit, Optimizador de Vida y Segundo Cerebro. Mínimo 8 caracteres; toca el ojito para ver lo que escribes.</CardDescription>
        <div className="mt-4">
          <FormularioContrasena />
        </div>
        <Link href="/" className="mt-4 flex min-h-12 items-center justify-center rounded-xl border text-sm font-medium">
          Ir a la app
        </Link>
      </Card>
    </main>
  );
}
