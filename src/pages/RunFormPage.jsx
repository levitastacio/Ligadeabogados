import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { offlineInsert } from '../lib/offline'
import { publishToGroups } from '../lib/feed'
import { celebratePR } from '../lib/celebrate'
import { ACTIVITIES, todayStr, fmtDuration } from '../lib/utils'
import { parseDuration, fmtPace, bestEfforts } from '../lib/pace'
import { shareWhatsAppText } from '../lib/share'

export default function RunFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [activity, setActivity] = useState('correr')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [routeName, setRouteName] = useState('')
  const [note, setNote] = useState('')
  const [isRace, setIsRace] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [elevation, setElevation] = useState('')
  const [busy, setBusy] = useState(false)
  const [routes, setRoutes] = useState([])

  const needsDistance = activity === 'correr' || activity === 'bici' || activity === 'caminata'
  const durationSec = parseDuration(duration)
  const dist = parseFloat(distance)
  const pace = needsDistance && dist > 0 && durationSec ? Math.round(durationSec / dist) : null

  useEffect(() => {
    supabase
      .from('runs')
      .select('route_name')
      .eq('user_id', user.id)
      .not('route_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const names = [...new Set((data || []).map((r) => r.route_name).filter(Boolean))]
        setRoutes(names.slice(0, 6))
      })
  }, [user.id])

  const save = async () => {
    if (!durationSec) {
      toast('Ingresa el tiempo en formato mm:ss')
      return
    }
    if (needsDistance && (!dist || dist <= 0)) {
      toast('Ingresa la distancia en km')
      return
    }
    setBusy(true)
    try {
      // Detectar records antes de guardar (mejores esfuerzos estilo Strava)
      let newRecords = []
      if (activity === 'correr' && dist > 0) {
        const { data: prevRuns } = await supabase
          .from('runs')
          .select('activity, distance_km, duration_seconds, date')
          .eq('user_id', user.id)
        const before = bestEfforts(prevRuns || [])
        const after = bestEfforts([...(prevRuns || []), { activity, distance_km: dist, duration_seconds: durationSec, date }])
        for (const key of ['1k', '5k', '10k']) {
          if (after[key].seconds != null && (before[key].seconds == null || after[key].seconds < before[key].seconds)) {
            newRecords.push(after[key].label)
          }
        }
        if (!before.maxDistance || dist > Number(before.maxDistance.distance_km)) newRecords.push('Mayor distancia')
      }

      await offlineInsert('runs', {
        user_id: user.id,
        date,
        activity,
        distance_km: needsDistance ? dist : null,
        duration_seconds: durationSec,
        avg_pace_seconds: pace,
        elevation_m: elevation ? parseFloat(elevation) : null,
        note: note || null,
        route_name: routeName.trim() || null,
        is_race: isRace,
      })

      await publishToGroups(user.id, 'run', {
        activity,
        distance_km: needsDistance ? dist : null,
        duration_seconds: durationSec,
        pace_seconds: pace,
        route_name: routeName.trim() || null,
        is_race: isRace,
        records: newRecords,
      })

      if (newRecords.length) {
        celebratePR()
        toast(`🏆 ¡Nuevo récord: ${newRecords.join(', ')}!`)
      } else {
        toast('Actividad guardada')
      }

      const emoji = ACTIVITIES[activity].emoji
      if (needsDistance && confirm('¿Compartir por WhatsApp?')) {
        shareWhatsAppText(
          `${emoji} *${ACTIVITIES[activity].label} registrada en Gym Squad*\n` +
            `📏 ${dist} km en ${fmtDuration(durationSec)}\n` +
            (pace ? `⚡ Pace: ${fmtPace(pace)}\n` : '') +
            (routeName ? `🗺️ ${routeName}\n` : '') +
            (newRecords.length ? `🏆 ${newRecords.join(', ')}` : '')
        )
      }
      navigate('/')
    } catch (err) {
      toast('No se pudo guardar la actividad')
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="mb">Registrar actividad</h1>

      <div className="row mb" style={{ flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(ACTIVITIES).map(([key, a]) => (
          <button
            key={key}
            className="chip"
            style={{
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              padding: '9px 14px',
              opacity: activity === key ? 1 : 0.5,
              outline: activity === key ? '2px solid var(--accent)' : 'none',
            }}
            onClick={() => setActivity(key)}
          >
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      <div className="card">
        <label className="label" style={{ marginTop: 0 }}>Fecha</label>
        <input className="input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />

        {needsDistance && (
          <>
            <label className="label">Distancia (km)</label>
            <input className="input" type="number" inputMode="decimal" step="0.1" min="0" placeholder="5.2" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </>
        )}

        <label className="label">Tiempo (mm:ss o hh:mm:ss)</label>
        <input className="input" inputMode="numeric" placeholder="28:15" value={duration} onChange={(e) => setDuration(e.target.value)} />

        {pace != null && (
          <p className="chip mt">⚡ Pace: {fmtPace(pace)}</p>
        )}

        {needsDistance && (
          <>
            <label className="label">Nombre de la ruta (opcional)</label>
            <input className="input" placeholder="Malecón 5K" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
            {routes.length > 0 && (
              <div className="row mt" style={{ flexWrap: 'wrap', gap: 6 }}>
                {routes.map((r) => (
                  <button key={r} className="chip" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setRouteName(r)}>
                    🗺️ {r}
                  </button>
                ))}
              </div>
            )}
            <label className="label">Elevación (m, opcional)</label>
            <input className="input" type="number" inputMode="numeric" placeholder="120" value={elevation} onChange={(e) => setElevation(e.target.value)} />
          </>
        )}

        <label className="label">Nota (opcional)</label>
        <textarea className="input" rows={2} placeholder="Me sentí volando hoy" value={note} onChange={(e) => setNote(e.target.value)} />

        {activity === 'correr' && (
          <label className="row mt" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={isRace} onChange={(e) => setIsRace(e.target.checked)} style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 15 }}>Fue carrera oficial 🏁</span>
          </label>
        )}
      </div>

      <button className="btn mb" onClick={save} disabled={busy}>Guardar actividad</button>
      <button className="btn ghost" onClick={() => navigate(-1)}>Cancelar</button>
    </div>
  )
}
