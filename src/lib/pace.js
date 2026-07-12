// Utilidades de pace y tiempos estilo Strava

export function fmtPace(secondsPerKm) {
  if (!secondsPerKm || !isFinite(secondsPerKm)) return '--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// Parsea entrada "mm:ss" o "hh:mm:ss" o minutos sueltos a segundos
export function parseDuration(str) {
  if (!str) return null
  const clean = String(str).trim()
  const parts = clean.split(':').map((p) => parseInt(p, 10))
  if (parts.some((p) => isNaN(p))) return null
  if (parts.length === 1) return parts[0] * 60
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

// Records por distancia estandar (mejores esfuerzos estimados estilo Strava).
// Una carrera mas larga cuenta prorrateando el pace: 6km a pace X es candidata a mejor 5K.
const STANDARD_DISTANCES = [
  { key: '1k', label: 'Mejor 1K', km: 1 },
  { key: '5k', label: 'Mejor 5K', km: 5 },
  { key: '10k', label: 'Mejor 10K', km: 10 },
]

export function bestEfforts(runs) {
  const running = runs.filter((r) => r.activity === 'correr' && r.distance_km > 0 && r.duration_seconds > 0)
  const efforts = {}
  for (const { key, label, km } of STANDARD_DISTANCES) {
    let best = null
    for (const r of running) {
      if (Number(r.distance_km) >= km) {
        const estSeconds = (r.duration_seconds / Number(r.distance_km)) * km
        if (!best || estSeconds < best.seconds) {
          best = { seconds: Math.round(estSeconds), date: r.date, run: r }
        }
      }
    }
    efforts[key] = best ? { label, ...best } : { label, seconds: null }
  }
  let maxDist = null
  let maxDur = null
  for (const r of running) {
    if (!maxDist || Number(r.distance_km) > Number(maxDist.distance_km)) maxDist = r
    if (!maxDur || r.duration_seconds > maxDur.duration_seconds) maxDur = r
  }
  efforts.maxDistance = maxDist
  efforts.maxDuration = maxDur
  return efforts
}
