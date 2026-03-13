import { useState, useEffect, useRef } from "react"
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { MapBackground } from "@/components/map-background"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useSafety } from "@/context/SafetyContext"
import {
    Map,
    Navigation,
    Activity,
    AlertTriangle,
    BarChart3,
    Settings,
    Menu,
    MapPin,
    Info,
    Shield,
    HelpCircle,
    PanelLeft,
    X
} from "lucide-react"
 
const ONBOARDING_KEY = "saferoute_onboarded"
 
// Pages that share the persistent map instance.
// The Mapbox GL canvas stays mounted as you switch between these two routes —
// no flicker, no reload, no re-initialisation.
const PERSISTENT_MAP_PAGES = ['/journey', '/navigation']
 
// /active is retired — both entries now point to /navigation
const navItems = [
    { href: "/dashboard",  label: "Map Intelligence", icon: Map          },
    { href: "/journey",    label: "Safe Journey",      icon: Navigation   },
    { href: "/navigation", label: "Active Journey",    icon: Activity     },
    { href: "/analysis",   label: "Risk Analysis",     icon: AlertTriangle},
    { href: "/analytics",  label: "Analytics",         icon: BarChart3    },
    { href: "/settings",   label: "Settings",          icon: Settings     },
    { href: "/about",      label: "About / Pitch",     icon: Info         },
]
 
const mobileNavItems = [
    { href: "/dashboard",  label: "Map",     icon: Map          },
    { href: "/journey",    label: "Journey", icon: Navigation   },
    { href: "/navigation", label: "Active",  icon: Activity     },
    { href: "/analytics",  label: "Stats",   icon: BarChart3    },
    { href: "/settings",   label: "More",    icon: Menu         },
]
 
