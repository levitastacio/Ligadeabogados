import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtDuration, fmtDate, ACTIVITIES } from '../../lib/utils'
import { bestEfforts, fmtPace } from '../../lib/pace'
import { tooltipStyle } from './ExerciseProgress'

// Seccion running: records por distancia, km por semana y evolucion del pace
export default function RunningSection({ runs, accent }) {
  const efforts = useMemo(() => bestEfforts(runs), [runs])

  const weekly = useMemo(() => {
    const byWeek = {}
    for (const r of runs) {
      if (!r.distance_km) continue
      const d = new Date(r.date + 'T12:00:00')
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      const key = d.toISOString().slice(0, 10)
      byWeek[key] = (byWeek[key] || 0) + Number(r.distance_km)
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, km]) => ({ label: fmtDate(week), km: Number(km.toFixed(1)) }))
  }, [runs])

  const paceData = useMemo(
    () =>
      runs
        .filter((r) => r.activity === 'correr' && r.avg_pace_seconds)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-20)
        .map((r) => ({ label: fmtDate(r.date), pace: Math.round(r.avg_pace_seconds / 6) / 10 })),
    [runs]
  )

  const records = [
    { label: 'Mejor 1K', value: efforts['1k'].seconds ? fmtDuration(efforts['1k'].seconds) : null },
    { label: 'Mejor 5K', value: efforts['5k'].seconds ? fmtDuration(efforts['5k'].seconds) : null },
    { label: 'Mejor 10K', value: efforts['10k'].seconds ? fmtDuration(efforts['10k'].seconds) : null },
    { label: 'Mayor distancia', value: efforts.maxDistance ? `${Number(efforts.maxDistance.distance_km).toFixed(1)} km` : null },
    { label: 'Mayor duración', value: efforts.maxDuration ? fmtDuration(efforts.maxDuration.duration_seconds) : null },
  ]

  if (!runs.length) {
    return <p className="muted center mt">Registra tu primera carrera para ver tus récords y gráficas.</p>
  }

  return (
    <div>
      <div className="card">
        <h3 className="mb">🏆 Récords personales</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {records.filter((r) => r.value).map((r) => (
            <div key={r.label} className="col" style={{ background: 'var(--bg)', borderRadius: 14, padding: 12 }}>
              <span className="tiny">{r.label}</span>
              <span className="bold" style={{ fontSize: 19 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <p className="tiny mt">Mejores esfuerzos estimados: una carrera de 6 km con buen pace cuenta como candidata a mejor 5K.</p>
      </div>

      {weekly.length > 0 && (
        <div className="card">
          <h3 className="mb">Km por semana</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} km`, 'Distancia']} />
              <Bar dataKey="km" fill={accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {paceData.length > 1 && (
        <div className="card">
          <h3 className="mb">Evolución del pace (min/km)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={paceData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} reversed />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} min/km`, 'Pace']} />
              <Line type="monotone" dataKey="pace" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="tiny">Hacia arriba = más rápido</p>
        </div>
      )}

      <div className="card">
        <h3 className="mb">Últimas actividades</h3>
        {runs.slice(0, 8).map((r) => (
          <div key={r.id} className="list-item">
            <span style={{ fontSize: 20 }}>{ACTIVITIES[r.activity]?.emoji || '⚡'}</span>
            <div className="col" style={{ flex: 1, gap: 2 }}>
              <span className="bold" style={{ fontSize: 14 }}>
                {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km` : ACTIVITIES[r.activity]?.label}
                {r.route_name ? ` · ${r.route_name}` : ''}
                {r.is_race ? ' 🏁' : ''}
              </span>
              <span className="tiny">{fmtDate(r.date)} · {fmtDuration(r.duration_seconds)}{r.avg_pace_seconds ? ` · ${fmtPace(r.avg_pace_seconds)}` : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
