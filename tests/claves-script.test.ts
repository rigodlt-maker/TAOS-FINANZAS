// Nube F1 · Claves por usuario para los scripts de Google: cada clave lleva a SU dueña, y a nadie más
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claveDelEncabezado, crearClave, duenoDeClave, huellaClave, nuevaClave } from "../lib/claves-script";

// Base falsa: guarda filas de script_claves como lo haría Postgres (llave primaria user_id+app, huella única)
function baseFalsa() {
  const filas: { user_id: string; app: string; huella: string }[] = [];
  const db = {
    from: () => ({
      upsert: async (f: { user_id: string; app: string; huella: string }) => {
        const i = filas.findIndex((x) => x.user_id === f.user_id && x.app === f.app);
        if (i >= 0) filas[i] = f;
        else filas.push(f);
        return { error: null };
      },
      select: () => {
        const filtros: Record<string, string> = {};
        const q = {
          eq: (c: string, v: string) => ((filtros[c] = v), q),
          maybeSingle: async () => ({ data: filas.find((f) => Object.entries(filtros).every(([c, v]) => (f as Record<string, string>)[c] === v)) ?? null, error: null }),
        };
        return q;
      },
    }),
  } as unknown as SupabaseClient;
  return { db, filas };
}

test("la clave tiene su app y es larga; solo se guarda la huella", async () => {
  const c = nuevaClave("correos");
  assert.match(c, /^tk_correos_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(nuevaClave("correos"), c);
  const { db, filas } = baseFalsa();
  const clave = await crearClave(db, "usuaria-a", "correos");
  assert.equal(filas.length, 1);
  assert.equal(filas[0].huella, huellaClave(clave));
  assert.ok(!JSON.stringify(filas).includes(clave), "la clave no se guarda");
});

test("dos usuarias: cada clave lleva a su dueña; una clave inventada, de otra app o vacía no lleva a nadie", async () => {
  const { db } = baseFalsa();
  const deA = await crearClave(db, "usuaria-a", "correos");
  const deB = await crearClave(db, "usuaria-b", "correos");
  const driveDeA = await crearClave(db, "usuaria-a", "drive");
  assert.equal(await duenoDeClave(db, "correos", deA), "usuaria-a");
  assert.equal(await duenoDeClave(db, "correos", deB), "usuaria-b");
  assert.equal(await duenoDeClave(db, "drive", driveDeA), "usuaria-a");
  assert.equal(await duenoDeClave(db, "correos", driveDeA), null); // clave de Drive no sirve para Gmail
  assert.equal(await duenoDeClave(db, "correos", nuevaClave("correos")), null);
  assert.equal(await duenoDeClave(db, "correos", null), null);
});

test("crear otra clave reemplaza la anterior (la vieja deja de servir)", async () => {
  const { db } = baseFalsa();
  const vieja = await crearClave(db, "usuaria-a", "drive");
  const nueva = await crearClave(db, "usuaria-a", "drive");
  assert.equal(await duenoDeClave(db, "drive", vieja), null);
  assert.equal(await duenoDeClave(db, "drive", nueva), "usuaria-a");
});

test("el encabezado Authorization: Bearer <clave>", () => {
  const r = (v?: string) => new Request("https://x.mx", { headers: v ? { authorization: v } : {} });
  assert.equal(claveDelEncabezado(r("Bearer tk_drive_abcdefghijklmnop")), "tk_drive_abcdefghijklmnop");
  assert.equal(claveDelEncabezado(r("Bearer corta")), null);
  assert.equal(claveDelEncabezado(r()), null);
});
