"use client";

import dynamic from "next/dynamic";

const Espacio = ({ alto }: { alto: number }) => <div className="animate-pulse rounded-lg bg-muted" style={{ height: alto }} />;

// La librería de gráficas es pesada: se descarga aparte, sin frenar el resto del inicio
export const GraficaPresupuesto = dynamic(() => import("./graficas").then((m) => m.GraficaPresupuesto), {
  ssr: false,
  loading: () => <Espacio alto={320} />,
});
export const GraficaMeses = dynamic(() => import("./graficas").then((m) => m.GraficaMeses), {
  ssr: false,
  loading: () => <Espacio alto={260} />,
});
