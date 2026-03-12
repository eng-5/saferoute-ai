import { cn } from "@/lib/utils"

export function UserLocationMarker({
    position = { x: "50%", y: "50%" },
    color = "sky",
    className
}) {
    const colorClass = color === "mint" ? "bg-mint" : "bg-sky"
    const ringColorClass = color === "mint" ? "bg-mint/30" : "bg-sky/30"

    return (
        <div
            className={cn("absolute z-20", className)}
            style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)" }}
        >
            <div
                className={cn("absolute w-8 h-8 rounded-full animate-ripple", ringColorClass)}
                style={{ top: "-8px", left: "-8px" }}
            />
            <div
                className={cn("absolute w-8 h-8 rounded-full animate-ripple", ringColorClass)}
                style={{ top: "-8px", left: "-8px", animationDelay: "1s" }}
            />
            <div className={cn("relative w-4 h-4 rounded-full", colorClass)}>
                <div className={cn("absolute inset-1 rounded-full bg-foreground")} />
            </div>
        </div>
    )
}
