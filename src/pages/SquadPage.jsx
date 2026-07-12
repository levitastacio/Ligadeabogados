import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/common/Toast'
import { cachedFetch } from '../lib/offline'
import { genInviteCode, monthStr, fmtTons } from '../lib/utils'
import { shareWhatsAppText } from '../lib/share'
import Segmented from '../components/common/Segmented'
import Modal from '../components/common/Modal'
import Spinner from '../components/common/Spinner'
import EmptyState from '../components/common/EmptyState'
import FeedSection from '../components/squad/FeedSection'
import RankingSection from '../components/squad/RankingSection'
import DuelsSection from '../components/squad/DuelsSection'
import RoutesSection from '../components/squad/RoutesSection'

export default function SquadPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [groups, setGroups] = useState(null)
  const [selectedId, setSelectedId] = useState(localStorage.getItem('gs-group') || null)
  const [members, setMembers] = useState([])
  const [totals, setTotals] = useState(null)
  const [section, setSection] = useState('feed')
  const [managing, setManaging] = useState(false)

  const loadGroups = async () => {
    const { data } = await cachedFetch(`groups-${user.id}`, async () => {
      const res = await supabase.from('group_members').select('groups(id, name, invite_code, owner_id)').eq('user_id', user.id)
      if (res.error) throw res.error
      return (res.data || []).map((m) => m.groups).filter(Boolean)
    })
    setGroups(data)
    if (data.length && !data.some((g) => g.id === selectedId)) {
      setSelectedId(data[0].id)
    }
  }

  useEffect(() => { loadGroups() }, [user.id])

  const group = groups?.find((g) => g.id === selectedId) || groups?.[0] || null

  useEffect(() => {
    if (!group) return
    localStorage.setItem('gs-group', group.id)
    let alive = true
    const load = async () => {
      const [m, t] = await Promise.all([
        supabase.from('group_members').select('profiles(id, display_name, avatar_url)').eq('group_id', group.id),
        supabase.rpc('get_group_totals', { p_group_id: group.id, p_month: monthStr() }),
      ])
      if (!alive) return
      setMembers((m.data || []).map((x) => x.profiles).filter(Boolean))
      setTotals(t.data?.[0] || null)
    }
    load()
    return () => { alive = false }
  }, [group?.id])

  if (!groups) return <Spinner />

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="mb">Squad</h1>
        <EmptyState emoji="👥" title="Aún no tienes squad" subtitle="Crea un grupo e invita a tus amigos, o únete con un código.">
          <button className="btn" onClick={() => setManaging(true)}>Crear o unirme a un grupo</button>
        </EmptyState>
        <GroupManager open={managing} onClose={() => { setManaging(false); loadGroups() }} userId={user.id} />
      </div>
    )
  }

  return (
    <div>
      <div className="row-between mb">
        <h1>Squad</h1>
        <button className="btn ghost small" onClick={() => setManaging(true)}>Grupos</button>
      </div>

      {groups.length > 1 && (
        <div className="row mb" style={{ flexWrap: 'wrap', gap: 6 }}>
          {groups.map((g) => (
            <button
              key={g.id}
              className="chip"
              style={{ border: 'none', cursor: 'pointer', opacity: g.id === group.id ? 1 : 0.5 }}
              onClick={() => setSelectedId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {totals && (Number(totals.volume_kg) > 0 || Number(totals.km) > 0) && (
        <div className="card" style={{ background: 'var(--accent-soft)', border: 'none' }}>
          <p style={{ fontSize: 15 }}>
            💪 Este mes <span className="bold">{group.name}</span> levantó{' '}
            <span className="bold">{fmtTons(Number(totals.volume_kg))}</span> y corrió{' '}
            <span className="bold">{Number(totals.km).toFixed(1)} km</span> 🏃
          </p>
        </div>
      )}

      <div className="mb">
        <Segmented
          options={[
            { value: 'feed', label: 'Feed' },
            { value: 'ranking', label: 'Ranking' },
            { value: 'duelos', label: 'Duelos' },
            { value: 'rutas', label: 'Rutas' },
          ]}
          value={section}
          onChange={setSection}
        />
      </div>

      {section === 'feed' && <FeedSection group={group} unit={profile.unit} />}
      {section === 'ranking' && <RankingSection group={group} unit={profile.unit} />}
      {section === 'duelos' && <DuelsSection group={group} members={members} />}
      {section === 'rutas' && <RoutesSection group={group} />}

      <GroupManager
        open={managing}
        onClose={() => { setManaging(false); loadGroups() }}
        userId={user.id}
        groups={groups}
        toast={toast}
      />
    </div>
  )
}

function GroupManager({ open, onClose, userId, groups = [], toast }) {
  const [mode, setMode] = useState('lista')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const inviteCode = genInviteCode()
      const { data: g, error: gErr } = await supabase
        .from('groups')
        .insert({ name: name.trim(), invite_code: inviteCode, owner_id: userId })
        .select()
        .single()
      if (gErr) throw gErr
      await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
      setName('')
      setMode('lista')
      onClose()
    } catch (err) {
      setError('No se pudo crear el grupo.')
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data: g } = await supabase.from('groups').select('id, name').eq('invite_code', code.trim().toUpperCase()).maybeSingle()
      if (!g) {
        setError('Código no encontrado. Verifica con tu amigo.')
        setBusy(false)
        return
      }
      const { error: mErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
      if (mErr && !mErr.message.includes('duplicate')) throw mErr
      setCode('')
      setMode('lista')
      onClose()
    } catch (err) {
      setError('No se pudo unir al grupo.')
    } finally {
      setBusy(false)
    }
  }

  const invite = (g) => {
    shareWhatsAppText(
      `💪 Únete a mi squad *${g.name}* en Gym Squad\n🔑 Código de invitación: *${g.invite_code}*\n📲 ${window.location.origin}`
    )
  }

  const leave = async (g) => {
    if (!confirm(`¿Salir del grupo "${g.name}"?`)) return
    await supabase.from('group_members').delete().eq('group_id', g.id).eq('user_id', userId)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Mis grupos">
      {mode === 'lista' && (
        <>
          {groups.map((g) => (
            <div key={g.id} className="list-item">
              <div className="col" style={{ flex: 1, gap: 2 }}>
                <span className="bold">{g.name}</span>
                <span className="tiny">Código: {g.invite_code}</span>
              </div>
              <button className="btn secondary small" onClick={() => invite(g)}>Invitar</button>
              <button className="btn ghost small" style={{ color: 'var(--danger)' }} onClick={() => leave(g)}>Salir</button>
            </div>
          ))}
          <div className="row mt">
            <button className="btn" onClick={() => setMode('crear')}>+ Crear grupo</button>
            <button className="btn secondary" onClick={() => setMode('unirme')}>Tengo un código</button>
          </div>
        </>
      )}
      {mode === 'crear' && (
        <>
          <label className="label">Nombre del grupo</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Los Bestias" />
          {error && <p className="mt" style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          <button className="btn mt" onClick={create} disabled={busy}>Crear</button>
          <button className="btn ghost mt" onClick={() => setMode('lista')}>Volver</button>
        </>
      )}
      {mode === 'unirme' && (
        <>
          <label className="label">Código de invitación</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} style={{ textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700 }} placeholder="ABC123" />
          {error && <p className="mt" style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          <button className="btn mt" onClick={join} disabled={busy}>Unirme</button>
          <button className="btn ghost mt" onClick={() => setMode('lista')}>Volver</button>
        </>
      )}
    </Modal>
  )
}
