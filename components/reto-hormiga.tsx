// Reto del mes "cero hormiga" (ver retoHormiga en lib/hormiga.ts)
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Progreso } from "@/components/ui/campos";
import { dinero, dineroCorto } from "@/lib/formato";
import type { RetoHormiga as Reto } from "@/lib/hormiga";

export function RetoHormiga({ r }: { r: Reto }) {
  const lugares = r.lugares.length > 3 ? `${r.lugares.slice(0, 3).join(", ")} y ${r.lugares.length - 3} más` : r.lugares.join(", ").replace(/, ([^,]*)$/, " y $1");
  const pct = r.meta ? (r.ahorrado / r.meta) * 100 : 0;
  return (
    <Card className="grid gap-3">
      <div>
        <CardTitle>🎯 Reto del mes: cero hormiga</CardTitle>
        <CardDescription className="mt-1">
          El mes pasado se te fueron <strong className="text-foreground">{dinero(r.meta)}</strong> en {lugares}. Si este mes no compras ahí, te ahorras eso:{" "}
          <strong className="text-primary">{dineroCorto(r.meta * 12)} al año</strong>.
        </CardDescription>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-2xl font-semibold">{r.diasSin}</p>
          <p className="text-xs text-muted-foreground">{r.diasSin === 1 ? "día seguido" : "días seguidos"} sin caer 🔥</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-2xl font-semibold text-primary">{dineroCorto(r.ahorrado)}</p>
          <p className="text-xs text-muted-foreground">vas ahorrando este mes</p>
        </div>
      </div>
      <Progreso valor={pct} />
      <p className="text-sm text-muted-foreground">
        {r.veces === 0 ? "¡Vas perfecto! Ninguna compra hormiga este mes." : `Este mes llevas ${r.veces === 1 ? "1 compra" : `${r.veces} compras`} ahí por ${dinero(r.llevas)}.`}
      </p>
    </Card>
  );
}
