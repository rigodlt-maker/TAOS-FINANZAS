import { dinero } from "@/lib/formato";
import type { GastoDeHoy } from "@/lib/gastar-hoy";
import { Card } from "./ui/card";

// Tarjeta "Hoy puedes gastar": la respuesta a "¿cuánto me puedo gastar hoy?" sin preguntarle a Tao
export function GastarHoy({ g }: { g: GastoDeHoy }) {
  const nada = g.puedes <= 0;
  return (
    <Card className="grid gap-2">
      <p className="text-sm text-muted-foreground">{nada ? "Hoy" : "Hoy puedes gastar"}</p>
      <p className={`text-3xl font-semibold tracking-tight ${nada ? "text-destructive" : "text-primary"}`}>{nada ? "Mejor ya no gastes 🙏" : dinero(g.puedes)}</p>
      <p className="text-sm text-muted-foreground">
        {g.gastadoHoy > 0 ? `Llevas ${dinero(g.gastadoHoy)} hoy · ` : ""}
        te tocan {dinero(g.diario)} al día por {g.dias === 1 ? "hoy, último día del mes" : `${g.dias} días que faltan`}
      </p>
      <p className="text-xs text-muted-foreground">
        {g.base === "presupuesto" ? "Según lo que te queda de tu presupuesto del mes." : "Según tu dinero libre, ya descontando tarjetas y pagos que vienen."}
      </p>
    </Card>
  );
}
