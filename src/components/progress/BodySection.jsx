import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/Toast'
import { fmtDate, todayStr } from '../../lib/utils'
import { tooltipStyle } from './ExerciseProgress'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'

// Peso corporal, medidas y fotos de progreso privadas
export default function BodySection({ accent }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [logs, setLogs] = useState(null)
  const [photos, setPhotos] = useState([])
  const [adding, setAdding] = useState(false)
  const [compare, setCompare] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('body_logs').select('*').eq('user_id', user.id).order('date')
    setLogs(data || [])
    const { data: files } = await supabase.storage.from('progress-photos').list(user.id, { sortBy: { column: 'name', order: 'desc' } })
    const withUrls = []
    for (const f of files || []) {
      const { data: signed } = await supabase.storage.from('progress-photos').createSignedUrl(`${user.id}/${f.name}`, 3600)
      if (signed) withUrls.push({ name: f.name, url: signed.signedUrl, date: f.name.slice(0, 10) })
    }
    setPhotos(withUrls)
  }

  useEffect(() => { load() }, [user.id])

  const uploadPhoto = async (file) => {
    if (!file) return
    setUploading(true)
    const path = `${user.id}/${todayStr()}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('progress-photos').upload(path, file)
    setUploading(false)
    if (error) toast('No se pudo subir la foto')
    else {
      toast('Foto de progreso guardada (solo tú la ves)')
      load()
    }
  }

  if (!logs) return <Spinner />

  const weightData = logs.filter((l) => l.weight != null).map((l) => ({ label: fmtDate(l.date), peso: Number(l.weight) }))
  const last = logs.filter((l) => l.weight != null).at(-1)
  const first = logs.filter((l) => l.weight != null)[0]
  const delta = last && first ? Number(last.weight) - Number(first.weight) : 0
  const wantsDown = profile.goal === 'grasa'
  const trendGood = wantsDown ? delta <= 0 : delta >= 0

  return (
    <div>
      <div className="row mb">
        <button className="btn" onClick={() => setAdding(true)}>+ Registrar peso y medidas</button>
      </div>

      {last && (
        <div className="card row-between">
          <div>
            <span className="big-num">{Number(last.weight)} {profile.unit}</span>
            <p className="tiny">Último registro: {fmtDate(last.date)}</p>
          </div>
          {logs.length > 1 && (
            <span className="chip" style={{ background: trendGood ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)', color: trendGood ? 'var(--success)' : 'var(--danger)' }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)} {profile.unit} {trendGood ? '✓ según tu meta' : 'contra tu meta'}
            </span>
          )}
        </div>
      )}

      {weightData.length > 1 && (
        <div className="card">
          <h3 className="mb">Peso corporal ({profile.unit})</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="peso" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {logs.some((l) => l.arm_cm || l.waist_cm || l.chest_cm) && (
        <div className="card">
          <h3 className="mb">Medidas (cm)</h3>
          {logs.filter((l) => l.arm_cm || l.waist_cm || l.chest_cm).slice(-5).reverse().map((l) => (
            <div key={l.id} className="list-item">
              <span className="tiny" style={{ width: 60 }}>{fmtDate(l.date)}</span>
              <span style={{ fontSize: 13, flex: 1 }}>
                {l.arm_cm && `Brazo ${l.arm_cm} `}
                {l.chest_cm && `Pecho ${l.chest_cm} `}
                {l.waist_cm && `Cintura ${l.waist_cm}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row-between mb">
          <h3>Fotos de progreso 🔒</h3>
          <label className="btn secondary small" style={{ width: 'auto' }}>
            {uploading ? 'Subiendo...' : '+ Foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          </label>
        </div>
        <p className="tiny mb">Privadas: solo tú puedes verlas.</p>
        {photos.length === 0 ? (
          <p className="muted center">Sube tu primera foto para comparar tu progreso.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {photos.map((ph) => (
                <button key={ph.name} style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} onClick={() => setCompare({ a: photos.at(-1), b: ph })}>
                  <img src={ph.url} alt={ph.date} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} />
                  <span className="tiny">{fmtDate(ph.date)}</span>
                </button>
              ))}
            </div>
            {photos.length > 1 && <p className="tiny mt">Toca una foto para compararla lado a lado con la más antigua.</p>}
          </>
        )}
      </div>

      <Modal open={!!compare} onClose={() => setCompare(null)} title="Antes y después">
        {compare && (
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            {[compare.a, compare.b].map((ph, i) => (
              <div key={i} style={{ flex: 1 }}>
                <img src={ph.url} alt={ph.date} style={{ width: '100%', borderRadius: 14 }} />
                <p className="tiny center mt">{fmtDate(ph.date)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {adding && <BodyLogForm onClose={() => { setAdding(false); load() }} userId={user.id} unit={profile.unit} />}
    </div>
  )
}

function BodyLogForm({ onClose, userId, unit }) {
  const toast = useToast()
  const [weight, setWeight] = useState('')
  const [arm, setArm] = useState('')
  const [waist, setWaist] = useState('')
  const [chest, setChest] = useState('')

  const save = async () => {
    const { error } = await supabase.from('body_logs').insert({
      user_id: userId,
      date: todayStr(),
      weight: weight ? parseFloat(weight) : null,
      arm_cm: arm ? parseFloat(arm) : null,
      waist_cm: waist ? parseFloat(waist) : null,
      chest_cm: chest ? parseFloat(chest) : null,
    })
    if (error) toast('No se pudo guardar')
    else {
      if (weight) await supabase.from('profiles').update({ body_weight: parseFloat(weight) }).eq('id', userId)
      toast('Registro guardado')
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Peso y medidas">
      <label className="label">Peso ({unit})</label>
      <input className="input" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="185" />
      <label className="label">Brazo (cm)</label>
      <input className="input" type="number" inputMode="decimal" value={arm} onChange={(e) => setArm(e.target.value)} />
      <label className="label">Pecho (cm)</label>
      <input className="input" type="number" inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} />
      <label className="label">Cintura (cm)</label>
      <input className="input" type="number" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
      <button className="btn mt" onClick={save}>Guardar</button>
    </Modal>
  )
}
