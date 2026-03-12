import { cn } from "@/lib/utils"

const colorClasses = {
    mint: "bg-mint",
    amber: "bg-amber",
    coral: "bg-coral",
    sky: "bg-sky",
    purple: "bg-purple",
}

export function ConfidenceMeter({
    label,
    value,
    color = "sky",
    showPercentage = true,
    className
}) {
    return (
        <div className={cn("space-y-1", className)}>
            <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
                {showPercentage && (
                    <span className="font-mono text-xs text-foreground">{value}%</span>
                )}
            </div>
            <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        colorClasses[color]
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
        </div>
    )
}
