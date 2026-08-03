import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { cachedFetch } from '../lib/offline'
import { toKg, currentStreak, weekRange, monthStr, monthRange, prevMonthStr, todayStr, fmtVolume, GOALS } from '../lib/utils'
import ActivityRings, { RING_DEFS } from '../components/common/ActivityRings'
import ProgressBar from '../components/common/ProgressBar'
import Spinner from '../components/common/Spinner'

export default function HomePage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [wrappedReady, setWrappedReady] = useState(false)
  const [goalPrompt, setGoalPrompt] = useState(false)
  const [targetDays, setTargetDays] = useState(profile.monthly_target)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const week = weekRange()
      const month = monthRange()
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const sinceStr = since.toISOString().slice(0, 10)

      const result = await cachedFetch(`home-${user.id}`, async () => {
        const [sessions, sets, runs, goal, lastSession, activeRoutine] = await Promise.all([
          supabase.from('sessions').select('date').eq('user_id', user.id).gte('date', sinceStr),
          supabase.from('sets').select('weight, unit, reps, is_pr, sessions!inner(date, user_id)')
            .eq('sessions.user_id', user.id).gte('sessions.date', month.from),
          supabase.from('runs').select('date, duration_seconds, activity, distance_km').eq('user_id', user.id).gte('date', sinceStr),
          supabase.from('monthly_goals').select('*').eq('user_id', user.id).eq('month', monthStr()).maybeSingle(),
          supabase.from('sessions').select('day_name, date').eq('user_id', user.id).order('date', { ascending: false }).limit(1),
          supabase.from('routines').select('id, name, routine_days(id, name, emoji, color, sort_order)')
            .eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        ])
        return {
          sessions: sessions.data || [],
          sets: sets.data || [],
          runs: runs.data || [],
          goal: goal.data,
          lastSession: lastSession.data?.[0] || null,
          activeRoutine: activeRoutine.data,
          week,
          month,
        }
      })
      if (alive) {
        setData(result.data)
        setGoalPrompt(!result.data.goal && new Date().getDate() <= 3)
      }

      const prev = prevMonthStr()
      if (!localStorage.getItem(`gs-wrapped-seen-${prev}`)) {
        const { data: medals } = await supabase.from('medals').select('id').eq('user_id', user.id).eq('month', prev).limit(1)
        if (alive && medals?.length) setWrappedReady(true)
      }
    }
    load()
    return () => { alive = false }
  }, [user.id])

  if (!data) return <Spinner />

  const { week, month } = data
  const cardioGoals = ['grasa', 'resistencia']
  const cardioFirst = cardioGoals.includes(profile.goal)

  const weekDates = new Set(
    [...data.sessions.map((s) => s.date), ...data.runs.map((r) => r.date)].filter((d) => d >= week.from && d <= week.to)
  )
  const weekVolumeKg = data.sets
    .filter((s) => s.sessions.date >= week.from && s.sessions.date <= week.to)
    .reduce((acc, s) => acc + toKg(s.weight, s.unit) * s.reps, 0)
  const monthVolumeKg = data.sets.reduce((acc, s) => acc + toKg(s.weight, s.unit) * s.reps, 0)
  const cardioMinutes = data.runs
    .filter((r) => r.date >= week.from && r.date <= week.to)
    .reduce((acc, r) => acc + r.duration_seconds / 60, 0)

  const weeklyVolumeTarget = profile.weekly_target * 2500
  const cardioTarget = cardioFirst ? 150 : 90

  const allDates = [...new Set([...data.sessions.map((s) => s.date), ...data.runs.map((r) => r.date)])]
  const pardonUsed = profile.streak_pardon_used_month === monthStr()
  const streakPlain = currentStreak(allDates, false)
  const streakWithPardon = currentStreak(allDates, true)
  const streak = pardonUsed ? streakWithPardon : streakPlain
  // El dia de perdon solo se ofrece cuando la racha ya se rompio y aun se puede salvar
  const canOfferPardon = !pardonUsed && streakPlain === 0 && streakWithPardon > 0

  const usePardon = async () => {
    await supabase.from('profiles').update({ streak_pardon_used_month: monthStr() }).eq('id', user.id)
    await refreshProfile()
    toast('Día de perdón usado. Tu racha sigue viva.')
  }

  const monthDates = new Set(allDates.filter((d) => d >= month.from && d <= month.to))
  const monthPRs = data.sets.filter((s) => s.is_pr).length
  const monthTargetDays = data.goal?.target_days || profile.monthly_target
  const medalHint = nextMedalHint(monthPRs, monthDates.size, monthTargetDays)

  const daysSinceActivity = allDates.length
    ? Math.floor((new Date(todayStr()) - new Date(allDates.sort().at(-1))) / 86400000)
    : null

  const suggestedDay = suggestNextDay(data.activeRoutine, data.lastSession)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  const saveMonthlyGoal = async () => {
    await supabase.from('monthly_goals').upsert({ user_id: user.id, month: monthStr(), target_days: targetDays })
    setGoalPrompt(false)
    toast(`Meta del mes: ${targetDays} días`)
  }

  const rings = [
    { def: RING_DEFS[0], value: weekDates.size, target: profile.weekly_target, text: `${weekDates.size}/${profile.weekly_target} días` },
    { def: RING_DEFS[1], value: weekVolumeKg, target: weeklyVolumeTarget, text: fmtVolume(weekVolumeKg, profile.unit) },
    { def: RING_DEFS[2], value: Math.round(cardioMinutes), target: cardioTarget, text: `${Math.round(cardioMinutes)} min` },
  ]
  if (cardioFirst) rings.reverse()

  return (
    <div>
      <div className="row-between mb">
        <div>
          <p className="muted">{greeting}</p>
          <h1>{profile.display_name.split(' ')[0]} {GOALS[profile.goal].emoji}</h1>
        </div>
        {streak > 0 && (
          <div className="chip" style={{ fontSize: 15 }}>
            <span className="streak-flame">🔥</span> {streak}
          </div>
        )}
      </div>

      {wrappedReady && (
        <button className="card row-between" style={{ width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }} onClick={() => navigate('/wrapped')}>
          <div>
            <h3>🏅 Tu mes está listo</h3>
            <p className="muted">Mira tus números y tus medallas del mes pasado</p>
          </div>
          <span style={{ fontSize: 24 }}>→</span>
        </button>
      )}

      {daysSinceActivity != null && daysSinceActivity >= 3 && (
        <div className="card" style={{ background: 'var(--accent-soft)', border: 'none' }}>
          <p style={{ fontSize: 14 }}>
            <span className="bold">Llevas {daysSinceActivity} días sin actividad.</span>{' '}
            <span className="muted">Tu squad te está esperando.</span>
          </p>
        </div>
      )}

      {canOfferPardon && (
        <div className="card row-between">
          <div>
            <h3>Se te rompió la racha</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Te queda 1 día de perdón este mes, úsalo y sigue de largo
            </p>
          </div>
          <button className="btn small" onClick={usePardon}>Usarlo</button>
        </div>
      )}

      {goalPrompt && (
        <div className="card">
          <h3>Meta de {new Date().toLocaleDateString('es-DO', { month: 'long' })}</h3>
          <p className="muted mb" style={{ fontSize: 13 }}>Es día de definir cuántos días vas a entrenar este mes.</p>
          <div className="row">
            <input className="input" type="number" min="1" max="31" value={targetDays} onChange={(e) => setTargetDays(Number(e.target.value))} style={{ width: 90 }} />
            <button className="btn small" onClick={saveMonthlyGoal}>Fijar meta</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ gap: 18 }}>
          <ActivityRings
            days={weekDates.size / profile.weekly_target}
            volume={weekVolumeKg / weeklyVolumeTarget}
            cardio={cardioMinutes / cardioTarget}
            size={140}
          />
          <div className="col" style={{ gap: 12, flex: 1 }}>
            {rings.map((r) => (
              <div key={r.def.key}>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: r.def.color, display: 'inline-block' }} />
                  <span className="tiny bold">{r.def.label} esta semana</span>
                </div>
                <span className="bold" style={{ fontSize: 17 }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>¿Qué toca hoy?</h3>
        {suggestedDay ? (
          <div className="row-between mt">
            <div className="row">
              <span style={{ fontSize: 30 }}>{suggestedDay.emoji}</span>
              <div>
                <p className="bold">{suggestedDay.name}</p>
                <p className="tiny">{data.activeRoutine.name}</p>
              </div>
            </div>
            <button className="btn small" onClick={() => navigate('/entrenar/sesion', { state: { dayId: suggestedDay.id } })}>
              Entrenar
            </button>
          </div>
        ) : (
          <p className="muted mt" style={{ fontSize: 14 }}>
            No tienes rutina activa. Crea una en la pestaña Entrenar.
          </p>
        )}
      </div>

      {medalHint && (
        <div className="card">
          <div className="row-between mb">
            <h3>{medalHint.emoji} Próxima medalla</h3>
            <span className="tiny">{medalHint.progress}/{medalHint.target}</span>
          </div>
          <ProgressBar value={medalHint.progress} max={medalHint.target} />
          <p className="muted mt" style={{ fontSize: 13 }}>{medalHint.text}</p>
        </div>
      )}

      <button className="btn mb" onClick={() => navigate('/entrenar')}>🏋️ Entrenar ahora</button>
      <button className="btn secondary" onClick={() => navigate('/carrera')}>🏃 Registrar carrera</button>

      <p className="tiny center mt">
        Este mes: {monthDates.size} días activos, {fmtVolume(monthVolumeKg, profile.unit)} de volumen, {monthPRs} PRs
      </p>
    </div>
  )
}

function suggestNextDay(routine, lastSession) {
  const days = (routine?.routine_days || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  if (!days.length) return null
  if (!lastSession?.day_name) return days[0]
  const idx = days.findIndex((d) => d.name === lastSession.day_name)
  return days[(idx + 1) % days.length] || days[0]
}

function nextMedalHint(prs, days, targetDays) {
  const options = []
  if (prs < 3) {
    options.push({
      emoji: '🚀', progress: prs, target: 3, gap: 3 - prs,
      text: `Te ${3 - prs === 1 ? 'falta 1 récord' : `faltan ${3 - prs} récords`} para la medalla Superación`,
    })
  }
  const needed = Math.ceil(targetDays * 0.9)
  if (days < needed) {
    options.push({
      emoji: '✅', progress: days, target: needed, gap: needed - days,
      text: `Te ${needed - days === 1 ? 'falta 1 día' : `faltan ${needed - days} días`} para la medalla Cumplidor`,
    })
  }
  if (!options.length) return null
  return options.sort((a, b) => a.gap - b.gap)[0]
}
