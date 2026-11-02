import { Suspense } from "react";
import { redirect } from "next/navigation";
import { configuracionPendiente } from "@/lib/configuracion";
import { ChatAsesor } from "@/components/chat-asesor";
import { Navegacion } from "@/components/navegacion";
import { Encabezado } from "@/components/taos/encabezado";
import { Recorrido, type Paso } from "@/components/taos/recorrido";
import { BotonTao } from "@/components/taos/tao";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Recorrido de bienvenida (sale una sola vez)
const RECORRIDO: Paso[] = [
  { icono: "💸", titulo: "Bienvenido a Administrador Tao", texto: "Tu dinero en orden: cuentas, tarjetas, pagos y metas de ahorro en un solo lugar." },
  { icono: "🎙️", titulo: "Registra en una línea", texto: "Toca Tao (arriba) y escribe o di con el micrófono: “350 súper con débito”. Tao lo registra y tú solo confirmas." },
  { icono: "💳", titulo: "Cero intereses", texto: "En Pagos ves lo del corte de cada tarjeta: lo que tienes que pagar para no generar intereses, y cuándo." },
  { icono: "🐜", titulo: "Presupuesto y gastos hormiga", texto: "Pon límite a tus categorías y descubre esos gastitos que se comen tu quincena." },
  { icono: "🔔", titulo: "Activa los avisos", texto: "En Menú › Ajustes activa las notificaciones: te aviso 7 y 2 días antes de cada pago." },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // Primera vez (o tras una actualización): primero se crean las tablas en Supabase
  if (await configuracionPendiente()) redirect("/configurar");
  const repo = await obtenerRepo();
  const porRevisar = await repo.contarPorRevisar();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <Encabezado
        nombre="Administrador Tao"
        derecha={
          <BotonTao>
            <ChatAsesor enHoja />
          </BotonTao>
        }
      />
      {repo.modo === "demo" && !process.env.OCULTAR_AVISO_DEMO && (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Modo demostración:</strong> estás viendo datos de ejemplo.
        </p>
      )}
      <main>{children}</main>
      <Suspense>
        <Recorrido pasos={RECORRIDO} />
      </Suspense>
      <Navegacion porRevisar={porRevisar} />
    </div>
  );
}
