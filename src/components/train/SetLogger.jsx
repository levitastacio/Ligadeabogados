import { useState } from 'react'
import Modal from '../common/Modal'
import NumPad from '../common/NumPad'
import Segmented from '../common/Segmented'

// Registro rapido de peso x reps x RPE con teclado numerico grande
export default function SetLogger({ open, onClose, onSave, exercise, suggestion, unit }) {
  const [field, setField] = useState('weight')
  const [weight, setWeight] = useState(suggestion?.weight != null ? String(suggestion.weight) : '')
  const [reps, setReps] = useState(suggestion?.reps != null ? String(suggestion.reps) : '')
  const [rpe, setRpe] = useState('')

  const values = { weight, reps, rpe }
  const setters = { weight: setWeight, reps: setReps, rpe: setRpe }

  const save = () => {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (!w || !r) return
    onSave({ weight: w, reps: r, rpe: rpe ? parseFloat(rpe) : null })
  }

  return (
    <Modal open={open} onClose={onClose} title={exercise?.name}>
      {suggestion?.text && (
        <p className="chip mb" style={{ fontSize: 13 }}>💡 {suggestion.text}</p>
      )}
      <Segmented
        options={[
          { value: 'weight', label: `Peso (${unit})` },
          { value: 'reps', label: 'Reps' },
          { value: 'rpe', label: 'RPE' },
        ]}
        value={field}
        onChange={setField}
      />
      <div className="numpad-display mt">
        {values[field] || <span style={{ color: 'var(--text-3)' }}>0</span>}
      </div>
      <p className="tiny center mb">
        {weight || 0} {unit} × {reps || 0} reps{rpe ? ` · RPE ${rpe}` : ''}
      </p>
      <NumPad value={values[field]} onChange={setters[field]} allowDecimal={field !== 'reps'} />
      <button className="btn mt" onClick={save} disabled={!parseFloat(weight) || !parseInt(reps, 10)}>
        Guardar serie
      </button>
    </Modal>
  )
}
