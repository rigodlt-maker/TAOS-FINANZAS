import { accionSemanal } from "./consejos";
import { escapar as e } from "./correo";
import type { Repo } from "./datos/repo";
import { dinero, fechaCorta, hoyLocal, mesDe, nombreMes, rangoDelMes } from "./formato";
import { accionDeLaSemana, iaDisponible } from "./ia";
import { analizarMeta } from "./metas";
import { contextoTarjetas } from "./tarjetas";
import { actualizarVencimiento, alertasDePago, alertasDeTarjeta, pagosDeTarjeta, pagosProximos, saldoDisponible } from "./pagos";
import { resumenPorCategoria } from "./presupuesto";

// Alertas de pago de hoy (7 y 2 días antes). También adelanta las fechas de los pagos recurrentes ya vencidos.
export async function prepararAlertasDePago(repo: Repo, hoy = hoyLocal()) {
  const [pagos, cuentas] = await Promise.all([repo.pagos(), repo.cuentas()]);
  for (const p of pagos) {
    const nueva = actualizarVencimiento(p, hoy);
    if (nueva !== p.proximo_vencimiento) await repo.editarPago(p.id, { proximo_vencimiento: nueva });
  }
  const alertas = alertasDePago(pagos, cuentas, hoy);
  const tarjetas = alertasDeTarjeta(cuentas, hoy, [7, 2], await contextoTarjetas(repo, hoy));
  const bloquesTarjeta = tarjetas.map(
    (t) =>
      `<strong>Pago de tarjeta ${e(t.cuenta.nombre)}</strong><br>Fecha límite: ${fechaCorta(t.vence)} (en ${t.dias} días).<br>` +
      (t.deuda > 0 ? `Para no generar intereses: ${dinero(t.deuda)} (lo de tu corte). ` : "") +
      (t.nuevas > 0.5 ? `Tus compras después del corte (${dinero(t.nuevas)}) van al siguiente estado de cuenta. ` : "") +
      "Confírmalo en la app de tu banco.",
  );
  const bloquesPagos = alertas.map((a) => {
    const saldo =
      a.cuenta === null
        ? "Sin cuenta asociada."
        : a.alcanza
          ? `El saldo de ${e(a.cuenta.nombre)} (${dinero(saldoDisponible(a.cuenta))}) alcanza.`
          : `<strong style="color:#dc2626">El saldo de ${e(a.cuenta.nombre)} (${dinero(saldoDisponible(a.cuenta))}) no alcanza.</strong>`;
    return `<strong>${e(a.pago.nombre)}</strong>: ${dinero(a.pago.monto)}<br>Vence el ${fechaCorta(a.pago.proximo_vencimiento)} (en ${a.dias} días).<br>${saldo}`;
  });
  return { alertas, tarjetas, bloques: [...bloquesPagos, ...bloquesTarjeta] };
}

// Reporte semanal: presupuesto, metas, pagos de los próximos 14 días y una acción recomendada
export async function prepararReporteSemanal(repo: Repo, hoy = hoyLocal()) {
  const mes = mesDe(hoy);
  const [categorias, movimientos, metas, aportaciones, pagos, cuentas] = await Promise.all([
    repo.categorias(),
    repo.movimientos({ desde: rangoDelMes(mes).inicio, hasta: rangoDelMes(mes).fin }),
    repo.metas(),
    repo.aportaciones(),
    repo.pagos(),
    repo.cuentas(),
  ]);
  const resumen = resumenPorCategoria(mes, hoy, categorias, movimientos).filter((r) => r.presupuesto > 0);
  const analisisMetas = metas.map((m) => analizarMeta(m, aportaciones, hoy));
  const proximos = pagosProximos(pagos, hoy, 14).map((p) => {
    const c = cuentas.find((x) => x.id === p.account_id);
    return { ...p, alcanza: c ? saldoDisponible(c) >= p.monto : null };
  });

  const tarjetasProximas = pagosDeTarjeta(cuentas, hoy, 14, await contextoTarjetas(repo, hoy)).filter((t) => t.yaCorto);
  let accion = accionSemanal(resumen, proximos, analisisMetas, hoy);
  if (iaDisponible()) {
    try {
      accion = await accionDeLaSemana({
        presupuesto: resumen.map((r) => ({ categoria: r.categoria.nombre, gastado: r.gastado, presupuesto: r.presupuesto, estado: r.estado })),
        metas: analisisMetas.map((a) => ({ meta: a.meta.nombre, falta: a.falta, a_tiempo: a.llegaATiempo, por_mes: a.porMes })),
        pagos_14_dias: proximos.map((p) => ({ pago: p.nombre, monto: p.monto, fecha: p.proximo_vencimiento, alcanza: p.alcanza })),
      });
    } catch (err) {
      console.error("La IA no pudo sugerir la acción de la semana:", err);
    }
  }

  const gastado = resumen.reduce((t, r) => t + r.gastado, 0);
  const presupuesto = resumen.reduce((t, r) => t + r.presupuesto, 0);
  const estado = (r: (typeof resumen)[number]) =>
    r.estado === "excedido" ? ' <strong style="color:#dc2626">excedido</strong>' : r.estado === "en_riesgo" ? " <strong>en riesgo</strong>" : "";

  const bloques = [
    `<strong>💡 Acción de la semana</strong><br>${e(accion)}`,
    `<strong>Presupuesto de ${nombreMes(mes)}</strong>: ${dinero(gastado)} de ${dinero(presupuesto)}<br>` +
      resumen
        .slice(0, 6)
        .map((r) => `${e(r.categoria.nombre)}: ${dinero(r.gastado)} / ${dinero(r.presupuesto)}${estado(r)}`)
        .join("<br>"),
    analisisMetas.length
      ? "<strong>Metas de ahorro</strong><br>" +
        analisisMetas
          .map((a) => `${e(a.meta.nombre)}: ${Math.round(a.porcentaje)}% · ${a.llegaATiempo ? "a tiempo" : `faltan ${dinero(a.diferenciaMensual || a.porMes)} al mes`}`)
          .join("<br>")
      : "",
    proximos.length || tarjetasProximas.length
      ? "<strong>Pagos de los próximos 14 días</strong><br>" +
        [
          ...proximos.map((p) => ({
            fecha: p.proximo_vencimiento,
            texto: `${e(p.nombre)}: ${dinero(p.monto)}${p.alcanza === false ? ' <strong style="color:#dc2626">(saldo insuficiente)</strong>' : ""}`,
          })),
          ...tarjetasProximas.map((t) => ({
            fecha: t.vence,
            texto: `Fecha límite tarjeta ${e(t.cuenta.nombre)}${t.deuda > 0 ? `: ${dinero(t.deuda)}` : ""}`,
          })),
        ]
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .map((x) => `${fechaCorta(x.fecha)} · ${x.texto}`)
          .join("<br>")
      : "",
  ].filter(Boolean);
  return { bloques, accion };
}
