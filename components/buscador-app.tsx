"use client";

// El buscador 🔍 con las pantallas de Administrador Tao (lib/destinos.ts)
import { Buscador } from "@/components/taos/buscador";
import { DESTINOS, GRUPOS } from "@/lib/destinos";

export function BuscadorApp() {
  return <Buscador destinos={DESTINOS} grupos={GRUPOS} ejemplo="Ej. pagar tarjeta" pistas="pagar, tarjeta, ticket" />;
}
