import { cn } from "@/lib/utils"
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react"

const stateConfig = {
    off: { label: "Guardian Mode Off", icon: Shield, iconClass: "text-muted-foreground", borderClass: "border-border" },
    active: { label: "Guardian Mode Active", icon: ShieldCheck, iconClass: "text-amber2", borderClass: "border-amber2" },
    arrived: { label: "Safe Arrival Confirmed", icon: ShieldAlert, iconClass: "text-mint", borderClass: "border-mint" },
}

export function GuardianStatus({ state, guardians = [], onToggle, className }) {
    const config = stateConfig[state]
    const Icon = config.icon

    return (
        <div
            className={cn(
                "glass rounded-lg p-3 border transition-all cursor-pointer",
                config.borderClass,
                state === "active" && "shadow-[0_0_20px_rgba(251,146,60,0.2)]",
                className
            )}
            onClick={onToggle}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", config.iconClass)} />
                    <span className="font-mono text-xs text-foreground">{config.label}</span>
                </div>

                {guardians.length > 0 && (
                    <div className="flex -space-x-2">
                        {guardians.slice(0, 3).map((guardian, i) => (
                            <div
                                key={i}
                                className="w-6 h-6 rounded-full bg-bg3 border border-border flex items-center justify-center"
                            >
                                <span className="font-mono text-[8px] text-muted-foreground">
                                    {guardian.initials}
                                </span>
                            </div>
                        ))}
                        {guardians.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-bg3 border border-border flex items-center justify-center">
                                <span className="font-mono text-[8px] text-muted-foreground">
                                    +{guardians.length - 3}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
