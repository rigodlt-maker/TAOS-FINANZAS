import { Titulo } from "@/components/taos/encabezado";
import { SuscripcionesLista } from "@/components/suscripciones-lista";
import { Card, CardDescription } from "@/components/ui/card";
import { hoyLocal, mesDe, sumarDias } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import { detectarSuscripciones } from "@/lib/suscripciones";

// Mis suscripciones: todo lo que te cobran cada mes o cada año, y cuáles ya no usas
export default async function Suscripciones() {
  const repo = await obtenerRepo();
  const hoy = hoyLocal();
  const [movimientos, categorias, cuentas, pagos] = await Promise.all([repo.movimientos({ desde: sumarDias(hoy, -400) }), repo.categorias(), repo.cuentas(), repo.pagos()]);
  const lista = detectarSuscripciones(movimientos, categorias, hoy);
  return (
    <div className="grid gap-4">
      <Titulo detalle="Lo que te cobran cada mes o cada año. Marca si lo usaste y descubre lo que pagas sin usar.">Mis suscripciones</Titulo>
      {lista.length ? (
        <SuscripcionesLista lista={lista} cuentas={Object.fromEntries(cuentas.map((c) => [c.id, c.nombre]))} avisando={pagos.map((p) => p.nombre)} mes={mesDe(hoy)} />
      ) : (
        <Card>
          <CardDescription>
            Todavía no encuentro cobros que se repitan. Aparecen solos cuando un mismo cargo (Netflix, Spotify, gimnasio…) se repite cada mes; también si pones la categoría
            “Suscripciones” a un gasto.
          </CardDescription>
        </Card>
      )}
      <CardDescription className="text-center">Se detectan de tus movimientos: mismo lugar, monto parecido, cada mes o cada año. Lo de “¿la usaste?” se guarda en este celular.</CardDescription>
    </div>
  );
}
