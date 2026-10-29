import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Desplegable, Formulario } from "@/components/formulario";
import { PagarTarjeta } from "@/components/pagar-tarjeta";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/campos";
import { guardarSaldoAlCorte } from "@/lib/acciones";
import { dinero, fechaCorta, hoyLocal } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import { contextoTarjetas, estadoTarjeta } from "@/lib/tarjetas";

export default async function Pagar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hoy = hoyLocal();
  const repo = await obtenerRepo();
  const cuentas = await repo.cuentas();
  const tarjeta = cuentas.find((c) => c.id === id && c.tipo === "credito");
  if (!tarjeta) notFound();
  const { movimientos, transferencias } = await contextoTarjetas(repo, hoy);
  const e = estadoTarjeta(tarjeta, movimientos, transferencias, hoy);
  // Se puede pagar desde débito, ahorro o efectivo (las que tienen dinero, primero)
  const origenes = cuentas
    .filter((c) => c.tipo !== "credito")
    .sort((a, b) => b.saldo_actual - a.saldo_actual)
    .map((c) => ({ id: c.id, nombre: c.nombre, saldo: c.saldo_actual }));

  return (
    <div className="grid gap-4">
      <Link href="/" className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-5" /> Inicio
      </Link>
      <Titulo detalle={e.corte && e.limite ? `Corte: ${fechaCorta(e.corte)} · Fecha límite: ${fechaCorta(e.limite)}` : undefined}>Pagar {tarjeta.nombre}</Titulo>

      {e.total < 0.5 ? (
        <Card>
          <p className="text-3xl font-semibold text-primary">Sin deuda 🎉</p>
        </Card>
      ) : (
        <Card className="grid gap-3">
          {e.corte ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Para no generar intereses</p>
                <p className={`text-3xl font-semibold ${e.alCorte > 0.5 ? "text-destructive" : "text-primary"}`}>{e.alCorte > 0.5 ? dinero(e.alCorte) : "Ya está cubierto ✅"}</p>
                {e.alCorte > 0.5 && e.limite && (
                  <p className="text-sm text-muted-foreground">
                    {e.vencido ? `Venció el ${fechaCorta(e.limite)}` : `Antes del ${fechaCorta(e.limite)}`} · {e.confirmado ? "según tu app del banco" : "calculado con tus compras"}
                  </p>
                )}
              </div>
              {e.nuevas > 0.5 && (
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">Compras después del corte</p>
                  <p className="text-xl font-semibold">{dinero(e.nuevas)}</p>
                  <p className="text-sm text-muted-foreground">
                    Van a tu siguiente estado de cuenta{e.siguienteLimite ? `: se pagan hasta el ${fechaCorta(e.siguienteLimite)}` : ""}.
                  </p>
                </div>
              )}
              <p className="border-t pt-3 text-sm">
                Total para dejarla en ceros: <strong>{dinero(e.total)}</strong>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Debes</p>
              <p className="text-3xl font-semibold text-destructive">{dinero(e.total)}</p>
              <CardDescription>Agrega el día de corte y de pago de esta tarjeta en Más › Ajustes para separar lo del corte de las compras nuevas.</CardDescription>
            </>
          )}
        </Card>
      )}

      {e.corte && e.total >= 0.5 && (
        <Desplegable titulo={<span className="text-sm">¿Tu app del banco dice otro monto?</span>}>
          <Formulario accion={guardarSaldoAlCorte.bind(null, tarjeta.id)} boton="Guardar">
            <Label>
              “Pago para no generar intereses” de tu corte del {fechaCorta(e.corte)}
              <Input name="saldo_al_corte" inputMode="decimal" defaultValue={e.confirmado ? String(tarjeta.saldo_al_corte) : ""} placeholder={String(e.alCorte)} required />
            </Label>
            <CardDescription>Escríbelo tal cual tu app del banco. La app lo usará hasta tu siguiente corte y le irá restando tus pagos.</CardDescription>
          </Formulario>
        </Desplegable>
      )}

      {origenes.length === 0 ? (
        <CardDescription>Primero agrega tu cuenta de débito, ahorro o efectivo en Más › Ajustes.</CardDescription>
      ) : (
        <PagarTarjeta tarjetaId={tarjeta.id} deuda={e.total} alCorte={e.corte ? e.alCorte : e.total} origenes={origenes} />
      )}
      <p className="text-xs text-muted-foreground">
        Se resta de la cuenta que elijas y baja tu deuda. No cuenta como gasto (las compras ya están en tus movimientos).
      </p>
    </div>
  );
}
