import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { GOALS, monthStr, prevMonthStr } from '../lib/utils'
import { exportCSV, exportJSON, importLegacyBackup } from '../lib/backup'
import Avatar from '../components/common/Avatar'
import Segmented from '../components/common/Segmented'

export default function ProfilePage() {
  const { user, profile, refreshProfile, setTheme } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [weeklyTarget, setWeeklyTarget] = useState(profile.weekly_target)
  const [monthlyTarget, setMonthlyTarget] = useState(profile.monthly_target)
  const [theme, setThemeState] = useState(localStorage.getItem('gs-theme') || 'auto')

  const update = async (fields, msg = 'Guardado') => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id)
    if (error) toast('No se pudo guardar')
    else {
      await refreshProfile()
      toast(msg)
    }
  }

  const changeAvatar = async (file) => {
    if (!file) return
    setBusy(true)
    const path = `${user.id}/avatar-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await update({ avatar_url: url }, 'Foto actualizada')
    } else {
      toast('No se pudo subir la foto')
    }
    setBusy(false)
  }

  const changeTheme = (t) => {
    setThemeState(t)
    setTheme(t === 'auto' ? null : t)
  }

  const doImport = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const json = JSON.parse(await file.text())
      const report = await importLegacyBackup(json, user.id, profile.unit)
      toast(`Importado: ${report.sessionsImported} sesiones, ${report.setsImported} series, ${report.exercisesCreated} ejercicios nuevos`)
    } catch (err) {
      toast('El archivo no es un respaldo válido de Gym Progress AI')
    } finally {
      setBusy(false)
    }
  }

  const awardMedals = async () => {
    const month = prevMonthStr()
    if (!confirm(`¿Otorgar las medallas de ${month} ahora? (Respaldo manual del proceso automático)`)) return
    setBusy(true)
    const { error } = await supabase.rpc('award_monthly_medals', { p_month: month })
    setBusy(false)
    if (error) toast('No se pudieron otorgar: ' + error.message)
    else toast(`Medallas de ${month} otorgadas`)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <h1 className="mb">Perfil</h1>

      <div className="card">
        <div className="row">
          <button style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <Avatar profile={profile} size={64} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />
          <div className="col" style={{ flex: 1 }}>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => displayName.trim() && displayName !== profile.display_name && update({ display_name: displayName.trim() })}
            />
            <span className="tiny">@{profile.username} · toca la foto para cambiarla</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb">Tu meta</h3>
        <div className="col" style={{ gap: 8 }}>
          {Object.entries(GOALS).map(([key, g]) => (
            <button
              key={key}
              className={`goal-card ${profile.goal === key ? 'selected' : ''}`}
              style={{ '--goal-color': g.color, padding: 12 }}
              onClick={() => update({ goal: key }, `Meta cambiada: ${g.label}`)}
            >
              <span style={{ fontSize: 20, marginRight: 8 }}>{g.emoji}</span>
              <span className="bold" style={{ color: g.color }}>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb">Metas de constancia</h3>
        <label className="label" style={{ marginTop: 0 }}>Días por semana</label>
        <div className="row">
          <input className="input" type="number" min="1" max="7" value={weeklyTarget} onChange={(e) => setWeeklyTarget(Number(e.target.value))} />
          <button className="btn small" onClick={() => update({ weekly_target: weeklyTarget })}>Guardar</button>
        </div>
        <label className="label">Días este mes ({monthStr()})</label>
        <div className="row">
          <input className="input" type="number" min="1" max="31" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value))} />
          <button
            className="btn small"
            onClick={async () => {
              await update({ monthly_target: monthlyTarget })
              await supabase.from('monthly_goals').upsert({ user_id: user.id, month: monthStr(), target_days: monthlyTarget })
            }}
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="mb">Preferencias</h3>
        <label className="label" style={{ marginTop: 0 }}>Unidad de peso</label>
        <Segmented
          options={[{ value: 'lb', label: 'Libras (lb)' }, { value: 'kg', label: 'Kilos (kg)' }]}
          value={profile.unit}
          onChange={(unit) => update({ unit }, `Unidad: ${unit}`)}
        />
        <label className="label">Tema</label>
        <Segmented
          options={[{ value: 'auto', label: 'Automático' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
          value={theme}
          onChange={changeTheme}
        />
      </div>

      <div className="card">
        <h3 className="mb">Datos</h3>
        <button className="btn secondary mb" disabled={busy} onClick={() => exportJSON(user.id)}>Exportar respaldo JSON</button>
        <button className="btn secondary mb" disabled={busy} onClick={() => exportCSV(user.id)}>Exportar CSV</button>
        <label className="btn secondary mb" style={{ cursor: 'pointer' }}>
          {busy ? 'Procesando...' : 'Importar respaldo de Gym Progress AI'}
          <input type="file" accept="application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        </label>
        <button className="btn secondary" disabled={busy} onClick={awardMedals}>🏅 Otorgar medallas del mes pasado</button>
        <p className="tiny mt">El botón de medallas es un respaldo manual: normalmente pg_cron las otorga el día 1 a las 6:00 AM.</p>
      </div>

      <button className="btn danger" onClick={logout}>Cerrar sesión</button>
      <p className="tiny center mt">Gym Squad v1.0</p>
    </div>
  )
}
