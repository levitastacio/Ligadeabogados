import Avatar from '../common/Avatar'

// Podio visual top 3: oro al centro, plata a la izquierda, bronce a la derecha
const STEPS = [
  { index: 1, height: 76, medal: '🥈', tint: 'rgba(174,174,178,0.22)' },
  { index: 0, height: 108, medal: '🥇', tint: 'rgba(255,214,10,0.26)' },
  { index: 2, height: 56, medal: '🥉', tint: 'rgba(205,127,50,0.22)' },
]

export default function Podium({ entries, formatValue, championId }) {
  return (
    <div className="podium">
      {STEPS.map((step) => {
        const entry = entries[step.index]
        if (!entry) return <div key={step.index} className="podium-step" />
        const isFirst = step.index === 0
        return (
          <div key={step.index} className="podium-step pop">
            <Avatar
              profile={{ id: entry.user_id, display_name: entry.display_name, avatar_url: entry.avatar_url }}
              size={isFirst ? 60 : 46}
              champion={entry.user_id === championId}
            />
            <span className="bold" style={{ fontSize: 13.5, textAlign: 'center', lineHeight: 1.2 }}>
              {entry.display_name.split(' ')[0]}
            </span>
            <span className="tiny" style={{ textAlign: 'center' }}>{formatValue(entry)}</span>
            <div className="podium-bar" style={{ height: step.height, background: step.tint }}>
              <span style={{ fontSize: isFirst ? 26 : 21 }}>{step.medal}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
