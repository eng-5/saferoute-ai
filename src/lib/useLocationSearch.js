import { useState, useEffect, useRef, useCallback } from "react"

// Montgomery, AL bounding box — keeps all results local
const MONTGOMERY_BBOX = "-86.45,32.28,-86.18,32.50"
const MONTGOMERY_PROXIMITY = "-86.3006,32.3668"

// Well-known Montgomery landmarks as instant suggestions when input is empty
export const MONTGOMERY_LANDMARKS = [
  { id: "landmark-1", place_name: "Downtown Montgomery, AL",          text: "Downtown Montgomery",          center: [-86.3012, 32.3769] },
  { id: "landmark-2", place_name: "Montgomery City Hall, AL",         text: "City Hall",                    center: [-86.3116, 32.3780] },
  { id: "landmark-3", place_name: "Dexter Avenue, Montgomery, AL",    text: "Dexter Avenue",                center: [-86.3009, 32.3761] },
  { id: "landmark-4", place_name: "Oak Park, Montgomery, AL",         text: "Oak Park",                    center: [-86.3198, 32.3901] },
  { id: "landmark-5", place_name: "Cloverdale, Montgomery, AL",       text: "Cloverdale",                   center: [-86.2891, 32.3654] },
  { id: "landmark-6", place_name: "Eastchase, Montgomery, AL",        text: "Eastchase",                    center: [-86.1635, 32.3588] },
  { id: "landmark-7", place_name: "Alabama State University, AL",     text: "Alabama State University",     center: [-86.3063, 32.3641] },
  { id: "landmark-8", place_name: "Montgomery Regional Airport, AL",  text: "Montgomery Regional Airport",  center: [-86.3722, 32.4600] },
  { id: "landmark-9", place_name: "Jackson Hospital, Montgomery, AL", text: "Jackson Hospital",             center: [-86.2930, 32.3782] },
  { id: "landmark-10","place_name": "Perry Street, Montgomery, AL",   text: "Perry Street",                 center: [-86.3058, 32.3756] },
]

async function geocode(query, token) {
  if (!query?.trim() || !token) return []
  try {
    const encoded = encodeURIComponent(query.trim())
    const url = [
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`,
      `?bbox=${MONTGOMERY_BBOX}`,
      `&proximity=${MONTGOMERY_PROXIMITY}`,
      `&types=address,poi,neighborhood,locality,place`,
      `&country=US`,
      `&limit=5`,
      `&access_token=${token}`,
    ].join("")

    const res  = await fetch(url)
    const data = await res.json()

    return (data.features || []).map(f => ({
      id:         f.id,
      text:       f.text,
      place_name: f.place_name,
      center:     f.center,           // [lng, lat]
    }))
  } catch {
    return []
  }
}

/**
 * useLocationSearch
 *
 * Returns:
 *   { query, setQuery, results, loading, select, clear, selected }
 *
 * Usage:
 *   const origin = useLocationSearch()
 *   <input value={origin.query} onChange={e => origin.setQuery(e.target.value)} />
 *   {origin.results.map(r => <div onClick={() => origin.select(r)}>{r.text}</div>)}
 */
export function useLocationSearch(initialValue = "") {
  const [query,    setQuery]    = useState(initialValue)
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)   // { text, place_name, center }

  const debounceRef = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN

  // Show landmarks when input is focused but empty
  const showLandmarks = !query.trim()

  useEffect(() => {
    if (showLandmarks) {
      setResults(MONTGOMERY_LANDMARKS)
      setLoading(false)
      return
    }

    // If user typed something, debounce the API call
    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const hits = await geocode(query, token)
      // Fallback: filter landmarks if Mapbox returns nothing (e.g. no token)
      if (!hits.length) {
        const q = query.toLowerCase()
        setResults(MONTGOMERY_LANDMARKS.filter(l =>
          l.text.toLowerCase().includes(q) || l.place_name.toLowerCase().includes(q)
        ))
      } else {
        setResults(hits)
      }
      setLoading(false)
    }, 280)

    return () => clearTimeout(debounceRef.current)
  }, [query, token])

  const select = useCallback((result) => {
    setSelected(result)
    setQuery(result.text)
    setResults([])
  }, [])

  const clear = useCallback(() => {
    setQuery("")
    setSelected(null)
    setResults(MONTGOMERY_LANDMARKS)
  }, [])

  // When value is set programmatically (e.g. from voice input), re-geocode
  const setFromVoice = useCallback(async (text) => {
    setQuery(text)
    setLoading(true)
    const hits = await geocode(text, token)
    if (hits.length) {
      // Auto-select top result
      const top = hits[0]
      setSelected(top)
      setQuery(top.text)
      setResults(hits)
    } else {
      const q = text.toLowerCase()
      const filtered = MONTGOMERY_LANDMARKS.filter(l =>
        l.text.toLowerCase().includes(q)
      )
      if (filtered.length) {
        setSelected(filtered[0])
        setQuery(filtered[0].text)
      }
      setResults(filtered)
    }
    setLoading(false)
  }, [token])

  return { query, setQuery, results, loading, select, clear, selected, setFromVoice, showLandmarks }
}
