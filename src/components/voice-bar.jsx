import { useState } from "react"
import { cn } from "@/lib/utils"
import { Mic, MicOff } from "lucide-react"

export function VoiceBar({
    placeholder = "Ask SafeRoute AI anything...",
    onVoiceInput,
    aiResponse,
    isListening: externalListening,
    className,
    variant = "default"
}) {
    const [internalListening, setInternalListening] = useState(false)
    const [inputValue, setInputValue] = useState("")

    const isListening = externalListening ?? internalListening

    const handleMicClick = () => {
        setInternalListening(!internalListening)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (inputValue.trim() && onVoiceInput) {
            onVoiceInput(inputValue.trim())
            setInputValue("")
        }
    }

    if (variant === "navigation") {
        return (
            <div className={cn("glass rounded-xl p-4", className)}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleMicClick}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                            isListening
                                ? "bg-mint animate-glow"
                                : "bg-foreground/90 hover:bg-foreground"
                        )}
                    >
                        {isListening ? (
                            <MicOff className="w-6 h-6 text-bg" />
                        ) : (
                            <Mic className="w-6 h-6 text-bg" />
                        )}
                    </button>

                    {isListening && (
                        <div className="flex items-center gap-1 h-8">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-mint rounded-full animate-waveform"
                                    style={{
                                        animationDelay: `${i * 0.15}s`,
                                        height: `${8 + Math.random() * 16}px`
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {aiResponse && (
                        <p className="font-sans text-sm text-foreground flex-1">{aiResponse}</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className={cn("glass rounded-xl", className)}>
            <div className="flex items-center gap-3 p-3">
                <button
                    type="button"
                    onClick={handleMicClick}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                        isListening
                            ? "bg-mint animate-glow"
                            : "bg-bg3 hover:bg-bg2"
                    )}
                >
                    {isListening ? (
                        <MicOff className="w-4 h-4 text-bg" />
                    ) : (
                        <Mic className="w-4 h-4 text-foreground" />
                    )}
                </button>

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground font-sans text-sm focus:outline-none"
                />

                {isListening && (
                    <div className="flex items-center gap-0.5 h-6">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="w-0.5 bg-mint rounded-full animate-waveform"
                                style={{
                                    animationDelay: `${i * 0.15}s`,
                                    height: `${6 + Math.random() * 12}px`
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </form>
    )
}
