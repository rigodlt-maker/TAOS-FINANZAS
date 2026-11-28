// Contraseñas: todo campo de contraseña tiene ojito, y una pantalla de una versión anterior se recarga sola
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { esVersionVieja } from "../lib/version-vieja";

const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith(".tsx") ? [p] : [];
  });

test("todos los campos de contraseña usan el campo con ojito (ver/ocultar)", () => {
  const sueltos = [...archivos("app"), ...archivos("components").filter(Boolean)]
    .filter((p) => p !== "components/ui/contrasena.tsx")
    .filter((p) => /type="password"/.test(readFileSync(p, "utf8")));
  assert.deepEqual(sueltos, []);
});

test("«Server Action not found» (pantalla de una versión anterior) se reconoce para recargar", () => {
  assert.ok(esVersionVieja({ message: 'Server Action "7f3a…" was not found on the server.' }));
  assert.ok(esVersionVieja({ message: "Failed to find Server Action. This request might be from an older or newer deployment." }));
  assert.ok(!esVersionVieja({ message: "Correo o contraseña incorrectos" }));
});
