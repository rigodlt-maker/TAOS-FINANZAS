import Link from "next/link";

// Encabezado compacto: logo, nombre de la app y una acción opcional a la derecha
export function Encabezado({ nombre, derecha }: { nombre: string; derecha?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-between gap-3 bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
      <Link href="/" className="flex min-h-11 items-center gap-2.5">
        <img src="/icono-192.png" alt="" width={32} height={32} className="rounded-lg" />
        <span className="text-lg font-semibold tracking-tight">{nombre}</span>
      </Link>
      {derecha}
    </header>
  );
}

// Título de cada pantalla
export function Titulo({ children, detalle }: { children: React.ReactNode; detalle?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {detalle && <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>}
    </div>
  );
}
