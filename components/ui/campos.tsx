import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border bg-card px-4 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-12", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(base, "h-12", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("grid gap-1.5 text-sm font-medium", className)} {...props} />;
}

export function Badge({
  className,
  tono = "neutro",
  ...props
}: React.ComponentProps<"span"> & { tono?: "neutro" | "fuerte" | "rojo" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tono === "fuerte" && "border-primary text-primary",
        tono === "rojo" && "border-destructive text-destructive",
        tono === "neutro" && "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Progreso({ valor, rojo = false }: { valor: number; rojo?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", rojo ? "bg-destructive" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
      />
    </div>
  );
}
