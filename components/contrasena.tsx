"use client";

import { cambiarContrasena } from "@/app/login/acciones";
import { Formulario } from "./formulario";
import { Input, Label } from "./ui/campos";

// Crear o cambiar la contraseña para entrar sin esperar el correo
export function FormularioContrasena() {
  return (
    <Formulario accion={cambiarContrasena} boton="Guardar contraseña" limpiar>
      <Label>
        Nueva contraseña
        <Input name="contrasena" type="password" minLength={8} required autoComplete="new-password" />
      </Label>
      <Label>
        Repítela
        <Input name="confirmar" type="password" minLength={8} required autoComplete="new-password" />
      </Label>
    </Formulario>
  );
}
