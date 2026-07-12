import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { offlineInsert, offlineUpdate } from '../lib/offline'
import { publishToGroups } from '../lib/feed'
import { celebratePR, vibrate } from '../lib/celebrate'
import { toKg, fmtWeight, restSecondsForGoal, todayStr, GOALS } from '../lib/utils'
import ExerciseBlock from '../components/train/ExerciseBlock'
import SetLogger from '../components/train/SetLogger'
import RestTimer from '../components/train/RestTimer'
import SessionSummary from '../components/train/SessionSummary'
import ExercisePicker from '../components/train/ExercisePicker'
import Modal from '../components/common/Modal'
import Avatar from '../components/common/Avatar'
import Spinner from '../components/common/Spinner'

export default function LiveSessionPage() {
  const { user, profile, accent } = useAuth()
  const { state } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const [day, setDay] = useState(null)
  const [exercises, setExercises] = useState([])
  const [history, setHistory] = useState({})
  const [loggedSets, setLoggedSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [logger, setLogger] = useState(null)
  const [rest, setRest] = useState(null)
  const [picker, setPicker] = useState(false)
  const [partner, setPartner] = useState(null)
  const [partnerPicker, setPartnerPicker] = useState(false)
  const [squadmates, setSquadmates] = useState([])
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [mood, setMood] = useState(3)
  const [sleep, setSleep] = useState(3)
  const [note, setNote] = useState('')

  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const sessionCreated = useRef(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    const load = async () => {
      let exList = []
      let dayRow = null
      if (state?.dayId) {
        const { data } = await supabase
          .from('routine_days')
          .select('*, routine_day_exercises(*, exercises(*))')
          .eq('id', state.dayId)
          .single()
        dayRow = data
        exList = (data?.routine_day_exercises || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter((e) => e.exercises)
          .map((e) => ({ exercise: e.exercises, target: e }))
      }
      setDay(dayRow)
      setExercises(exList)
      if (exList.length) await loadHistory(exList.map((e) => e.exercise.id))
      setLoading(false)
    }
    load()
  }, [state])

  const loadHistory = async (ids) => {
    const { data } = await supabase
      .from('sets')
      .select('exercise_id, weight, unit, reps, rpe, created_at, sessions!inner(user_id, date)')
      .eq('sessions.user_id', user.id)
      .in('exercise_id', ids)
      .order('created_at', { ascending: false })
      .limit(600)
    const h = {}
    for (const s of data || []) {
      const cur = h[s.exercise_id] || { last: null, maxKg: 0 }
      if (!cur.last) cur.last = s
      cur.maxKg = Math.max(cur.maxKg, toKg(s.weight, s.unit))
      h[s.exercise_id] = cur
    }
    setHistory((prev) => ({ ...prev, ...h }))
  }

  const openPartnerPicker = async () => {
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    const groupIds = (memberships || []).map((m) => m.group_id)
    if (groupIds.length) {
      const { data } = await supabase
        .from('group_members')
        .select('user_id, profiles(id, display_name, avatar_url)')
        .in('group_id', groupIds)
      const seen = new Map()
      for (const row of data || []) {
        if (row.user_id !== user.id && row.profiles) seen.set(row.user_id, row.profiles)
      }
      setSquadmates([...seen.values()])
    }
    setPartnerPicker(true)
  }

  const ensureSession = async () => {
    if (sessionCreated.current) return
    sessionCreated.current = true
    await offlineInsert('sessions', {
      id: sessionId,
      user_id: user.id,
      date: todayStr(),
      day_name: day?.name || null,
      partner_id: partner?.id || null,
    })
  }

  const saveSet = async ({ weight, reps, rpe }) => {
    const ex = logger.exercise
    await ensureSession()
    const kg = toKg(weight, profile.unit)
    const prev = history[ex.id] || { maxKg: 0, last: null }
    const isPR = kg > prev.maxKg
    const row = {
      session_id: sessionId,
      exercise_id: ex.id,
      weight,
      unit: profile.unit,
      reps,
      rpe,
    }
    await offlineInsert('sets', row)
    setLoggedSets((prev) => [...prev, { ...row, is_pr: isPR }])
    setHistory((h) => ({
      ...h,
      [ex.id]: { last: { ...row, created_at: new Date().toISOString() }, maxKg: Math.max(prev.maxKg, kg) },
    }))
    setLogger(null)
    if (isPR) {
      celebratePR()
      toast(`🏆 ¡Récord personal en ${ex.name}!`)
    } else {
      vibrate(25)
    }
    const restSec = logger.target?.rest_seconds || restSecondsForGoal(profile.goal)
    if (restSec > 0) setRest({ seconds: restSec, key: Date.now() })
  }

  const openLogger = (exercise, target) => {
    const h = history[exercise.id]
    let suggestion = null
    if (h?.last) {
      const last = h.last
      const bump = profile.unit === 'lb' ? 5 : 2.5
      const tryWeight = last.rpe != null && last.rpe <= 7 ? Number(last.weight) + bump : Number(last.weight)
      suggestion = {
        weight: tryWeight,
        reps: last.reps,
        text: `La última vez: ${fmtWeight(last.weight, last.unit)}×${last.reps}${last.rpe ? ` con RPE ${last.rpe}` : ''}.${tryWeight > Number(last.weight) ? ` Prueba ${tryWeight}` : ''}`,
      }
    }
    setLogger({ exercise, target, suggestion })
  }

  const addExercise = (exercise) => {
    setPicker(false)
    if (!exercises.some((e) => e.exercise.id === exercise.id)) {
      setExercises((prev) => [...prev, { exercise, target: null }])
      loadHistory([exercise.id])
    }
  }

  const finish = async () => {
    const volumeKg = loggedSets.reduce((acc, s) => acc + toKg(s.weight, s.unit) * s.reps, 0)
    const prs = loggedSets.filter((s) => s.is_pr).length
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
    const stats = {
      volumeKg,
      prs,
      setsCount: loggedSets.length,
      exercisesCount: new Set(loggedSets.map((s) => s.exercise_id)).size,
      durationSec,
    }
    if (sessionCreated.current) {
      await offlineUpdate('sessions', { mood, sleep_quality: sleep, note: note || null, partner_id: partner?.id || null }, { id: sessionId })
      await publishToGroups(user.id, 'entreno', {
        day_name: day?.name || 'Entreno libre',
        volume_kg: Math.round(volumeKg),
        sets: stats.setsCount,
        prs,
        duration_min: Math.round(durationSec / 60),
        partner: partner?.display_name || null,
      })
    }
    setFinishing(false)
    setSummary(stats)
  }

  if (loading) return <Spinner />

  if (summary) {
    return (
      <SessionSummary
        dayName={day?.name}
        stats={summary}
        unit={profile.unit}
        accent={accent}
        onDone={() => navigate('/')}
      />
    )
  }

  return (
    <div>
      <div className="row-between mb">
        <div>
          <h1>{day ? `${day.emoji} ${day.name}` : '⚡ Entreno libre'}</h1>
          <p className="tiny">{loggedSets.length} series guardadas</p>
        </div>
        <button className="btn small" onClick={() => (loggedSets.length ? setFinishing(true) : navigate(-1))}>
          {loggedSets.length ? 'Terminar' : 'Salir'}
        </button>
      </div>

      <button className="chip mb" style={{ border: 'none', cursor: 'pointer' }} onClick={openPartnerPicker}>
        {partner ? `🤝 Con ${partner.display_name}` : '🤝 Marcar compañero de entreno'}
      </button>

      {exercises.map(({ exercise, target }) => (
        <ExerciseBlock
          key={exercise.id}
          exercise={exercise}
          target={target}
          sets={loggedSets.filter((s) => s.exercise_id === exercise.id)}
          onAddSet={() => openLogger(exercise, target)}
        />
      ))}

      <button className="btn secondary mb" onClick={() => setPicker(true)}>+ Agregar ejercicio</button>

      {logger && (
        <SetLogger
          key={`${logger.exercise.id}-${loggedSets.length}`}
          open
          onClose={() => setLogger(null)}
          onSave={saveSet}
          exercise={logger.exercise}
          suggestion={logger.suggestion}
          unit={profile.unit}
        />
      )}

      {rest && <RestTimer key={rest.key} seconds={rest.seconds} onDone={() => setRest(null)} />}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />

      <Modal open={partnerPicker} onClose={() => setPartnerPicker(false)} title="Compañero de entreno">
        {squadmates.length === 0 && <p className="muted">Aún no tienes compañeros de squad.</p>}
        {squadmates.map((p) => (
          <button
            key={p.id}
            className="list-item"
            style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', textAlign: 'left' }}
            onClick={() => { setPartner(p); setPartnerPicker(false) }}
          >
            <Avatar profile={p} size={36} />
            <span className="bold">{p.display_name}</span>
          </button>
        ))}
        {partner && (
          <button className="btn ghost mt" onClick={() => { setPartner(null); setPartnerPicker(false) }}>
            Quitar compañero
          </button>
        )}
      </Modal>

      <Modal open={finishing} onClose={() => setFinishing(false)} title="Terminar entreno">
        <label className="label">¿Cómo estuvo tu energía?</label>
        <RatingRow value={mood} onChange={setMood} icons={['😩', '😕', '😐', '🙂', '🔥']} />
        <label className="label">¿Cómo dormiste anoche?</label>
        <RatingRow value={sleep} onChange={setSleep} icons={['😵', '🥱', '😐', '😌', '😴']} />
        <label className="label">Nota (opcional)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Buen día de pecho..." />
        <button className="btn mt" onClick={finish}>Guardar y ver resumen</button>
      </Modal>
    </div>
  )
}

function RatingRow({ value, onChange, icons }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      {icons.map((icon, i) => (
        <button
          key={i}
          onClick={() => onChange(i + 1)}
          style={{
            fontSize: 26,
            padding: 8,
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            background: value === i + 1 ? 'var(--accent-soft)' : 'transparent',
            transform: value === i + 1 ? 'scale(1.15)' : 'scale(1)',
            transition: 'all 0.15s var(--ease)',
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
