import { dinero, diasDelMes, redondear } from "./formato";
import type { AnalisisMeta } from "./metas";
import type { ResumenCategoria } from "./presupuesto";
import type { PagoProgramado } from "./tipos";

// Categorías donde normalmente es más fácil recortar
const RECORTABLES = ["Comida fuera", "Entretenimiento", "Ropa y personal", "Suscripciones", "Otros", "Súper y despensa"];

export type Recorte = { categoria: string; monto: number; motivo: string };

// Versión sin IA de "¿De dónde saco la diferencia?": primero lo excedido, luego un 15% de lo recortable
export function proponerRecortes(diferenciaMensual: number, resumen: ResumenCategoria[]): Recorte[] {
  let falta = diferenciaMensual;
  const recortes: Recorte[] = [];
  for (const r of resumen) {
    if (falta <= 0) break;
    const exceso = r.presupuesto > 0 ? Math.max(r.gastado, r.proyeccion) - r.presupuesto : 0;
    if (exceso > 0) {
      const monto = redondear(Math.min(exceso, falta));
      recortes.push({ categoria: r.categoria.nombre, monto, motivo: `Va ${dinero(exceso)} arriba de su presupuesto` });
      falta -= monto;
    }
  }
  for (const nombre of RECORTABLES) {
    if (falta <= 0) break;
    const r = resumen.find((x) => x.categoria.nombre === nombre);
    if (!r || recortes.some((x) => x.categoria === nombre)) continue;
    const base = Math.max(r.proyeccion, r.presupuesto);
    const monto = redondear(Math.min(base * 0.15, falta));
    if (monto >= 50) {
      recortes.push({ categoria: nombre, monto, motivo: "Recorte de 15% en un gasto que se puede ajustar" });
      falta -= monto;
    }
  }
  return recortes;
}

// Versión sin IA de la acción recomendada de la semana
export function accionSemanal(
  resumen: ResumenCategoria[],
  pagos: (PagoProgramado & { alcanza?: boolean | null })[],
  metas: AnalisisMeta[],
  hoy: string,
): string {
  const excedida = resumen.find((r) => r.estado === "excedido");
  if (excedida) {
    return `Pausa los gastos de ${excedida.categoria.nombre} esta semana: ya va ${dinero(-excedida.diferencia)} arriba de su presupuesto.`;
  }
  const enRiesgo = resumen.find((r) => r.estado === "en_riesgo");
  if (enRiesgo) {
    const [a, m] = hoy.split("-").map(Number);
    const semanasRestantes = Math.max(1, (diasDelMes(a, m) - Number(hoy.slice(8, 10)) + 1) / 7);
    return `Limita ${enRiesgo.categoria.nombre} a ${dinero(Math.max(0, enRiesgo.diferencia) / semanasRestantes)} esta semana para no pasarte del presupuesto.`;
  }
  const sinSaldo = pagos.find((p) => p.alcanza === false);
  if (sinSaldo) return `Separa ${dinero(sinSaldo.monto)} para "${sinSaldo.nombre}": el saldo de la cuenta asociada no alcanza.`;
  const atrasada = metas.find((m) => !m.llegaATiempo && m.falta > 0);
  if (atrasada) {
    return `Aporta ${dinero(atrasada.porMes / 4)} a "${atrasada.meta.nombre}" esta semana para recuperar el ritmo.`;
  }
  return "Vas bien con tu presupuesto. Si puedes, aparta un extra para tu meta de ahorro.";
}
