import { useState, useEffect, useRef } from "react"

// ── BRIGHT DATA SCRAPING CONFIG ───────────────────────────────
// Uses Bright Data Web Unlocker API to scrape Montgomery local news
// Set VITE_BRIGHTDATA_TOKEN in your .env file
const BRIGHTDATA_API = "https://api.brightdata.com/request"

// News sources to scrape for Montgomery Alabama content
const NEWS_SOURCES = [
    {
        url: "https://www.montgomeryadvertiser.com/",
        name: "Montgomery Advertiser",
        selector: "article",
    },
    {
        url: "https://www.wsfa.com/news/local/",
        name: "WSFA 12 News",
        selector: "article",
    },
]

// Fallback mock news — used when Bright Data is unavailable
const MOCK_NEWS = [
    {
        headline: "Montgomery Police increase patrols in Downtown District following recent incidents",
        source: "Montgomery Advertiser",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        relevance: "high",
        area: "Downtown District",
    },
    {
        headline: "City of Montgomery completes streetlight upgrades on Hull Street Corridor",
        source: "WSFA 12 News",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        relevance: "medium",
        area: "Hull Street Corridor",
    },
    {
        headline: "Community watch program expands to Oak Park and Midtown neighborhoods",
        source: "Montgomery Advertiser",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        relevance: "medium",
        area: "Oak Park",
    },
    {
        headline: "Emergency services response times improve by 18% in Q1 2026",
        source: "City of Montgomery",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        relevance: "low",
        area: "City-wide",
    },
    {
        headline: "Fairview residents report increased vehicle break-ins near shopping center",
        source: "WSFA 12 News",
        timestamp: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
        relevance: "high",
        area: "Fairview",
    },
]

// ── TIME FORMATTER ────────────────────────────────────────────
function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return "Just now"
    if (hours === 1) return "1 hour ago"
    if (hours < 24) return `${hours} hours ago`
    return `${Math.floor(hours / 24)}d ago`
}

// ── BRIGHT DATA FETCH ─────────────────────────────────────────
async function fetchViaUnlocker(targetUrl) {
    const token = import.meta.env.VITE_BRIGHTDATA_TOKEN
    if (!token) return null

    try {
        const response = await fetch(BRIGHTDATA_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                zone: "web_unlocker1",
                url: targetUrl,
                format: "raw",
            }),
        })

        if (!response.ok) return null
        const html = await response.text()
        return html
    } catch {
        return null
    }
}

// ── PARSE HEADLINES FROM HTML ─────────────────────────────────
function parseHeadlines(html, sourceName, limit = 4) {
    if (!html) return []
    try {
        const parser  = new DOMParser()
        const doc     = parser.parseFromString(html, "text/html")

        // Generic headline selectors that work across most news sites
        const selectors = [
            "h1", "h2", "h3",
            "article h2", "article h3",
            ".headline", ".article-title", ".story-title",
            "[data-testid='headline']",
        ]

        const headlines = new Set()
        for (const sel of selectors) {
            doc.querySelectorAll(sel).forEach(el => {
                const text = el.textContent?.trim()
                if (text && text.length > 20 && text.length < 200) {
                    headlines.add(text)
                }
            })
            if (headlines.size >= limit) break
        }

        return Array.from(headlines)
            .slice(0, limit)
            .map(headline => ({
                headline,
                source: sourceName,
                timestamp: new Date().toISOString(),
                relevance: isSafetyRelevant(headline) ? "high" : "low",
                area: extractArea(headline),
            }))
    } catch {
        return []
    }
}

// ── RELEVANCE SCORING ─────────────────────────────────────────
function isSafetyRelevant(text) {
    const keywords = [
        "police", "arrest", "incident", "crime", "safety", "fire",
        "emergency", "patrol", "shooting", "robbery", "assault",
        "accident", "hazard", "warning", "alert", "response",
    ]
    const lower = text.toLowerCase()
    return keywords.some(kw => lower.includes(kw))
}

function extractArea(text) {
    const areas = [
        "Downtown", "Oak Park", "Cloverdale", "Fairview",
        "Hull Street", "Eastchase", "Midtown", "Perry Street",
        "Dexter Avenue", "Commerce Street",
    ]
    const found = areas.find(a => text.includes(a))
    return found || "Montgomery"
}

// ── BUILD AI CONTEXT FROM NEWS ────────────────────────────────
export function buildNewsContext(newsItems) {
    if (!newsItems?.length) return ""

    const high = newsItems.filter(n => n.relevance === "high")
    const all  = newsItems.slice(0, 5)

    const lines = [
        "\n\n--- LATEST LOCAL NEWS (via Bright Data) ---",
        ...all.map(n =>
            `• [${n.source} · ${timeAgo(n.timestamp)}] ${n.headline}${n.area !== "Montgomery" ? ` (${n.area})` : ""}`
        ),
    ]

    if (high.length) {
        lines.push(
            `\nSAFETY-RELEVANT ALERTS: ${high.length} recent news items indicate active safety concerns.`
        )
    }

    return lines.join("\n")
}

// ── MAIN HOOK ─────────────────────────────────────────────────
export function useBrightData() {
    const [newsItems,  setNewsItems]  = useState([])
    const [loading,    setLoading]    = useState(true)
    const [hasLiveNews, setHasLiveNews] = useState(false)
    const fetchedRef = useRef(false)

    useEffect(() => {
        if (fetchedRef.current) return
        fetchedRef.current = true

        async function loadNews() {
            setLoading(true)
            const token = import.meta.env.VITE_BRIGHTDATA_TOKEN

            if (!token) {
                // No token — use mock data immediately
                console.log("ℹ️ No VITE_BRIGHTDATA_TOKEN — using mock news data")
                setNewsItems(MOCK_NEWS)
                setLoading(false)
                return
            }

            // Try to scrape real news
            const results = []
            for (const source of NEWS_SOURCES) {
                const html = await fetchViaUnlocker(source.url)
                const parsed = parseHeadlines(html, source.name)
                if (parsed.length) {
                    results.push(...parsed)
                    setHasLiveNews(true)
                }
            }

            if (results.length > 0) {
                // Sort: safety-relevant first, then by time
                const sorted = results.sort((a, b) => {
                    if (a.relevance === "high" && b.relevance !== "high") return -1
                    if (b.relevance === "high" && a.relevance !== "high") return 1
                    return new Date(b.timestamp) - new Date(a.timestamp)
                })
                setNewsItems(sorted)
            } else {
                // Bright Data returned nothing useful — fall back gracefully
                console.log("ℹ️ Bright Data returned no results — using mock news data")
                setNewsItems(MOCK_NEWS)
            }

            setLoading(false)
        }

        loadNews()

        // Refresh every 30 minutes
        const interval = setInterval(() => {
            fetchedRef.current = false
            loadNews()
        }, 30 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

    return {
        newsItems,
        loading,
        hasLiveNews,
        newsContext: buildNewsContext(newsItems),
        timeAgo,
    }
}
