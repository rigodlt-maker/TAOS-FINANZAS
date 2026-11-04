import { Titulo } from "@/components/taos/encabezado";
import { Sugerencias } from "@/components/taos/sugerencias";

// Ideas, fallas y mejoras: llegan directo al equipo de TAOS (Google Form de soluciones.taos@gmail.com)
export default function PaginaSugerencias() {
  return (
    <div className="grid gap-4">
      <Titulo detalle="¿Una idea, algo que falla o algo que mejorarías? Lo leemos todo y lo más pedido entra en las próximas versiones.">Sugerencias</Titulo>
      <Sugerencias app="Administrador Tao" />
    </div>
  );
}
