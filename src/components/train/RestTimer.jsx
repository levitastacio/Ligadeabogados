import { useEffect, useState } from 'react'
import { vibrate } from '../../lib/celebrate'

// Cronometro de descanso que arranca automaticamente al guardar una serie
export default function RestTimer({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (left <= 0) {
      vibrate([80, 80, 200])
      onDone()
      return
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left, onDone])

  const m = Math.floor(left / 60)
  const s = left % 60

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(var(--safe-bottom) + 74px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        boxShadow: 'var(--shadow)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
      className="pop"
    >
      <span className="tiny bold">Descanso</span>
      <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {m}:{String(s).padStart(2, '0')}
      </span>
      <button className="btn secondary small" onClick={() => setLeft((l) => l + 30)}>+30s</button>
      <button className="btn ghost small" onClick={onDone}>Saltar</button>
    </div>
  )
}
