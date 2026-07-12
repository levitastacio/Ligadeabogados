import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { cachedFetch } from '../../lib/offline'
import { fmtVolume, fmtDuration, ACTIVITIES } from '../../lib/utils'
import { fmtPace } from '../../lib/pace'
import { medalInfo, RANK_EMOJI } from '../../lib/medals'
import { vibrate } from '../../lib/celebrate'
import Avatar from '../common/Avatar'
import Spinner from '../common/Spinner'

export default function FeedSection({ group, unit }) {
  const { user } = useAuth()
  const [events, setEvents] = useState(null)

  const load = async () => {
    const { data } = await cachedFetch(`feed-${group.id}`, async () => {
      const res = await supabase
        .from('feed_events')
        .select('*, profiles(id, display_name, avatar_url), reactions(user_id, emoji)')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(40)
      if (res.error) throw res.error
      return res.data || []
    })
    setEvents(data)
  }

  useEffect(() => {
    setEvents(null)
    load()
  }, [group.id])

  const react = async (event, emoji) => {
    const mine = event.reactions.find((r) => r.user_id === user.id)
    vibrate(20)
    if (mine) {
      await supabase.from('reactions').delete().eq('event_id', event.id).eq('user_id', user.id)
    } else {
      await supabase.from('reactions').insert({ event_id: event.id, user_id: user.id, emoji })
    }
    load()
  }

  if (!events) return <Spinner />
  if (events.length === 0) {
    return <p className="muted center mt">El feed está vacío. Registra un entreno o una carrera para estrenarlo.</p>
  }

  return (
    <div>
      {events.map((e) => (
        <FeedItem key={e.id} event={e} unit={unit} myId={user.id} onReact={react} />
      ))}
    </div>
  )
}

function FeedItem({ event, unit, myId, onReact }) {
  const p = event.payload || {}
  const defaultEmoji = event.type === 'run' ? '👏' : '🔥'
  const mine = event.reactions.find((r) => r.user_id === myId)
  const when = new Date(event.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  let body = null
  if (event.type === 'entreno') {
    body = (
      <>
        <span className="bold">{event.profiles?.display_name}</span> completó <span className="bold">{p.day_name}</span>: {fmtVolume(p.volume_kg || 0, unit)} en {p.sets} series
        {p.prs > 0 && <> con <span className="bold">{p.prs} {p.prs === 1 ? 'PR' : 'PRs'} 🏆</span></>}
        {p.partner && <> junto a {p.partner} 🤝</>}
      </>
    )
  } else if (event.type === 'run') {
    const act = ACTIVITIES[p.activity] || ACTIVITIES.otro
    body = (
      <>
        <span className="bold">{event.profiles?.display_name}</span>{' '}
        {p.distance_km
          ? <>corrió <span className="bold">{Number(p.distance_km).toFixed(1)} km</span> en {fmtDuration(p.duration_seconds)}{p.pace_seconds ? ` (${fmtPace(p.pace_seconds)})` : ''}</>
          : <>hizo {act.label.toLowerCase()} por {fmtDuration(p.duration_seconds)}</>}
        {' '}{act.emoji}
        {p.route_name && <> en {p.route_name}</>}
        {p.is_race && <> 🏁</>}
        {p.records?.length > 0 && <> · <span className="bold">🏆 {p.records.join(', ')}</span></>}
      </>
    )
  } else if (event.type === 'medalla') {
    const info = medalInfo(p.code)
    body = (
      <>
        <span className="bold">{event.profiles?.display_name}</span> ganó {RANK_EMOJI[p.rank] || info.emoji} <span className="bold">{info.name}</span> del mes
      </>
    )
  } else if (event.type === 'duelo') {
    body = (
      <>
        🏆 <span className="bold">{p.winner_name}</span> ganó el duelo de <span className="bold">{p.metric_label}</span> contra {p.loser_name} ({p.winner_value} vs {p.loser_value})
      </>
    )
  } else if (event.type === 'racha') {
    body = (
      <>
        <span className="bold">{event.profiles?.display_name}</span> lleva una racha de <span className="bold">{p.days} días</span> 🔥
      </>
    )
  } else {
    body = <span className="bold">{event.profiles?.display_name}</span>
  }

  const counts = {}
  for (const r of event.reactions) counts[r.emoji] = (counts[r.emoji] || 0) + 1

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar profile={event.profiles} size={38} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14.5, lineHeight: 1.45 }}>{body}</p>
          <div className="row-between mt" style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="chip"
                style={{ border: 'none', cursor: 'pointer', opacity: mine ? 1 : 0.6, fontSize: 13 }}
                onClick={() => onReact(event, defaultEmoji)}
              >
                {defaultEmoji} {event.reactions.length || ''}
              </button>
              {Object.entries(counts)
                .filter(([e]) => e !== defaultEmoji)
                .map(([e, c]) => (
                  <span key={e} className="chip" style={{ fontSize: 13 }}>{e} {c}</span>
                ))}
            </div>
            <span className="tiny">{when}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
