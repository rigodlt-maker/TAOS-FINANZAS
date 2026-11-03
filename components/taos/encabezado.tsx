import Link from "next/link";

// Encabezado compacto: logo, nombre de la app y una acción opcional a la derecha
export function Encabezado({ nombre, derecha }: { nombre: string; derecha?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-between gap-3 bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
      {/* El nombre se recorta con "…" si no cabe, para que los botones de la derecha nunca se salgan */}
      <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
        <img src="/icono-192.png" alt="" width={32} height={32} className="shrink-0 rounded-lg" />
        <span className="truncate text-lg font-semibold tracking-tight">{nombre}</span>
      </Link>
      {derecha && <div className="shrink-0">{derecha}</div>}
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
