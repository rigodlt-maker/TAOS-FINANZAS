// Se muestra al instante mientras el servidor prepara la página
export default function Cargando() {
  return (
    <div className="grid animate-pulse gap-4" aria-label="Cargando">
      <div className="h-8 w-1/3 rounded-lg bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
