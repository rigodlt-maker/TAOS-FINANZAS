import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const variantesBoton = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold active:scale-[0.98] transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "border border-destructive text-destructive hover:bg-destructive/10",
      },
      size: {
        default: "min-h-12 px-5",
        sm: "min-h-10 px-4 text-sm",
        lg: "min-h-14 px-6 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof variantesBoton>) {
  return <button className={cn(variantesBoton({ variant, size }), className)} {...props} />;
}
