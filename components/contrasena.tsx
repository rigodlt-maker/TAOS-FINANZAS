"use client";

import { cambiarContrasena } from "@/app/login/acciones";
import { Formulario } from "./formulario";
import { Input, Label } from "./ui/campos";
import { InputContrasena } from "@/components/ui/contrasena";

// Crear o cambiar la contraseña para entrar sin esperar el correo
export function FormularioContrasena() {
  return (
    <Formulario accion={cambiarContrasena} boton="Guardar contraseña" limpiar>
      <Label>
        Nueva contraseña
        <InputContrasena name="contrasena" minLength={8} required autoComplete="new-password" />
      </Label>
      <Label>
        Repítela
        <InputContrasena name="confirmar" minLength={8} required autoComplete="new-password" />
      </Label>
    </Formulario>
  );
}
