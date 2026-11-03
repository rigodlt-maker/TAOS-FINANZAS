import { Titulo } from "@/components/taos/encabezado";
import { SuscripcionesLista } from "@/components/suscripciones-lista";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { dinero, fechaCorta, hoyLocal, mesDe, sumarDias } from "@/lib/formato";
import { comprasAMeses } from "@/lib/msi";
import { obtenerRepo } from "@/lib/sesion";
import { detectarSuscripciones } from "@/lib/suscripciones";

// Mis suscripciones: todo lo que te cobran cada mes o cada año, y cuáles ya no usas
export default async function Suscripciones() {
  const repo = await obtenerRepo();
  const hoy = hoyLocal();
  const [movimientos, categorias, cuentas, pagos] = await Promise.all([repo.movimientos({ desde: sumarDias(hoy, -400) }), repo.categorias(), repo.cuentas(), repo.pagos()]);
  const lista = detectarSuscripciones(movimientos, categorias, hoy);
  const aMeses = comprasAMeses(movimientos, hoy);
  const nombreCuenta = Object.fromEntries(cuentas.map((c) => [c.id, c.nombre]));
  return (
    <div className="grid gap-4">
      <Titulo detalle="Lo que te cobran cada mes o cada año. Marca si lo usaste y descubre lo que pagas sin usar.">Mis suscripciones</Titulo>
      {lista.length ? (
        <SuscripcionesLista lista={lista} cuentas={nombreCuenta} avisando={pagos.map((p) => p.nombre)} mes={mesDe(hoy)} />
      ) : (
        <Card>
          <CardDescription>
            Todavía no encuentro cobros que se repitan. Aparecen solos cuando un mismo cargo (Netflix, Spotify, gimnasio…) se repite cada mes; también si pones la categoría
            “Suscripciones” a un gasto.
          </CardDescription>
        </Card>
      )}
      {aMeses.length > 0 && (
        <Card className="grid gap-3">
          <div>
            <CardTitle>A meses sin intereses</CardTitle>
            <CardDescription className="mt-1">
              No son suscripciones: son compras que pagas en mensualidades y se acaban solas. Pagas {dinero(aMeses.reduce((t, c) => t + c.monto, 0))} al mes.
            </CardDescription>
          </div>
          <ul className="divide-y">
            {aMeses.map((c) => (
              <li key={c.nombre} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.nombre}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.va && c.de ? `Mensualidad ${c.va} de ${c.de} · ${c.faltan ? `te faltan ${c.faltan} (${dinero(c.resta!)})` : "¡es la última!"}` : `Último cargo ${fechaCorta(c.ultimo)}`}
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap">{dinero(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <CardDescription className="text-center">Se detectan de tus movimientos: mismo lugar, monto parecido, cada mes o cada año. Lo de “¿la usaste?” se guarda en este celular.</CardDescription>
    </div>
  );
}
