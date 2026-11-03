import { test } from "node:test";
import assert from "node:assert/strict";
import { comoCancelar, detectarSuscripciones, sinUsar } from "../lib/suscripciones";
import type { Movimiento } from "../lib/tipos";

let n = 0;
const mov = (fecha: string, comercio: string, monto: number, category_id: string | null = null): Movimiento => ({
  id: String(n++), account_id: "tdc", fecha, descripcion_original: comercio, comercio, monto, tipo: "gasto",
  category_id, requiere_revision: false, es_recurrente: false, hash_unico: String(n), import_id: null,
});
const cats = [
  { id: "sus", nombre: "Suscripciones", presupuesto_mensual: 0, color_neutro: "" },
  { id: "serv", nombre: "Servicios", presupuesto_mensual: 0, color_neutro: "" },
  { id: "casa", nombre: "Casa y remodelación", presupuesto_mensual: 0, color_neutro: "" },
];

test("detecta lo mensual y lo anual; no confunde compras frecuentes ni lo ya cancelado", () => {
  const movs = [
    mov("2026-08-05", "Netflix", 219), mov("2026-09-05", "Netflix", 219), mov("2026-10-05", "Netflix", 249),
    mov("2026-09-12", "Spotify", 129), mov("2026-10-12", "Spotify", 129),
    mov("2025-11-20", "Amazon Prime", 899), mov("2026-11-01", "Amazon Prime", 899),
    // café casi diario: no es suscripción
    ...["2026-10-01", "2026-10-03", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"].map((f) => mov(f, "Starbucks", 75)),
    // gimnasio que ya no cobra desde julio: cancelado
    mov("2026-05-10", "Gym Ejemplo", 499), mov("2026-06-10", "Gym Ejemplo", 499), mov("2026-07-10", "Gym Ejemplo", 499),
    // Lo que se repite pero no es suscripción: ahorro, internet de la casa, compras parecidas en la ferretería
    mov("2026-09-28", "Ahorro", 3000), mov("2026-10-28", "Ahorro", 3000),
    mov("2026-09-08", "Telmex", 499, "serv"), mov("2026-10-08", "Telmex", 499, "serv"),
    mov("2026-09-07", "Home Depot", 1180, "casa"), mov("2026-10-07", "Home Depot", 1250, "casa"),
    mov("2026-09-15", "Ferretería La Esquina", 300), mov("2026-10-14", "Ferretería La Esquina", 340),
    // un comercio desconocido que cobra exactamente lo mismo cada mes sí cuenta
    mov("2026-09-18", "Club de Lectura MX", 150), mov("2026-10-18", "Club de Lectura MX", 150),
    // primer cargo de una app en la categoría Suscripciones
    mov("2026-10-25", "App de meditación", 99, "sus"),
  ];
  const s = detectarSuscripciones(movs, cats, "2026-11-03");
  assert.deepEqual(s.map((x) => x.nombre), ["Netflix", "Club de Lectura MX", "Spotify", "App de meditación", "Amazon Prime"]);
  const netflix = s[0];
  assert.equal(netflix.monto, 249);
  assert.equal(netflix.proximo, "2026-11-05");
  const prime = s.find((x) => x.nombre === "Amazon Prime")!;
  assert.equal(prime.frecuencia, "anual");
  assert.equal(prime.proximo, "2027-11-01");
  assert.equal(Math.round(prime.alMes), 75);
});

test("cómo cancelar: página oficial o búsqueda", () => {
  assert.deepEqual(comoCancelar("NETFLIX.COM"), { url: "https://www.netflix.com/cancelplan", oficial: true });
  assert.equal(comoCancelar("Gym Ejemplo").oficial, false);
});

test("¿la usas? 2 meses seguidos en no = probablemente no", () => {
  assert.equal(sinUsar({ netflix: { "2026-10": "no", "2026-11": "no" } }, "netflix", "2026-11"), "nunca");
  assert.equal(sinUsar({ netflix: { "2026-11": "no" } }, "netflix", "2026-11"), "este-mes");
  assert.equal(sinUsar({ netflix: { "2025-12": "no", "2026-01": "no" } }, "netflix", "2026-01"), "nunca");
  assert.equal(sinUsar({}, "netflix", "2026-11"), null);
});
