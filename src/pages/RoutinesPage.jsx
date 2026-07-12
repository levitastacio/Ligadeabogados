import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { ROUTINE_TEMPLATES } from '../lib/templates'
import { createRoutineFromTemplate } from '../lib/createRoutine'
import { GOALS, MUSCLES, MUSCLE_LABELS } from '../lib/utils'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import ExercisePicker from '../components/train/ExercisePicker'

export default function RoutinesPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [routines, setRoutines] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editDay, setEditDay] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('routines')
      .select('*, routine_days(*, routine_day_exercises(*, exercises(id, name, muscle)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRoutines(data || [])
  }

  useEffect(() => { load() }, [user.id])

  const activate = async (id) => {
    await supabase.from('routines').update({ is_active: false }).eq('user_id', user.id)
    await supabase.from('routines').update({ is_active: true }).eq('id', id)
    load()
  }

  const removeRoutine = async (r) => {
    if (!confirm(`¿Eliminar la rutina "${r.name}"? Tus entrenos registrados no se borran.`)) return
    await supabase.from('routines').delete().eq('id', r.id)
    load()
  }

  const createBlank = async () => {
    if (!newName.trim()) return
    setBusy(true)
    const { data } = await supabase
      .from('routines')
      .insert({ user_id: user.id, name: newName.trim(), is_active: routines.length === 0 })
      .select()
      .single()
    setBusy(false)
    setCreating(false)
    setNewName('')
    if (data) load()
  }

  const useTemplate = async (template) => {
    setBusy(true)
    try {
      await createRoutineFromTemplate(template, user.id, true)
      toast(`Rutina "${template.name}" creada`)
      setCreating(false)
      load()
    } catch (err) {
      toast('No se pudo crear la rutina')
    } finally {
      setBusy(false)
    }
  }

  const addDay = async (routine) => {
    const { data } = await supabase
      .from('routine_days')
      .insert({
        routine_id: routine.id,
        name: `Día ${routine.routine_days.length + 1}`,
        sort_order: routine.routine_days.length,
      })
      .select('*, routine_day_exercises(*, exercises(id, name, muscle))')
      .single()
    if (data) setEditDay(data)
    load()
  }

  if (!routines) return <Spinner />

  const myTemplates = ROUTINE_TEMPLATES[profile.goal] || []
  const otherTemplates = Object.entries(ROUTINE_TEMPLATES)
    .filter(([g]) => g !== profile.goal)
    .flatMap(([g, list]) => list.map((t) => ({ ...t, goal: g })))

  return (
    <div>
      <div className="row-between mb">
        <h1>Mis rutinas</h1>
        <button className="btn small" onClick={() => setCreating(true)}>+ Nueva</button>
      </div>

      {routines.length === 0 && (
        <p className="muted mb">Crea tu primera rutina desde una plantilla o desde cero.</p>
      )}

      {routines.map((r) => (
        <div key={r.id} className="card">
          <div className="row-between">
            <div>
              <h3>{r.name}</h3>
              <p className="tiny">{r.routine_days.length} días</p>
            </div>
            {r.is_active ? (
              <span className="chip">Activa</span>
            ) : (
              <button className="btn secondary small" onClick={() => activate(r.id)}>Activar</button>
            )}
          </div>
          <div className="mt">
            {r.routine_days
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((d) => (
                <button
                  key={d.id}
                  className="list-item"
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', textAlign: 'left' }}
                  onClick={() => setEditDay(d)}
                >
                  <span style={{ fontSize: 22 }}>{d.emoji}</span>
                  <div className="col" style={{ flex: 1, gap: 2 }}>
                    <span className="bold" style={{ fontSize: 15, color: d.color }}>{d.name}</span>
                    <span className="tiny">{d.routine_day_exercises.length} ejercicios</span>
                  </div>
                  <span style={{ color: 'var(--text-3)' }}>Editar ›</span>
                </button>
              ))}
          </div>
          <div className="row mt">
            <button className="btn secondary small" onClick={() => addDay(r)}>+ Día</button>
            <button className="btn danger small" onClick={() => removeRoutine(r)}>Eliminar</button>
          </div>
        </div>
      ))}

      <button className="btn ghost" onClick={() => navigate('/entrenar')}>← Volver a Entrenar</button>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva rutina">
        <p className="muted mb" style={{ fontSize: 14 }}>Plantillas para tu meta ({GOALS[profile.goal].label}):</p>
        {myTemplates.map((t) => (
          <button key={t.name} className="btn secondary mb" disabled={busy} onClick={() => useTemplate(t)}>
            {t.name}
          </button>
        ))}
        <details className="mb">
          <summary className="muted" style={{ cursor: 'pointer', fontSize: 14 }}>Otras plantillas</summary>
          <div className="mt">
            {otherTemplates.map((t) => (
              <button key={t.name} className="btn secondary mb" disabled={busy} onClick={() => useTemplate(t)}>
                {GOALS[t.goal].emoji} {t.name}
              </button>
            ))}
          </div>
        </details>
        <label className="label">O crea una desde cero</label>
        <input className="input mb" placeholder="Nombre de la rutina" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" disabled={busy || !newName.trim()} onClick={createBlank}>Crear vacía</button>
      </Modal>

      {editDay && (
        <DayEditor
          day={editDay}
          onClose={() => { setEditDay(null); load() }}
        />
      )}
    </div>
  )
}

