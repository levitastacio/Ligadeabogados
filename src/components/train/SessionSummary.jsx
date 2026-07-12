import { fmtVolume, fmtDuration } from '../../lib/utils'
import { shareCard, shareWhatsAppText } from '../../lib/share'

export default function SessionSummary({ dayName, stats, unit, accent, onDone }) {
  const share = () =>
    shareCard({
      title: dayName || 'Entreno completado',
      accent,
      lines: [
        { big: true, value: fmtVolume(stats.volumeKg, unit), label: 'volumen levantado' },
        { value: `${stats.setsCount} series · ${stats.exercisesCount} ejercicios`, label: 'trabajo del día' },
        { value: `${stats.prs} récords personales`, label: stats.prs > 0 ? 'a romperla 🏆' : 'la próxima caen' },
        { value: fmtDuration(stats.durationSec), label: 'duración' },
      ],
      fileName: 'entreno-gym-squad.png',
    })

  const whatsapp = () =>
    shareWhatsAppText(
      `💪 *Entreno completado en Gym Squad*\n` +
        `📋 ${dayName || 'Entreno libre'}\n` +
        `🏋️ ${fmtVolume(stats.volumeKg, unit)} de volumen\n` +
        `🔢 ${stats.setsCount} series en ${stats.exercisesCount} ejercicios\n` +
        (stats.prs > 0 ? `🏆 ${stats.prs} ${stats.prs === 1 ? 'récord personal' : 'récords personales'}\n` : '') +
        `⏱️ ${fmtDuration(stats.durationSec)}`
    )

  return (
    <div className="center pop" style={{ paddingTop: 30 }}>
      <div style={{ fontSize: 64 }}>{stats.prs > 0 ? '🏆' : '💪'}</div>
      <h1>¡Entreno completado!</h1>
      <p className="muted mb">{dayName || 'Entreno libre'}</p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-around' }}>
          <div className="col center">
            <span className="big-num accent">{fmtVolume(stats.volumeKg, unit)}</span>
            <span className="tiny">volumen</span>
          </div>
          <div className="col center">
            <span className="big-num">{stats.setsCount}</span>
            <span className="tiny">series</span>
          </div>
          <div className="col center">
            <span className="big-num" style={{ color: 'var(--gold)' }}>{stats.prs}</span>
            <span className="tiny">PRs</span>
          </div>
        </div>
        <p className="tiny mt">Duración: {fmtDuration(stats.durationSec)}</p>
      </div>

      <button className="btn mb" onClick={share}>📸 Compartir tarjeta</button>
      <button className="btn secondary mb" onClick={whatsapp}>💬 Compartir por WhatsApp</button>
      <button className="btn ghost" onClick={onDone}>Volver al inicio</button>
    </div>
  )
}
