import { ChatAsesor } from "@/components/chat-asesor";
import { Titulo } from "@/components/taos/encabezado";

export default function Asesor() {
  return (
    <div className="pb-20">
      <Titulo detalle="Tu asesor TAOS. Pregúntale sobre tus gastos, pagos y tarjetas, o dile qué gastaste o moviste (“Pagué $30 de tamales con efectivo”) y lo registra.">Tao</Titulo>
      <ChatAsesor />
    </div>
  );
}
