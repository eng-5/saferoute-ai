import { cn } from "@/lib/utils"

export function GlassPanel({ children, className, variant = "default" }) {
    return (
        <div
            className={cn(
                "rounded-xl",
                variant === "default" ? "glass" : "glass-dark",
                className
            )}
        >
            {children}
        </div>
    )
}
