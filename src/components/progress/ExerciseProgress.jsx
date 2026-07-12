import { useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toKg, fromKg, epley1RM, fmtDate } from '../../lib/utils'

// Graficas por ejercicio: peso maximo, 1RM estimado (Epley) y volumen por sesion
export default function ExerciseProgress({ sets, exercises, unit, accent }) {
  const exercisesWithData = useMemo(() => {
    const ids = new Set(sets.map((s) => s.exercise_id))
    return exercises.filter((e) => ids.has(e.id))
  }, [sets, exercises])

  const [exerciseId, setExerciseId] = useState(null)
  const selected = exerciseId || exercisesWithData[0]?.id

  const data = useMemo(() => {
    const byDate = {}
    for (const s of sets) {
      if (s.exercise_id !== selected) continue
      const date = s.sessions.date
      const kg = toKg(s.weight, s.unit)
      const cur = byDate[date] || { date, maxKg: 0, volumeKg: 0, best1RM: 0 }
      cur.maxKg = Math.max(cur.maxKg, kg)
      cur.volumeKg += kg * s.reps
      cur.best1RM = Math.max(cur.best1RM, epley1RM(kg, s.reps))
      byDate[date] = cur
    }
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: fmtDate(d.date),
        max: Math.round(fromKg(d.maxKg, unit)),
        rm: Math.round(fromKg(d.best1RM, unit)),
        vol: Math.round(fromKg(d.volumeKg, unit)),
      }))
  }, [sets, selected, unit])

  if (!exercisesWithData.length) {
    return <p className="muted center mt">Registra tu primer entreno para ver tus gráficas.</p>
  }

  return (
    <div>
      <select className="input mb" value={selected} onChange={(e) => setExerciseId(e.target.value)}>
        {exercisesWithData.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>

      <div className="card">
        <h3 className="mb">Peso máximo y 1RM estimado ({unit})</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} ${unit}`, n === 'max' ? 'Peso máx' : '1RM est.']} />
            <Line type="monotone" dataKey="max" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="rm" stroke="var(--gold)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="tiny">Línea punteada: 1RM estimado con fórmula de Epley (peso × (1 + reps/30))</p>
      </div>

      <div className="card">
        <h3 className="mb">Volumen por sesión ({unit})</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${unit}`, 'Volumen']} />
            <Bar dataKey="vol" fill={accent} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: 13,
  color: 'var(--text)',
}
