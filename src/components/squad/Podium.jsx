import Avatar from '../common/Avatar'

// Podio visual top 3: oro al centro, plata a la izquierda, bronce a la derecha
export default function Podium({ entries, formatValue, championId }) {
  const [first, second, third] = entries
  const steps = [
    { entry: second, height: 64, medal: '🥈' },
    { entry: first, height: 92, medal: '🥇' },
    { entry: third, height: 46, medal: '🥉' },
  ]
  return (
    <div className="podium">
      {steps.map((s, i) =>
        s.entry ? (
          <div key={i} className="podium-step pop">
            <Avatar profile={{ id: s.entry.user_id, display_name: s.entry.display_name, avatar_url: s.entry.avatar_url }} size={i === 1 ? 58 : 46} champion={s.entry.user_id === championId} />
            <span className="bold" style={{ fontSize: 13, textAlign: 'center' }}>{s.entry.display_name.split(' ')[0]}</span>
            <span className="tiny">{formatValue(s.entry)}</span>
            <div className="podium-bar" style={{ height: s.height }}>{s.medal}</div>
          </div>
        ) : (
          <div key={i} className="podium-step" />
        )
      )}
    </div>
  )
}
