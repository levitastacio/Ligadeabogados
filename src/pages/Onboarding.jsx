import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { GOALS, genInviteCode } from '../lib/utils'
import { ROUTINE_TEMPLATES } from '../lib/templates'
import { createRoutineFromTemplate } from '../lib/createRoutine'
import ProgressBar from '../components/common/ProgressBar'

const TOTAL_STEPS = 5

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [goal, setGoal] = useState('masa')
  const [weeklyTarget, setWeeklyTarget] = useState(4)
  const [templateIdx, setTemplateIdx] = useState(0)
  const [groupMode, setGroupMode] = useState('crear')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))

  const validateIdentity = async () => {
    setError('')
    if (!displayName.trim() || !username.trim()) {
      setError('Completa tu nombre y tu apodo.')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/i.test(username.trim())) {
      setError('El apodo debe tener 3 a 20 letras, números o guion bajo.')
      return
    }
    setBusy(true)
    const { data: available } = await supabase.rpc('username_available', { p_username: username.trim() })
    setBusy(false)
    if (available === false) {
      setError('Ese apodo ya está en uso, prueba otro.')
      return
    }
    next()
  }

  const finish = async () => {
    setBusy(true)
    setError('')
    try {
      let avatarUrl = null
      if (avatarFile) {
        const path = `${user.id}/avatar-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        if (!upErr) {
          avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        }
      }

      const { error: pErr } = await supabase.from('profiles').insert({
        id: user.id,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        goal,
        weekly_target: weeklyTarget,
        monthly_target: weeklyTarget * 4,
      })
      if (pErr) throw pErr

      const templates = ROUTINE_TEMPLATES[goal] || []
      if (templateIdx >= 0 && templates[templateIdx]) {
        await createRoutineFromTemplate(templates[templateIdx], user.id, true)
      }

      if (groupMode === 'crear' && groupName.trim()) {
        const code = genInviteCode()
        const { data: g, error: gErr } = await supabase
          .from('groups')
          .insert({ name: groupName.trim(), invite_code: code, owner_id: user.id })
          .select()
          .single()
        if (gErr) throw gErr
        await supabase.from('group_members').insert({ group_id: g.id, user_id: user.id })
        toast(`Grupo creado. Código de invitación: ${code}`)
      } else if (groupMode === 'unirme' && inviteCode.trim()) {
        const { data: g } = await supabase
          .from('groups')
          .select('id, name')
          .eq('invite_code', inviteCode.trim().toUpperCase())
          .maybeSingle()
        if (!g) throw new Error('Código de grupo no encontrado')
        const { error: mErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: user.id })
        if (mErr && !mErr.message.includes('duplicate')) throw mErr
        toast(`Te uniste a ${g.name}`)
      }

      await refreshProfile()
    } catch (err) {
      setError(err.message || 'Algo salió mal, intenta de nuevo.')
      setBusy(false)
    }
  }

  const templates = ROUTINE_TEMPLATES[goal] || []

  return (
    <div className="page-plain">
      <div className="mb">
        <ProgressBar value={step + 1} max={TOTAL_STEPS} />
        <p className="tiny mt">Paso {step + 1} de {TOTAL_STEPS}</p>
      </div>

      {step === 0 && (
        <div className="pop">
          <h1>¿Quién eres?</h1>
          <p className="muted">Así te verá tu squad.</p>
          <label className="label">Nombre</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Juan Pérez" />
          <label className="label">Apodo (único)</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="juanp" autoCapitalize="none" />
          <label className="label">Foto de perfil (opcional)</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
          {error && <p className="mt" style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          <button className="btn mt" onClick={validateIdentity} disabled={busy}>Siguiente</button>
        </div>
      )}

      {step === 1 && (
        <div className="pop">
          <h1>¿Cuál es tu meta?</h1>
          <p className="muted mb">Define el color de tu app y tus plantillas.</p>
          <div className="col" style={{ gap: 10 }}>
            {Object.entries(GOALS).map(([key, g]) => (
              <button
                key={key}
                className={`goal-card ${goal === key ? 'selected' : ''}`}
                style={{ '--goal-color': g.color }}
                onClick={() => setGoal(key)}
              >
                <div className="row">
                  <span style={{ fontSize: 30 }}>{g.emoji}</span>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="bold" style={{ color: g.color }}>{g.label}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{g.desc}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button className="btn mt" onClick={next}>Siguiente</button>
        </div>
      )}

      {step === 2 && (
        <div className="pop">
          <h1>¿Cuántos días por semana?</h1>
          <p className="muted mb">Tu meta de constancia. Puedes cambiarla luego.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                className="btn small"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  fontSize: 20,
                  background: weeklyTarget === n ? 'var(--accent)' : 'var(--accent-soft)',
                  color: weeklyTarget === n ? '#fff' : 'var(--accent)',
                }}
                onClick={() => setWeeklyTarget(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button className="btn mt" onClick={next}>Siguiente</button>
        </div>
      )}

      {step === 3 && (
        <div className="pop">
          <h1>Tu rutina</h1>
          <p className="muted mb">Elige una plantilla según tu meta o empieza desde cero.</p>
          <div className="col" style={{ gap: 10 }}>
            {templates.map((t, i) => (
              <button
                key={t.name}
                className={`goal-card ${templateIdx === i ? 'selected' : ''}`}
                style={{ '--goal-color': GOALS[goal].color }}
                onClick={() => setTemplateIdx(i)}
              >
                <span className="bold">{t.name}</span>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {t.days.length} días: {t.days.map((d) => d.name).join(', ')}
                </p>
              </button>
            ))}
            <button
              className={`goal-card ${templateIdx === -1 ? 'selected' : ''}`}
              style={{ '--goal-color': GOALS[goal].color }}
              onClick={() => setTemplateIdx(-1)}
            >
              <span className="bold">Crear desde cero</span>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Arma tu rutina en la pestaña Entrenar</p>
            </button>
          </div>
          <button className="btn mt" onClick={next}>Siguiente</button>
        </div>
      )}

      {step === 4 && (
        <div className="pop">
          <h1>Tu squad</h1>
          <p className="muted mb">Únete a un grupo con código o crea el tuyo.</p>
          <div className="segmented mb">
            <button className={groupMode === 'crear' ? 'active' : ''} onClick={() => setGroupMode('crear')}>Crear grupo</button>
            <button className={groupMode === 'unirme' ? 'active' : ''} onClick={() => setGroupMode('unirme')}>Tengo un código</button>
            <button className={groupMode === 'luego' ? 'active' : ''} onClick={() => setGroupMode('luego')}>Después</button>
          </div>
          {groupMode === 'crear' && (
            <>
              <label className="label">Nombre del grupo</label>
              <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Los Bestias" />
            </>
          )}
          {groupMode === 'unirme' && (
            <>
              <label className="label">Código de invitación</label>
              <input className="input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} style={{ textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }} />
            </>
          )}
          {error && <p className="mt" style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          <button className="btn mt" onClick={finish} disabled={busy}>
            {busy ? 'Creando tu cuenta...' : 'Empezar a entrenar'}
          </button>
        </div>
      )}
    </div>
  )
}
