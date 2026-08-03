// Anillos de actividad estilo Apple Watch (SVG con stroke-dasharray animado)
const RING_DEFS = [
  { key: 'days', color: '#FF375F', label: 'Días' },
  { key: 'volume', color: '#30D158', label: 'Volumen' },
  { key: 'cardio', color: '#40C8E0', label: 'Cardio' },
]

function Ring({ cx, cy, r, stroke, progress, color }) {
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, Number(progress) || 0))
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth={stroke} />
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.32,.72,.35,1)' }}
        />
      )}
    </>
  )
}

export default function ActivityRings({ days = 0, volume = 0, cardio = 0, size = 150 }) {
  const values = { days, volume, cardio }
  const stroke = size * 0.09
  const gap = stroke + 3
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Anillos de actividad">
      {RING_DEFS.map((ring, i) => (
        <Ring
          key={ring.key}
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - stroke / 2 - 1 - i * gap}
          stroke={stroke}
          color={ring.color}
          progress={values[ring.key]}
        />
      ))}
    </svg>
  )
}

export { RING_DEFS }
