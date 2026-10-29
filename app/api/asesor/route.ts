import { responderAsesor } from "@/lib/asesor";
import { hoyLocal, mesDe, rangoDelMes, sumarMeses } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import { leerAjusteSaldo, textoAjuste } from "@/lib/ajuste-chat";
import { leerCobro, leerDeposito, leerEnvio, textoDeposito, textoEnvio } from "@/lib/envios";
import { dinero } from "@/lib/formato";
import { leerGastoDeChat, textoPropuestaGasto } from "@/lib/gasto-chat";
import { leerTransferencia, proponerMovimiento } from "@/lib/transferencias";

export const dynamic = "force-dynamic";

// Ruta fija (no acción del servidor): sigue funcionando aunque la app se haya actualizado con la página abierta
export async function POST(req: Request) {
  const { pregunta } = (await req.json().catch(() => ({}))) as { pregunta?: string };
  const limpia = String(pregunta ?? "").trim().slice(0, 300);
  try {
    const repo = await obtenerRepo();
    const hoy = hoyLocal();
    const [cuentas, categorias, movimientos, pagos, metas, aportaciones, transferencias] = await Promise.all([
      repo.cuentas(),
      repo.categorias(),
      repo.movimientos({ desde: rangoDelMes(sumarMeses(mesDe(hoy), -12)).inicio }),
      repo.pagos(),
      repo.metas(),
      repo.aportaciones(),
      repo.transferencias(300),
    ]);
    // "Moví 5 mil de Revolut a Nu" / "Pagué Palacio con Revolut": se propone el movimiento y tú confirmas
    const movimiento = leerTransferencia(limpia, cuentas, hoy);
    if (movimiento) return Response.json(proponerMovimiento(movimiento, cuentas, hoy));
    // "Modifica mi efectivo a $4,100": ajuste de saldo, con confirmación
    const ajuste = leerAjusteSaldo(limpia, cuentas);
    if (ajuste) return Response.json({ respuesta: textoAjuste(ajuste), ajuste });
    // "María me pagó": cobro de un préstamo (si todavía no se corre el SQL de préstamos, no hay préstamos)
    const prestamos = await repo.prestamos().catch(() => []);
    const cobro = leerCobro(limpia, prestamos, cuentas);
    if (cobro)
      return Response.json({
        respuesta: `Entendí que **${cobro.persona}** te pagó${cobro.monto < cobro.pendiente ? ` **${dinero(cobro.monto)}** (te debe ${dinero(cobro.pendiente)})` : ` todo: **${dinero(cobro.pendiente)}**`}. ¿A qué cuenta te llegó?`,
        cobro,
      });
    // "Mandé $5000 a María", "Le presté 5 mil a Juan, me paga el 15 de noviembre"
    const envio = leerEnvio(limpia, cuentas, hoy);
    if (envio) return Response.json({ respuesta: textoEnvio(envio), envio });
    // "Agrega 7300 a cajita turbo": entró dinero a una cuenta tuya; se pregunta de dónde
    const deposito = leerDeposito(limpia, cuentas, hoy);
    if (deposito) return Response.json({ respuesta: textoDeposito(deposito), deposito });
    // "Pagué $30 de tamales con efectivo" / "me pagaron 5 mil": gasto o ingreso, también con confirmación
    const gasto = leerGastoDeChat(limpia, cuentas, categorias, await repo.reglas(), hoy);
    if (gasto) return Response.json({ respuesta: textoPropuestaGasto(gasto, hoy), gasto });
    const respuesta = responderAsesor(limpia, { hoy, cuentas, categorias, movimientos, pagos, metas, aportaciones, transferencias, prestamos });
    return Response.json({ respuesta });
  } catch (e) {
    console.error("Asesor:", e);
    return Response.json({ respuesta: `No pude revisar tus datos: ${(e as Error).message}` }, { status: 500 });
  }
}