export function AppShell() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { sharedMapRef } = useSafety()
    const [currentTime, setCurrentTime] = useState("")
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [showMoreMenu, setShowMoreMenu] = useState(false)
 
    // Sidebar collapse — open by default on large screens (≥1024px), closed on iPad (768–1023px)
    const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024)

    // Landscape mobile: width > height AND width < 1024 (phone rotated)
    const [isLandscapeMobile, setIsLandscapeMobile] = useState(
        () => typeof window !== "undefined" && window.innerWidth < 1024 && window.innerWidth > window.innerHeight
    )

    // Keep sidebarOpen in sync if the window is resized across the lg breakpoint
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 1024) setSidebarOpen(true)
            setIsLandscapeMobile(window.innerWidth < 1024 && window.innerWidth > window.innerHeight)
        }
        window.addEventListener("resize", onResize)
        window.addEventListener("orientationchange", onResize)
        return () => {
            window.removeEventListener("resize", onResize)
            window.removeEventListener("orientationchange", onResize)
        }
    }, [])

    // Auto-collapse desktop sidebar when phone rotates to landscape
    useEffect(() => {
        if (isLandscapeMobile) setSidebarOpen(false)
    }, [isLandscapeMobile])
 
    // Force-show the onboarding modal (for the ? button and demo judges)
    const openOnboarding = () => {
        try { localStorage.removeItem(ONBOARDING_KEY) } catch {}
        setShowOnboarding(true)
    }
 
    // The DOM node that pages portal their map-layer overlays into.
    // Passed to pages via useOutletContext() so they can createPortal() into it.
    const [mapOverlayEl, setMapOverlayEl] = useState(null)
    // Stable ref so the callback ref doesn't cause infinite re-renders
    const mapOverlayElRef = useRef(null)
 
    const isMapPage = PERSISTENT_MAP_PAGES.includes(pathname)
 
    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", hour12: true
            }))
        }
        updateTime()
        const iv = setInterval(updateTime, 1000)
        return () => clearInterval(iv)
    }, [])
 
    // Callback ref: only triggers setState when the DOM node actually changes
    const overlayCallbackRef = (el) => {
        if (el && el !== mapOverlayElRef.current) {
            mapOverlayElRef.current = el
            setMapOverlayEl(el)
        }
    }
 
    // When returning to a map page from a non-map page the Mapbox canvas was hidden
    // via display:none — fire a resize event so it repaints at the correct size and
    // re-renders any layers that were drawn while it was hidden.
    useEffect(() => {
        if (!isMapPage) return
        // rAF ensures the display:none has been removed before resize fires
        const id = requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"))
            sharedMapRef.current?.resize?.()
        })
        return () => cancelAnimationFrame(id)
    }, [isMapPage])
 
    // When sidebar opens or closes, let the map canvas know it needs to repaint
    // at the new width. We wait 310ms (after the 300ms CSS transition) before firing.
    useEffect(() => {
        if (!isMapPage) return
        const id = setTimeout(() => {
            window.dispatchEvent(new Event("resize"))
            sharedMapRef.current?.resize?.()
        }, 310)
        return () => clearTimeout(id)
    }, [sidebarOpen, isMapPage])
 
    return (
        <div className="flex flex-col bg-bg overflow-hidden" style={{ height: "100dvh" }}>
            {/* Onboarding modal — auto-shows on first visit, re-triggerable via ? button */}
            {showOnboarding
              ? <OnboardingModal forceShow onClose={() => setShowOnboarding(false)} />
              : <OnboardingModal />
            }
 
            {/* Header */}
            <header className="h-14 flex-shrink-0 glass border-b border-border flex items-center justify-between px-4 z-50 relative">
                <div className="flex items-center gap-2">
                    {/* Sidebar toggle — visible on md+ (iPad and desktop) */}
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-muted-foreground hover:text-amber2 hover:bg-bg3 transition-colors"
                        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        <PanelLeft className="w-4 h-4" />
                    </button>
                    <Link to="/dashboard" className="flex items-center gap-1">
                        <span className="font-serif italic text-xl text-foreground">SafeRoute</span>
                        <span className="font-serif italic text-xl text-amber">AI+</span>
                    </Link>
                    <div className="hidden lg:block ml-2">
                        <span className="font-mono text-[11px] text-muted-foreground tracking-widest uppercase">
                            Command Center
                        </span>
                    </div>
                </div>
 
                <div className="hidden md:flex items-center gap-6">
                    <StatusDot label="DATA" active />
                    <StatusDot label="AI"   active />
                    <StatusDot label="COMMS" active />
                </div>
 
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="font-mono text-xs truncate max-w-[100px]">Montgomery, AL</span>
                    </div>
                    {/* ? button — re-opens onboarding for demo judges */}
                    <button
                        onClick={openOnboarding}
                        title="Show tutorial"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-amber2 hover:bg-bg3 transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-xs md:text-sm text-foreground">{currentTime}</span>
                    <div className="w-8 h-8 rounded-full bg-amber2 flex items-center justify-center">
                        <span className="font-mono text-xs text-bg font-medium">SR</span>
                    </div>
                </div>
            </header>
 
            <div className="flex flex-1 overflow-hidden">
                {/* Desktop Sidebar — icon-only when collapsed, full labels when open */}
                <aside className={cn(
                    "hidden md:flex flex-shrink-0 flex-col bg-bg3 border-r border-border transition-all duration-300 overflow-hidden",
                    sidebarOpen ? "w-[230px]" : "w-[56px]"
                )}>
                    <nav className="flex-1 py-4">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href === "/navigation" && pathname === "/active")
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    title={!sidebarOpen ? item.label : undefined}
                                    className={cn(
                                        "flex items-center py-3 text-sm font-normal transition-all relative",
                                        sidebarOpen ? "gap-3 px-4" : "justify-center px-0",
                                        isActive
                                            ? "text-amber2 bg-bg2"
                                            : "text-muted-foreground hover:text-foreground hover:bg-bg2/50"
                                    )}
                                >
                                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber2" />}
                                    <item.icon className="w-4 h-4 flex-shrink-0" />
                                    {sidebarOpen && (
                                        <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                                    )}
                                </Link>
                            )
                        })}
                    </nav>
 
                    {/* Live safety status widget — dots only when collapsed, full labels when open */}
                    <div className={cn("border-t border-border transition-all", sidebarOpen ? "p-4" : "py-4 px-0")}>
                        {sidebarOpen ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-3 h-3 text-mint" />
                                    <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">System Status</span>
                                </div>
                                <div className="space-y-1.5">
                                    {[
                                        { label: "AI Engine", status: "Online",  color: "text-mint"  },
                                        { label: "Live Data", status: "Syncing", color: "text-amber" },
                                        { label: "GPS",       status: "Active",  color: "text-sky"   },
                                    ].map(({ label, status, color }) => (
                                        <div key={label} className="flex justify-between items-center">
                                            <span className="font-mono text-xs text-muted-foreground/60">{label}</span>
                                            <span className={`font-mono text-xs ${color}`}>{status}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            /* Collapsed — three stacked status dots with native tooltips */
                            <div className="flex flex-col items-center gap-2">
                                {[
                                    { label: "AI Engine: Online",  color: "bg-mint"  },
                                    { label: "Live Data: Syncing", color: "bg-amber" },
                                    { label: "GPS: Active",        color: "bg-sky"   },
                                ].map(({ label, color }) => (
                                    <div
                                        key={label}
                                        title={label}
                                        className={cn("w-2 h-2 rounded-full animate-pulse-dot", color)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
 
                {/*
                  The map container is ALWAYS mounted — navigating to analytics, settings, etc.
                  does NOT destroy Mapbox. We just hide it with display:none and fire a resize
                  event when returning so the canvas repaints at the correct size.
 
                  Pages that use the map (/journey, /navigation) receive mapOverlayEl via
                  useOutletContext() and portal their map-layer UI into it.
                  All other pages get a plain Outlet in a standard scrollable main.
                */}
 
                {/* PERSISTENT MAP — always mounted */}
                <div
                    className="flex-1 flex overflow-hidden"
                    style={!isMapPage ? { display: "none" } : {}}
                >
                    <div className="flex-1 relative min-h-0">
                        <MapBackground showHeatmap showGrid mapControlRef={sharedMapRef}>
                            {/* Overlay target — pages portal their map-layer UI in here */}
                            <div
                                ref={overlayCallbackRef}
                                className="absolute inset-0 pointer-events-none"
                                style={{ zIndex: 10 }}
                            />
                        </MapBackground>
                        {/* Landscape mobile: floating sidebar toggle on left edge of map */}
                        {isLandscapeMobile && isMapPage && (
                            <button
                                onClick={() => setSidebarOpen(o => !o)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 px-1.5 py-3 rounded-xl glass border border-amber2/25 text-amber2 hover:bg-amber2/10 transition-all"
                                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                            >
                                <span className="font-mono text-[8px] uppercase tracking-widest" style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
                                    {sidebarOpen ? "◀ Hide" : "▶ Nav"}
                                </span>
                            </button>
                        )}
                    </div>
                    {/* Map-page sidebar (JourneyPage or NavigationPage aside) */}
                    {isMapPage && <Outlet context={{ mapOverlayEl }} />}
                </div>
 
                {/* STANDARD PAGES — unmount freely */}
                {!isMapPage && (
                    <main className="flex-1 overflow-auto relative">
                        <Outlet />
                    </main>
                )}
            </div>
 
            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden h-16 flex-shrink-0 glass border-t border-border flex items-center justify-around z-50 px-1 relative">
                {mobileNavItems.map((item) => {
                    if (item.label === "More") {
                        // More button — opens popup instead of navigating
                        const moreActive = pathname === "/settings" || pathname === "/about"
                        return (
                            <button
                                key="more"
                                onClick={() => setShowMoreMenu(o => !o)}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-2 py-3 min-h-[56px] min-w-[56px] justify-center transition-all",
                                    (moreActive || showMoreMenu) ? "text-amber2" : "text-muted-foreground"
                                )}
                            >
                                {showMoreMenu
                                    ? <X className="w-5 h-5" />
                                    : <Menu className="w-5 h-5" />
                                }
                                <span className="font-mono text-xs">More</span>
                            </button>
                        )
                    }
                    const isActive = pathname === item.href ||
                        (item.href === "/navigation" && pathname === "/active")
                    return (
                        <Link key={item.href} to={item.href}
                            onClick={() => setShowMoreMenu(false)}
                            className={cn(
                                "flex flex-col items-center gap-1 px-2 py-3 min-h-[56px] min-w-[56px] justify-center transition-all",
                                isActive ? "text-amber2" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-mono text-xs">{item.label}</span>
                        </Link>
                    )
                })}

                {/* More popup menu — floats above the nav bar */}
                {showMoreMenu && (
                    <>
                        {/* Backdrop — tap outside to close */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowMoreMenu(false)}
                        />
                        {/* Menu panel */}
                        <div className="absolute bottom-[68px] right-2 z-50 glass border border-border/60 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
                            style={{ background: "rgba(12,16,32,0.97)", backdropFilter: "blur(24px)" }}>
                            {/* Menu header */}
                            <div className="px-4 py-2.5 border-b border-border/30">
                                <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">More Options</span>
                            </div>
                            {/* Settings */}
                            <button
                                onClick={() => { navigate("/settings"); setShowMoreMenu(false) }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg3 text-left border-b border-border/20",
                                    pathname === "/settings" ? "text-amber2 bg-bg3/60" : "text-foreground"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                                    pathname === "/settings" ? "bg-amber2/15 border border-amber2/25" : "bg-bg3 border border-border/30"
                                )}>
                                    <Settings className={cn("w-4 h-4", pathname === "/settings" ? "text-amber2" : "text-muted-foreground")} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm text-foreground">Settings</div>
                                    <div className="font-mono text-[10px] text-muted-foreground/60">Guardian, cover me, preferences</div>
                                </div>
                                {pathname === "/settings" && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber2 flex-shrink-0" />
                                )}
                            </button>
                            {/* About */}
                            <button
                                onClick={() => { navigate("/about"); setShowMoreMenu(false) }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg3 text-left",
                                    pathname === "/about" ? "text-amber2 bg-bg3/60" : "text-foreground"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                                    pathname === "/about" ? "bg-amber2/15 border border-amber2/25" : "bg-bg3 border border-border/30"
                                )}>
                                    <Info className={cn("w-4 h-4", pathname === "/about" ? "text-amber2" : "text-muted-foreground")} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm text-foreground">About / Pitch</div>
                                    <div className="font-mono text-[10px] text-muted-foreground/60">Features, data sources, builder</div>
                                </div>
                                {pathname === "/about" && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber2 flex-shrink-0" />
                                )}
                            </button>
                        </div>
                    </>
                )}
            </nav>
        </div>
    )
}
 
function StatusDot({ label, active }) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <div className={cn("w-2 h-2 rounded-full animate-pulse-dot", active ? "bg-mint" : "bg-coral")} />
                {active && <div className="absolute inset-0 w-2 h-2 rounded-full bg-mint animate-ping-marker" />}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{label}</span>
        </div>
    )
}