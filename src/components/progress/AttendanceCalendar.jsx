// Calendario de asistencia estilo GitHub: intensidad por volumen del dia
import { fmtDate } from '../../lib/utils'

const WEEKS = 16

export default function AttendanceCalendar({ volumeByDate, accent }) {
  const today = new Date()
  const cells = []
  const start = new Date(today)
  start.setDate(today.getDate() - (WEEKS * 7 - 1))
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))

  const values = Object.values(volumeByDate)
  const max = Math.max(...values, 1)

  const d = new Date(start)
  while (d <= today) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ key, value: volumeByDate[key] || 0 })
    d.setDate(d.getDate() + 1)
  }

  return (
    <div>
      <div className="calendar-grid" style={{ gridAutoFlow: 'row' }}>
        {cells.map((c) => {
          const intensity = c.value === 0 ? 0 : 0.25 + 0.75 * (c.value / max)
          return (
            <div
              key={c.key}
              className="calendar-cell"
              title={`${fmtDate(c.key)}: ${Math.round(c.value)} kg`}
              style={c.value > 0 ? { background: accent, opacity: intensity } : {}}
            />
          )
        })}
      </div>
      <div className="row-between mt" style={{ marginTop: 8 }}>
        <span className="tiny">Hace {WEEKS} semanas</span>
        <span className="tiny">Hoy</span>
      </div>
    </div>
  )
}
