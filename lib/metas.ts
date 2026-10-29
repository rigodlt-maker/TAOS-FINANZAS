import { diasEntre, redondear, sumarDias } from "./formato";
import type { Aportacion, Meta } from "./tipos";

export type AnalisisMeta = {
  meta: Meta;
  falta: number;
  porcentaje: number;
  mesesRestantes: number;
  porMes: number;
  porQuincena: number;
  ritmoMensual: number; // promedio aportado por mes en los últimos 3 meses
  llegaATiempo: boolean;
  mesesDeRetraso: number | null; // null si al ritmo actual nunca llega (ritmo 0)
  diferenciaMensual: number; // cuánto más hay que ahorrar al mes para llegar a tiempo
};

const DIAS_POR_MES = 30.44;

export function analizarMeta(meta: Meta, aportaciones: Aportacion[], hoy: string): AnalisisMeta {
  const falta = Math.max(0, redondear(meta.monto_objetivo - meta.monto_actual));
  const porcentaje = Math.min(100, (meta.monto_actual / meta.monto_objetivo) * 100);
  const mesesRestantes = Math.max(0, diasEntre(hoy, meta.fecha_objetivo) / DIAS_POR_MES);
  // Si la fecha ya pasó, todo lo que falta es "para este mes"
  const mesesParaCalculo = Math.max(1, mesesRestantes);
  const porMes = redondear(falta / mesesParaCalculo);
  const porQuincena = redondear(falta / (mesesParaCalculo * 2));

  const hace3Meses = sumarDias(hoy, -91);
  const aportado = aportaciones
    .filter((a) => a.goal_id === meta.id && a.fecha > hace3Meses && a.fecha <= hoy)
    .reduce((t, a) => t + a.monto, 0);
  const ritmoMensual = redondear(Math.max(0, aportado) / 3);

  let llegaATiempo = falta === 0;
  let mesesDeRetraso: number | null = 0;
  if (falta > 0) {
    if (ritmoMensual <= 0) {
      mesesDeRetraso = null;
    } else {
      const mesesNecesarios = falta / ritmoMensual;
      llegaATiempo = mesesNecesarios <= mesesRestantes;
      mesesDeRetraso = llegaATiempo ? 0 : Math.ceil(mesesNecesarios - mesesRestantes);
    }
  }
  return {
    meta,
    falta,
    porcentaje,
    mesesRestantes,
    porMes,
    porQuincena,
    ritmoMensual,
    llegaATiempo,
    mesesDeRetraso,
    diferenciaMensual: llegaATiempo ? 0 : redondear(Math.max(0, porMes - ritmoMensual)),
  };
}
