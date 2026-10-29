"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dinero, dineroCorto } from "@/lib/formato";

const ejes = { fontSize: 12, fill: "var(--muted-foreground)" };
const cuadro = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--foreground)",
  },
  cursor: { fill: "var(--muted)" },
  formatter: (v: unknown) => dinero(Number(v)),
};
const leyenda = { wrapperStyle: { fontSize: 12, color: "var(--muted-foreground)" }, iconType: "square" as const, iconSize: 10 };

// Presupuesto contra gastado por categoría (barras horizontales; el gasto excedido va en rojo)
export function GraficaPresupuesto({
  datos,
}: {
  datos: { categoria: string; presupuesto: number; gastado: number; excedido: boolean }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, datos.length * 46 + 60)}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={dineroCorto} tick={ejes} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="categoria" width={130} tick={ejes} axisLine={false} tickLine={false} />
        <Tooltip {...cuadro} />
        <Legend {...leyenda} />
        <Bar dataKey="presupuesto" name="Presupuesto" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="gastado" name="Gastado (rojo = excedido)" fill="var(--chart-1)" radius={[0, 4, 4, 0]}>
          {datos.map((d) => (
            <Cell key={d.categoria} fill={d.excedido ? "var(--destructive)" : "var(--chart-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Ingresos y gastos de los últimos 6 meses
export function GraficaMeses({ datos }: { datos: { mes: string; ingresos: number; gastos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ left: 0, right: 8 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="mes" tick={ejes} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={dineroCorto} tick={ejes} axisLine={false} tickLine={false} width={72} />
        <Tooltip {...cuadro} />
        <Legend {...leyenda} />
        <Bar dataKey="ingresos" name="Ingresos" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
