import { medalInfo, RANK_EMOJI } from '../../lib/medals'
import { monthLabel } from '../../lib/utils'

// Vitrina de medallas: historial completo agrupado por mes
export default function MedalCase({ medals }) {
  if (!medals.length) {
    return (
      <p className="muted center mt">
        Tu vitrina está vacía. Las medallas se entregan el día 1 de cada mes: compite con tu squad y supérate a ti mismo.
      </p>
    )
  }

  const byMonth = {}
  for (const m of medals) {
    byMonth[m.month] = byMonth[m.month] || []
    byMonth[m.month].push(m)
  }
  const months = Object.keys(byMonth).sort().reverse()

  return (
    <div>
      {months.map((month) => (
        <div key={month} className="card">
          <h3 className="mb" style={{ textTransform: 'capitalize' }}>{monthLabel(month)}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {byMonth[month].map((m) => {
              const info = medalInfo(m.code)
              return (
                <div key={m.id} className="col center" style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px 6px', gap: 4 }}>
                  <span style={{ fontSize: 30 }}>{m.rank ? RANK_EMOJI[m.rank] : info.emoji}</span>
                  <span className="bold" style={{ fontSize: 12, textAlign: 'center' }}>{info.name}</span>
                  <span className="tiny">{info.type === 'grupo' ? 'Competencia' : 'Personal'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
