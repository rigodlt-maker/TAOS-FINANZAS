"use client";
// Campo de contraseña con ojito para ver u ocultar lo que se escribe (en todas las pantallas de contraseña)
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "./campos";

export function InputContrasena(props: Omit<React.ComponentProps<"input">, "type">) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={ver ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="pr-12" />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"}
        aria-pressed={ver}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground"
      >
        {ver ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
