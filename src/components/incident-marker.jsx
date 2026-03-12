import { useState } from "react"
import { cn } from "@/lib/utils"

const typeConfig = {
    high: { color: "#FF6B4A", bgClass: "bg-coral", ringClass: "bg-coral/30" },
    medium: { color: "#FBBF24", bgClass: "bg-amber", ringClass: "bg-amber/30" },
    low: { color: "#00E5A0", bgClass: "bg-mint", ringClass: "bg-mint/30" },
}

export function IncidentMarker({ type, label, description, position, onClick, className }) {
    const [showTooltip, setShowTooltip] = useState(false)
    const config = typeConfig[type]

    return (
        <div
            className={cn("absolute z-10", className)}
            style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)" }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={onClick}
        >
            <div className={cn("absolute inset-0 w-4 h-4 rounded-full animate-ping-marker", config.ringClass)} />
            <div
                className={cn("absolute inset-0 w-4 h-4 rounded-full animate-ping-marker", config.ringClass)}
                style={{ animationDelay: "0.5s" }}
            />
            <div className={cn("relative w-4 h-4 rounded-full cursor-pointer transition-transform hover:scale-125", config.bgClass)} />

            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass rounded-lg p-2 min-w-[140px] animate-fade-in z-20">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">{type} risk</div>
                    <div className="font-sans text-xs text-foreground font-medium">{label}</div>
                    {description && (
                        <div className="font-sans text-[10px] text-muted-foreground mt-1">{description}</div>
                    )}
                    <div
                        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
                        style={{ borderTopColor: "rgba(12, 16, 32, 0.85)" }}
                    />
                </div>
            )}
        </div>
    )
}
