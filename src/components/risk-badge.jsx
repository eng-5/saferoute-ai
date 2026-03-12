import { cn } from "@/lib/utils"

const riskConfig = {
    low: {
        label: "LOW",
        bgClass: "bg-mint/20",
        textClass: "text-mint",
    },
    medium: {
        label: "MEDIUM",
        bgClass: "bg-amber/20",
        textClass: "text-amber",
    },
    high: {
        label: "HIGH",
        bgClass: "bg-coral/20",
        textClass: "text-coral",
    },
}

export function RiskBadge({ level, className, showLabel = true }) {
    const config = riskConfig[level]

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider",
                config.bgClass,
                config.textClass,
                className
            )}
        >
            <span
                className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    level === "low" && "bg-mint",
                    level === "medium" && "bg-amber",
                    level === "high" && "bg-coral"
                )}
            />
            {showLabel && config.label}
        </span>
    )
}
