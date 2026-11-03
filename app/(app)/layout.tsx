import { Suspense } from "react";
import { redirect } from "next/navigation";
import { configuracionPendiente } from "@/lib/configuracion";
import { ChatAsesor } from "@/components/chat-asesor";
import { Navegacion } from "@/components/navegacion";
import { OcultarMontos } from "@/components/ocultar-montos";
import { SinInternet } from "@/components/sin-internet";
import { Encabezado } from "@/components/taos/encabezado";
import { Recorrido, type Paso } from "@/components/taos/recorrido";
import { Campana } from "@/components/taos/campana";
import { BotonTao } from "@/components/taos/tao";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Recorrido de bienvenida (sale una sola vez)
const RECORRIDO: Paso[] = [
  { icono: "💸", titulo: "Bienvenido a Administrador Tao", texto: "Tu dinero en orden: cuentas, tarjetas, pagos y metas en un solo lugar. Te enseño lo básico en 1 minuto." },
  { icono: "🎙️", titulo: "Registra en una línea", texto: "Toca Tao y escribe o di: “350 súper con débito”. Tao lo registra y tú solo confirmas.", donde: "tao" },
  { icono: "➕", titulo: "Agregar a mano", texto: "Un gasto, un ingreso o la foto de tu ticket: todo empieza aquí.", donde: "flotante" },
  { icono: "💳", titulo: "Cero intereses", texto: "Lo que debes pagar de cada tarjeta para no generar intereses, y cuándo.", donde: "/pagos" },
  { icono: "👁️", titulo: "Ojito", texto: "¿Abres la app en público? Toca aquí y se ocultan todas las cantidades.", donde: "ojito" },
  { icono: "🔔", titulo: "Tus avisos", texto: "Aquí quedan los avisos que te manda la app, por si se te pasó alguno. El numerito te dice cuántos no has visto.", donde: "campana" },
  { icono: "🐜", titulo: "Presupuesto", texto: "Pon límite a tus categorías y descubre tus gastos hormiga.", donde: "/presupuesto" },
  { icono: "🔔", titulo: "Todo lo demás", texto: "Préstamos, metas, avisos del banco y Ajustes. Activa las notificaciones y te aviso antes de cada pago.", donde: "/mas" },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // Primera vez (o tras una actualización): primero se crean las tablas en Supabase
  if (await configuracionPendiente()) redirect("/configurar");
  const repo = await obtenerRepo();
  const porRevisar = await repo.contarPorRevisar();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <Encabezado
        nombre="Admin Tao"
        derecha={
          <div className="flex items-center gap-2">
            <OcultarMontos />
            <Campana ajustes="/ajustes" />
            <BotonTao>
              <ChatAsesor enHoja />
            </BotonTao>
          </div>
        }
      />
      {repo.modo === "demo" && !process.env.OCULTAR_AVISO_DEMO && (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Modo demostración:</strong> estás viendo datos de ejemplo.
        </p>
      )}
      <SinInternet />
      <main>{children}</main>
      <Suspense>
        <Recorrido pasos={RECORRIDO} />
      </Suspense>
      <Navegacion porRevisar={porRevisar} />
    </div>
  );
}
