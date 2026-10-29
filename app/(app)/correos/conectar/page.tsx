import { headers } from "next/headers";
import { Copiar } from "@/components/copiar";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { urlDeLaApp } from "@/lib/correo";
import { claveCorreos, scriptGmail } from "@/lib/script-gmail";

export const dynamic = "force-dynamic";

const PASOS = [
  "Toca “Copiar código”.",
  "Abre script.google.com con la cuenta de Gmail donde te llegan los correos del banco y toca “Nuevo proyecto”.",
  "Borra lo que aparece y pega el código. Toca el ícono de guardar (💾).",
  "Arriba, junto a “Ejecutar”, elige la función “instalar” y toca “Ejecutar”.",
  "Google te pedirá permiso: “Revisar permisos” › tu cuenta › “Configuración avanzada” › “Ir a Proyecto sin título” › “Permitir”. Es tu propio script: solo lee los correos de tus bancos y los manda a tu app.",
  "Abajo debe decir “¡Listo!”. Desde ese momento, cada 10 minutos revisa tus correos nuevos del banco.",
];

// Guía para conectar Gmail con un script de Google (gratis y sin dar tu contraseña a nadie)
export default async function ConectarGmail() {
  const clave = claveCorreos();
  const h = await headers();
  const url = urlDeLaApp() ?? `https://${h.get("host")}`;

  return (
    <div className="grid gap-4">
      <Titulo detalle="Una sola vez, en 5 minutos. Funciona con Nu, Revolut, HSBC, BBVA, Amex y otros bancos.">Conectar Gmail</Titulo>
      {!clave ? (
        <Card>
          <CardTitle>Primero conecta Supabase</CardTitle>
          <CardDescription className="mt-2">Esto funciona cuando la app ya guarda tus datos reales (no en modo demostración).</CardDescription>
        </Card>
      ) : (
        <>
          <Card className="grid gap-3">
            <ol className="grid list-decimal gap-2 pl-5 text-sm">
              {PASOS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </Card>
          <Card>
            <Copiar texto={scriptGmail(url, clave)} />
          </Card>
          <Card>
            <CardTitle>Qué pasa con cada correo</CardTitle>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
              <li>Dinero entre tus cuentas (por ejemplo, de Revolut a Nu): se registra como movimiento entre cuentas.</li>
              <li>Pago a una tarjeta: baja la deuda; si no se sabe de qué cuenta salió, te pregunta.</li>
              <li>Compras y transferencias a otras personas: gasto en “Por revisar” para que le pongas categoría.</li>
              <li>Todo se puede deshacer en Más › Avisos del banco, y nunca se registra dos veces.</li>
            </ul>
          </Card>
          <CardDescription className="text-center">El código contiene tu clave personal: no lo compartas.</CardDescription>
        </>
      )}
    </div>
  );
}
