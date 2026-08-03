// Calendario de asistencia estilo GitHub: cada columna es una semana
// (lunes arriba, domingo abajo) y la intensidad del color es el volumen del dia.
import { fmtDate } from '../../lib/utils'

const WEEKS = 18

function key(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttendanceCalendar({ volumeByDate, accent }) {
  const today = new Date()

  // Se arranca en el lunes de la semana mas antigua para que las columnas cuadren
  const start = new Date(today)
  start.setDate(today.getDate() - (WEEKS * 7 - 1))
  const dow = start.getDay()
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

  const cells = []
  const cursor = new Date(start)
  while (cursor <= today) {
    const k = key(cursor)
    cells.push({ key: k, value: volumeByDate[k] || 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  const max = Math.max(...Object.values(volumeByDate), 1)
  const trained = cells.filter((c) => c.value > 0).length

  return (
    <div>
      <div className="calendar-grid">
        {cells.map((c) => (
          <div
            key={c.key}
            className="calendar-cell"
            title={`${fmtDate(c.key)}: ${c.value ? `${Math.round(c.value)} kg` : 'sin actividad'}`}
            style={c.value > 0 ? { background: accent, opacity: 0.3 + 0.7 * (c.value / max) } : undefined}
          />
        ))}
      </div>
      <div className="row-between" style={{ marginTop: 10 }}>
        <span className="tiny">Últimas {WEEKS} semanas</span>
        <span className="tiny">{trained} días con actividad</span>
      </div>
    </div>
  )
}