function DayEditor({ day, onClose }) {
  const [name, setName] = useState(day.name)
  const [emoji, setEmoji] = useState(day.emoji || '💪')
  const [color, setColor] = useState(day.color || '#0A84FF')
  const [muscles, setMuscles] = useState(day.muscles || [])
  const [items, setItems] = useState(
    (day.routine_day_exercises || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  )
  const [picker, setPicker] = useState(false)

  const toggleMuscle = (m) =>
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  const addExercise = async (exercise) => {
    setPicker(false)
    const { data } = await supabase
      .from('routine_day_exercises')
      .insert({ day_id: day.id, exercise_id: exercise.id, sort_order: items.length })
      .select('*, exercises(id, name, muscle)')
      .single()
    if (data) setItems((prev) => [...prev, data])
  }

  const updateItem = async (item, field, value) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: value } : i)))
    await supabase.from('routine_day_exercises').update({ [field]: value }).eq('id', item.id)
  }

  const removeItem = async (item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await supabase.from('routine_day_exercises').delete().eq('id', item.id)
  }

  const save = async () => {
    await supabase.from('routine_days').update({ name, emoji, color, muscles }).eq('id', day.id)
    onClose()
  }

  const removeDay = async () => {
    if (!confirm(`¿Eliminar el día "${day.name}"?`)) return
    await supabase.from('routine_days').delete().eq('id', day.id)
    onClose()
  }

  return (
    <Modal open onClose={save} title="Editar día">
      <div className="row mb">
        <input className="input" style={{ width: 70, textAlign: 'center', fontSize: 22 }} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 48, height: 48, border: 'none', background: 'none', cursor: 'pointer' }} />
      </div>
      <div className="row mb" style={{ flexWrap: 'wrap', gap: 6 }}>
        {MUSCLES.map((m) => (
          <button key={m} className="chip" style={{ border: 'none', cursor: 'pointer', opacity: muscles.includes(m) ? 1 : 0.45 }} onClick={() => toggleMuscle(m)}>
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div key={item.id} className="card" style={{ padding: 12 }}>
          <div className="row-between">
            <span className="bold" style={{ fontSize: 15 }}>{item.exercises?.name}</span>
            <button className="btn ghost small" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item)}>Quitar</button>
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <div className="col" style={{ flex: 1 }}>
              <span className="tiny">Series</span>
              <input className="input" type="number" min="1" value={item.target_sets} onChange={(e) => updateItem(item, 'target_sets', Number(e.target.value))} style={{ padding: '8px 10px' }} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <span className="tiny">Reps</span>
              <input className="input" value={item.target_reps} onChange={(e) => updateItem(item, 'target_reps', e.target.value)} style={{ padding: '8px 10px' }} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <span className="tiny">Descanso (s)</span>
              <input className="input" type="number" min="0" step="15" value={item.rest_seconds} onChange={(e) => updateItem(item, 'rest_seconds', Number(e.target.value))} style={{ padding: '8px 10px' }} />
            </div>
          </div>
        </div>
      ))}

      <button className="btn secondary mb" onClick={() => setPicker(true)}>+ Agregar ejercicio</button>
      <button className="btn mb" onClick={save}>Guardar día</button>
      <button className="btn danger" onClick={removeDay}>Eliminar día</button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />
    </Modal>
  )
}
