import { useState } from 'react'
import { supabase, isDemo } from '../lib/supabase'
import { DEMO_GROUP_CODE } from '../lib/demo/db'

export default function AuthPage() {
  const [mode, setMode] = useState(isDemo ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (data.user && !data.session) {
          setInfo('Revisa tu correo para confirmar la cuenta y luego inicia sesión.')
        }
      }
    } catch (err) {
      setError(translateAuthError(err.message))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (err) setError(translateAuthError(err.message))
  }

  return (
    <div className="page-plain" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="center mb">
        <div style={{ fontSize: 60 }}>🏋️</div>
        <h1>Gym Squad</h1>
        <p className="muted">Entrena con tu squad, compite y rompe tus récords</p>
      </div>

      {isDemo && (
        <div className="card" style={{ background: 'var(--accent-soft)', border: 'none' }}>
          <h3>Modo demo activo</h3>
          <p className="muted mt" style={{ fontSize: 13.5, marginTop: 6 }}>
            Estás probando la app sin base de datos. Crea una cuenta con cualquier correo y contraseña
            (no se envía nada, todo queda en este dispositivo). En el último paso del registro,
            únete al squad de prueba con el código <span className="bold accent">{DEMO_GROUP_CODE}</span> para
            ver rankings, feed y duelos con datos reales.
          </p>
        </div>
      )}

      <div className="card">
        <div className="segmented mb">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Crear cuenta</button>
        </div>
        <form onSubmit={submit}>
          <label className="label">Correo</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder={isDemo ? 'tu@correo.com' : ''} />
          <label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={isDemo ? 'mínimo 6 caracteres' : ''} />
          {error && <p className="mt" style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          {info && <p className="mt" style={{ color: 'var(--success)', fontSize: 14 }}>{info}</p>}
          <button className="btn mt" type="submit" disabled={busy}>
            {busy ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
        <button className="btn secondary mt" onClick={google}>
          {isDemo ? 'Entrar como invitado' : 'Continuar con Google'}
        </button>
      </div>
    </div>
  )
}

function translateAuthError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (m.includes('already registered')) return 'Ese correo ya tiene una cuenta.'
  if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  if (m.includes('not confirmed')) return 'Confirma tu correo antes de entrar.'
  return 'No se pudo completar. Verifica tus datos e intenta de nuevo.'
}
