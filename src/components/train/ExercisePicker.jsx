import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { MUSCLES, MUSCLE_LABELS } from '../../lib/utils'
import Modal from '../common/Modal'

// Buscador de la biblioteca de ejercicios, con opcion de crear uno nuevo
export default function ExercisePicker({ open, onClose, onPick }) {
  const { user } = useAuth()
  const [all, setAll] = useState([])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('pecho')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('exercises').select('*').order('name').then(({ data }) => setAll(data || []))
  }, [open])

  const filtered = all.filter(
    (e) =>
      (!muscle || e.muscle === muscle) &&
      (!query || e.name.toLowerCase().includes(query.toLowerCase()))
  )

  const create = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name: newName.trim(), muscle: newMuscle, created_by: user.id, is_global: false })
      .select()
      .single()
    if (!error && data) {
      onPick(data)
      setCreating(false)
      setNewName('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ejercicios">
      <input className="input mb" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="row mb" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className="chip" style={{ border: 'none', cursor: 'pointer', opacity: muscle === '' ? 1 : 0.5 }} onClick={() => setMuscle('')}>Todos</button>
        {MUSCLES.map((m) => (
          <button key={m} className="chip" style={{ border: 'none', cursor: 'pointer', opacity: muscle === m ? 1 : 0.5 }} onClick={() => setMuscle(m)}>
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
        {filtered.map((e) => (
          <button key={e.id} className="list-item" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', textAlign: 'left' }} onClick={() => onPick(e)}>
            <div className="col" style={{ flex: 1, gap: 2 }}>
              <span className="bold" style={{ fontSize: 15 }}>{e.name}</span>
              <span className="tiny">{MUSCLE_LABELS[e.muscle] || e.muscle}</span>
            </div>
            <span style={{ color: 'var(--text-3)' }}>+</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="muted center mt">Sin resultados</p>}
      </div>
      {creating ? (
        <div className="mt">
          <input className="input mb" placeholder="Nombre del ejercicio" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="input mb" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)}>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
          </select>
          <button className="btn" onClick={create}>Crear y agregar</button>
        </div>
      ) : (
        <button className="btn ghost mt" onClick={() => setCreating(true)}>+ Crear ejercicio nuevo</button>
      )}
    </Modal>
  )
}
