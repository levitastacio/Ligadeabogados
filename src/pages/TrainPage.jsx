import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { cachedFetch } from '../lib/offline'
import { fmtDate } from '../lib/utils'
import Spinner from '../components/common/Spinner'
import EmptyState from '../components/common/EmptyState'

export default function TrainPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState(undefined)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let alive = true
    cachedFetch(`train-${user.id}`, async () => {
      const [r, s] = await Promise.all([
        supabase.from('routines')
          .select('id, name, routine_days(id, name, emoji, color, muscles, sort_order, routine_day_exercises(id))')
          .eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('sessions').select('id, date, day_name, sets(id)')
          .eq('user_id', user.id).order('date', { ascending: false }).limit(5),
      ])
      return { routine: r.data, recent: s.data || [] }
    }).then(({ data }) => {
      if (!alive) return
      setRoutine(data.routine)
      setRecent(data.recent)
    })
    return () => { alive = false }
  }, [user.id])

  if (routine === undefined) return <Spinner />

  const days = (routine?.routine_days || []).slice().sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <div className="row-between mb">
        <h1>Entrenar</h1>
        <button className="btn ghost small" onClick={() => navigate('/entrenar/rutinas')}>Mis rutinas</button>
      </div>

      {routine ? (
        <>
          <p className="muted mb">{routine.name}</p>
          {days.map((day) => (
            <button
              key={day.id}
              className="card row-between"
              style={{ width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onClick={() => navigate('/entrenar/sesion', { state: { dayId: day.id } })}
            >
              <div className="row">
                <span style={{ fontSize: 28 }}>{day.emoji}</span>
                <div>
                  <h3 style={{ color: day.color }}>{day.name}</h3>
                  <p className="tiny">
                    {day.routine_day_exercises.length} ejercicios · {day.muscles.join(', ')}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 22, color: 'var(--text-3)' }}>›</span>
            </button>
          ))}
        </>
      ) : (
        <EmptyState emoji="📋" title="Sin rutina activa" subtitle="Crea una rutina o usa una plantilla según tu meta.">
          <button className="btn" onClick={() => navigate('/entrenar/rutinas')}>Crear rutina</button>
        </EmptyState>
      )}

      <button
        className="card row-between"
        style={{ width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
        onClick={() => navigate('/entrenar/sesion', { state: { free: true } })}
      >
        <div className="row">
          <span style={{ fontSize: 28 }}>⚡</span>
          <div>
            <h3>Entrenamiento libre</h3>
            <p className="tiny">Agrega ejercicios sobre la marcha</p>
          </div>
        </div>
        <span style={{ fontSize: 22, color: 'var(--text-3)' }}>›</span>
      </button>

      {recent.length > 0 && (
        <div className="card">
          <h3 className="mb">Últimos entrenos</h3>
          {recent.map((s) => (
            <div key={s.id} className="list-item">
              <div className="col" style={{ flex: 1 }}>
                <span className="bold" style={{ fontSize: 15 }}>{s.day_name || 'Entreno libre'}</span>
                <span className="tiny">{fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <span className="chip">{s.sets.length} series</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
