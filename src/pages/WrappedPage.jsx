import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { celebrateBig } from '../lib/celebrate'
import { toKg, fmtVolume, prevMonthStr, monthLabel, monthRange } from '../lib/utils'
import { medalInfo, RANK_EMOJI } from '../lib/medals'
import Spinner from '../components/common/Spinner'

// Pantalla de cierre de mes estilo "Wrapped": tarjetas a pantalla completa
export default function WrappedPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [slides, setSlides] = useState(null)
  const [idx, setIdx] = useState(0)
  const month = prevMonthStr()

  useEffect(() => {
    const load = async () => {
      const range = monthRange(month)
      const [sets, sessions, runs, medals] = await Promise.all([
        supabase.from('sets')
          .select('weight, unit, reps, is_pr, sessions!inner(date, user_id)')
          .eq('sessions.user_id', user.id)
          .gte('sessions.date', range.from)
          .lte('sessions.date', range.to),
        supabase.from('sessions').select('date').eq('user_id', user.id).gte('date', range.from).lte('date', range.to),
        supabase.from('runs').select('date, distance_km, activity').eq('user_id', user.id).gte('date', range.from).lte('date', range.to),
        supabase.from('medals').select('*').eq('user_id', user.id).eq('month', month),
      ])

      const volumeKg = (sets.data || []).reduce((acc, s) => acc + toKg(s.weight, s.unit) * s.reps, 0)
      const prs = (sets.data || []).filter((s) => s.is_pr).length
      const days = new Set([...(sessions.data || []).map((s) => s.date), ...(runs.data || []).map((r) => r.date)]).size
      const km = (runs.data || []).reduce((acc, r) => acc + Number(r.distance_km || 0), 0)

      const list = [
        { type: 'intro' },
        { type: 'stat', emoji: '🏋️', value: fmtVolume(volumeKg, profile.unit), label: 'de volumen levantado' },
        { type: 'stat', emoji: '📅', value: `${days} días`, label: 'de actividad registrada' },
      ]
      if (km > 0) list.push({ type: 'stat', emoji: '🏃', value: `${km.toFixed(1)} km`, label: 'recorridos' })
      if (prs > 0) list.push({ type: 'stat', emoji: '💥', value: `${prs} récords`, label: 'personales rotos' })
      for (const m of medals.data || []) list.push({ type: 'medal', medal: m })
      list.push({ type: 'outro', medalCount: (medals.data || []).length })

      setSlides(list)
      localStorage.setItem(`gs-wrapped-seen-${month}`, '1')
    }
    load()
  }, [user.id, month])

  useEffect(() => {
    if (slides && slides[idx]?.type === 'medal') celebrateBig()
  }, [idx, slides])

  if (!slides) {
    return (
      <div className="wrapped-slide">
        <Spinner />
      </div>
    )
  }

  const slide = slides[idx]
  const next = () => {
    if (idx < slides.length - 1) setIdx(idx + 1)
    else navigate('/')
  }

  return (
    <div className="wrapped-slide" onClick={next} style={{ cursor: 'pointer' }}>
      <div className="row" style={{ position: 'absolute', top: 'calc(var(--safe-top) + 16px)', left: 20, right: 20, gap: 4 }}>
        {slides.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= idx ? '#fff' : 'rgba(255,255,255,0.25)' }} />
        ))}
      </div>

      {slide.type === 'intro' && (
        <div className="pop">
          <p style={{ fontSize: 60 }}>🎬</p>
          <h1 style={{ fontSize: 34, textTransform: 'capitalize' }}>{monthLabel(month)}</h1>
          <p style={{ opacity: 0.7, marginTop: 10, fontSize: 17 }}>Así te fue. Toca para avanzar.</p>
        </div>
      )}

      {slide.type === 'stat' && (
        <div className="pop" key={idx}>
          <p style={{ fontSize: 64 }}>{slide.emoji}</p>
          <h1 style={{ fontSize: 48, letterSpacing: -1 }}>{slide.value}</h1>
          <p style={{ opacity: 0.7, marginTop: 8, fontSize: 18 }}>{slide.label}</p>
        </div>
      )}

      {slide.type === 'medal' && (
        <div className="pop" key={idx}>
          <p style={{ fontSize: 80 }}>{slide.medal.rank ? RANK_EMOJI[slide.medal.rank] : medalInfo(slide.medal.code).emoji}</p>
          <h1 style={{ fontSize: 32 }}>{medalInfo(slide.medal.code).name}</h1>
          <p style={{ opacity: 0.7, marginTop: 8, fontSize: 16 }}>{medalInfo(slide.medal.code).desc}</p>
          {slide.medal.rank && <p style={{ marginTop: 12, fontSize: 15, opacity: 0.8 }}>Puesto {slide.medal.rank} de tu squad</p>}
        </div>
      )}

      {slide.type === 'outro' && (
        <div className="pop" key={idx}>
          <p style={{ fontSize: 64 }}>💪</p>
          <h1 style={{ fontSize: 30 }}>
            {slide.medalCount > 0
              ? `${slide.medalCount} ${slide.medalCount === 1 ? 'medalla ganada' : 'medallas ganadas'}`
              : 'Nuevo mes, nuevas metas'}
          </h1>
          <p style={{ opacity: 0.7, marginTop: 10, fontSize: 17 }}>El contador vuelve a cero. A por el próximo mes.</p>
          <button className="btn mt" style={{ background: '#fff', color: '#111' }} onClick={() => navigate('/')}>
            Empezar el mes
          </button>
        </div>
      )}
    </div>
  )
}
