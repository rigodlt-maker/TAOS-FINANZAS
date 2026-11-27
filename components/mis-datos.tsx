// Nube F1 · Tarjeta «Tus datos»: descargarlos (siempre) y borrar tu cuenta (solo TAOS Nube)
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { borrarMiCuenta } from "@/lib/mis-datos-acciones";
import { esNube } from "@/lib/modo";

export function MisDatos() {
  const nube = esNube();
  return (
    <Card id="mis-datos" className="scroll-mt-24">
      <CardTitle className="mb-1">Tus datos</CardTitle>
      <CardDescription className="mb-3">Son tuyos: descárgalos cuando quieras en un archivo (.json) que puedes guardar o abrir con otras apps.</CardDescription>
      <a href="/api/mis-datos" className="flex min-h-12 items-center justify-center rounded-xl border text-sm font-medium" download>
        Descargar mis datos
      </a>
      {nube && (
        <details className="mt-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-destructive">Borrar mi cuenta</summary>
          <form action={borrarMiCuenta} className="mt-2 grid gap-2">
            <p className="text-sm text-muted-foreground">
              Se borran para siempre tu cuenta y todo lo que guardaste en las apps TAOS (movimientos, entrenos, documentos y archivos). No se puede deshacer. Antes, descarga tus datos.
            </p>
            <label className="grid gap-1 text-sm">
              Escribe BORRAR para confirmar
              <input name="confirmacion" required pattern="BORRAR" title="Escribe BORRAR, en mayúsculas" autoComplete="off" className="min-h-12 rounded-xl border bg-card px-4" />
            </label>
            <button type="submit" className="min-h-12 rounded-xl bg-destructive font-semibold text-white">
              Borrar mi cuenta para siempre
            </button>
          </form>
        </details>
      )}
    </Card>
  );
}
