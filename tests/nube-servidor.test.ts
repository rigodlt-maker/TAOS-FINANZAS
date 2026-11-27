// Nube F5 · El SQL del servidor de Nube (las 4 apps en un solo proyecto) se instala completo y separa a cada persona.
// Con TAOS_PG_URL corre la prueba de aislamiento completa sobre ese SQL (npm run prueba:nube); aquí se revisa que exista
// y que traiga las tablas clave de cada app.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("el SQL del servidor de Nube trae las 4 apps y las tablas de Nube", () => {
  assert.ok(existsSync("supabase/nube/instalar-nube.sql"), "falta correr node scripts/nube-sql.cjs");
  const s = readFileSync("supabase/nube/instalar-nube.sql", "utf8");
  for (const tabla of ["accounts", "suscripciones", "script_claves", "taos_migraciones", "fit_profiles", "fit_sets", "documents", "document_chunks", "panel_config", "panel_tick_ejecuciones", "push_subscriptions"])
    assert.match(s, new RegExp(`create table (if not exists )?public\\.${tabla}\\b`), tabla);
  // Cada app que va adentro también tiene su propio SQL al día (si una plantilla cambia, se vuelve a generar)
  assert.ok(s.includes(readFileSync("supabase/instalar.sql", "utf8").trim()), "el SQL de Finanzas cambió: vuelve a correr node scripts/nube-sql.cjs");
});
