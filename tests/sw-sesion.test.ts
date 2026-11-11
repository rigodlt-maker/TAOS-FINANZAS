import assert from "node:assert/strict";
import test from "node:test";
import { swDePrueba } from "./ayuda/sw";

test("S15-P: después de cerrar sesión, un aviso nuevo no se guarda en la bandeja ni muestra su contenido", async () => {
  const sw = swDePrueba();
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Pago de tarjeta", cuerpo: "Nu: pagar $4,300.00 mañana" });
  assert.equal(sw.bandeja().length, 1);
  // Cierra sesión: se borra la bandeja y se cierran las notificaciones a la vista
  await sw.mensaje("taos-sin-sesion");
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  assert.ok(sw.mostradas.every((n) => n.cerrada));
  // Llega otro aviso sin sesión: genérico y la bandeja NO se vuelve a crear
  await sw.push({ titulo: "Compra con tu tarjeta", cuerpo: "OXXO $80.00 con Nu" });
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  const ultima = sw.mostradas.at(-1)!;
  assert.equal(ultima.titulo, "Administrador Tao");
  assert.doesNotMatch(ultima.opciones.body ?? "", /OXXO|80|Nu/);
  // Vuelve a entrar: los avisos se guardan otra vez
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Cobro", cuerpo: "Juan te debe $500.00" });
  assert.equal(sw.bandeja().length, 1);
});

test("S15-P: si el celular no sabe si hay sesión (instalación vieja, sin anotar), se comporta como antes", async () => {
  const sw = swDePrueba();
  await sw.push({ titulo: "Pago", cuerpo: "x" });
  assert.equal(sw.bandeja().length, 1);
});
