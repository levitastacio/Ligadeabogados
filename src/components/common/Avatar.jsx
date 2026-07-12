import { avatarColor, initials } from '../../lib/utils'

export default function Avatar({ profile, size = 40, champion = false }) {
  const name = profile?.display_name || '?'
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.4,
    background: profile?.avatar_url ? 'var(--bg)' : avatarColor(profile?.id || name),
  }
  return (
    <div className="avatar" style={style}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt={name} /> : initials(name)}
      {champion && <span className="champ-badge" title="Campeón de volumen del mes pasado">👑</span>}
    </div>
  )
}
