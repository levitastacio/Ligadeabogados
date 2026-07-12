import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../common/Toast'
import { offlineInsert } from '../../lib/offline'
import { celebrateBig } from '../../lib/celebrate'
import { todayStr, fmtDate, MUSCLES, MUSCLE_LABELS } from '../../lib/utils'
import Modal from '../common/Modal'
import Avatar from '../common/Avatar'
import ProgressBar from '../common/ProgressBar'
import Spinner from '../common/Spinner'

const METRIC_LABELS = {
  volumen_total: 'Volumen total',
  volumen_musculo: 'Volumen por músculo',
  dias: 'Días entrenados',
  km: 'Kilómetros',
}

export default function DuelsSection({ group, members }) {
  const { user } = useAuth()
  const toast = useToast()
  const [duels, setDuels] = useState(null)
  const [progress, setProgress] = useState({})
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const memberIds = members.map((m) => m.id)
    const { data } = await supabase
      .from('duels')
      .select('*')
      .or(`challenger_id.in.(${memberIds.join(',')}),opponent_id.in.(${memberIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(20)
    const list = data || []
    setDuels(list)

    for (const d of list) {
      if (d.status === 'activo' || d.status === 'pendiente') {
        const { data: prog } = await supabase.rpc('get_duel_progress', { p_duel_id: d.id })
        if (prog?.[0]) setProgress((prev) => ({ ...prev, [d.id]: prog[0] }))
        // Cerrar duelos vencidos
        if (d.status === 'activo' && d.ends_on < todayStr() && prog?.[0]) {
          await finishDuel(d, prog[0])
        }
      }
    }
  }

  const finishDuel = async (duel, prog) => {
    const cv = Number(prog.challenger_value)
    const ov = Number(prog.opponent_value)
    const winnerId = cv >= ov ? duel.challenger_id : duel.opponent_id
    const { data: updated } = await supabase
      .from('duels')
      .update({ status: 'terminado', winner_id: winnerId })
      .eq('id', duel.id)
      .eq('status', 'activo')
      .select()
    if (updated?.length) {
      const winner = members.find((m) => m.id === winnerId)
      const loser = members.find((m) => m.id === (winnerId === duel.challenger_id ? duel.opponent_id : duel.challenger_id))
      await offlineInsert('feed_events', {
        user_id: user.id,
        group_id: group.id,
        type: 'duelo',
        payload: {
          metric_label: METRIC_LABELS[duel.metric] + (duel.muscle ? ` (${MUSCLE_LABELS[duel.muscle]})` : ''),
          winner_name: winner?.display_name || 'Alguien',
          loser_name: loser?.display_name || 'su rival',
          winner_value: Math.round(Math.max(cv, ov)),
          loser_value: Math.round(Math.min(cv, ov)),
        },
      })
      if (winnerId === user.id) celebrateBig()
    }
  }

  useEffect(() => {
    setDuels(null)
    if (members.length) load()
  }, [group.id, members.length])

  const respond = async (duel, accept) => {
    await supabase
      .from('duels')
      .update({ status: accept ? 'activo' : 'rechazado' })
      .eq('id', duel.id)
    toast(accept ? '¡Duelo aceptado! Que gane el mejor.' : 'Duelo rechazado')
    load()
  }

  if (!duels) return <Spinner />

  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || 'Rival'
  const profileOf = (id) => members.find((m) => m.id === id) || { id, display_name: '?' }
  const active = duels.filter((d) => d.status === 'activo' || d.status === 'pendiente')
  const done = duels.filter((d) => d.status === 'terminado').slice(0, 5)

  return (
    <div>
      <button className="btn mb" onClick={() => setCreating(true)}>⚔️ Retar a un duelo</button>

      {active.length === 0 && <p className="muted center">No hay duelos activos. ¡Reta a alguien!</p>}

      {active.map((d) => {
        const prog = progress[d.id]
        const cv = Number(prog?.challenger_value || 0)
        const ov = Number(prog?.opponent_value || 0)
        const max = Math.max(cv, ov, 1)
        const isKm = d.metric === 'km'
        const fmt = (v) => (isKm ? `${v.toFixed(1)} km` : d.metric === 'dias' ? `${Math.round(v)} días` : `${Math.round(v)} kg`)
        return (
          <div key={d.id} className="card">
            <div className="row-between mb">
              <span className="bold">{METRIC_LABELS[d.metric]}{d.muscle ? ` · ${MUSCLE_LABELS[d.muscle]}` : ''}</span>
              <span className="tiny">{fmtDate(d.starts_on)} al {fmtDate(d.ends_on)}</span>
            </div>
            {d.status === 'pendiente' ? (
              <>
                <p className="muted" style={{ fontSize: 14 }}>
                  {nameOf(d.challenger_id)} retó a {nameOf(d.opponent_id)}
                </p>
                {d.opponent_id === user.id && (
                  <div className="row mt">
                    <button className="btn small" onClick={() => respond(d, true)}>Aceptar</button>
                    <button className="btn danger small" onClick={() => respond(d, false)}>Rechazar</button>
                  </div>
                )}
                {d.challenger_id === user.id && <p className="tiny mt">Esperando respuesta...</p>}
              </>
            ) : (
              <>
                {[{ id: d.challenger_id, v: cv }, { id: d.opponent_id, v: ov }].map(({ id, v }) => (
                  <div key={id} className="mt" style={{ marginTop: 10 }}>
                    <div className="row-between" style={{ marginBottom: 4 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar profile={profileOf(id)} size={26} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{nameOf(id)}</span>
                      </div>
                      <span className="bold" style={{ fontSize: 14 }}>{fmt(v)}</span>
                    </div>
                    <ProgressBar value={v} max={max} color={v >= max ? 'var(--gold)' : undefined} />
                  </div>
                ))}
              </>
            )}
          </div>
        )
      })}

      {done.length > 0 && (
        <div className="card">
          <h3 className="mb">Duelos terminados</h3>
          {done.map((d) => (
            <div key={d.id} className="list-item">
              <span style={{ fontSize: 20 }}>🏆</span>
              <span style={{ flex: 1, fontSize: 14 }}>
                <span className="bold">{nameOf(d.winner_id)}</span> ganó en {METRIC_LABELS[d.metric]}
              </span>
              <span className="tiny">{fmtDate(d.ends_on)}</span>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreateDuel
          members={members.filter((m) => m.id !== user.id)}
          onClose={() => { setCreating(false); load() }}
          userId={user.id}
        />
      )}
    </div>
  )
}

function CreateDuel({ members, onClose, userId }) {
  const toast = useToast()
  const [opponent, setOpponent] = useState(members[0]?.id || '')
  const [metric, setMetric] = useState('volumen_total')
  const [muscle, setMuscle] = useState('pecho')
  const [days, setDays] = useState(7)

  const create = async () => {
    if (!opponent) return
    const ends = new Date()
    ends.setDate(ends.getDate() + days)
    const { error } = await supabase.from('duels').insert({
      challenger_id: userId,
      opponent_id: opponent,
      metric,
      muscle: metric === 'volumen_musculo' ? muscle : null,
      starts_on: todayStr(),
      ends_on: ends.toISOString().slice(0, 10),
    })
    if (error) toast('No se pudo crear el duelo')
    else toast('Duelo enviado. Esperando que lo acepte.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nuevo duelo">
      <label className="label">Rival</label>
      <select className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
        {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
      </select>
      <label className="label">Métrica</label>
      <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
        {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {metric === 'volumen_musculo' && (
        <>
          <label className="label">Músculo</label>
          <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLES.filter((m) => m !== 'cardio').map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
          </select>
        </>
      )}
      <label className="label">Duración</label>
      <div className="row">
        {[7, 14, 30].map((d) => (
          <button key={d} className="btn small" style={{ flex: 1, background: days === d ? 'var(--accent)' : 'var(--accent-soft)', color: days === d ? '#fff' : 'var(--accent)' }} onClick={() => setDays(d)}>
            {d} días
          </button>
        ))}
      </div>
      <button className="btn mt" onClick={create} disabled={!opponent}>⚔️ Enviar reto</button>
    </Modal>
  )
}
