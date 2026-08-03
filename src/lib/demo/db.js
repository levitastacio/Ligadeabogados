// Base de datos del modo demo: vive en localStorage e imita las tablas de Supabase.
// Se siembra con la biblioteca de ejercicios y un squad de prueba con actividad
// para que rankings, feed, podio y duelos tengan contenido real que mostrar.
import { DEMO_EXERCISES } from './exercises'

const KEY = 'gym-squad-demo-db'
export const DEMO_GROUP_CODE = 'SQUAD1'

const TABLES = [
  'profiles', 'groups', 'group_members', 'exercises', 'routines', 'routine_days',
  'routine_day_exercises', 'sessions', 'sets', 'runs', 'body_logs', 'medals',
  'duels', 'feed_events', 'reactions', 'monthly_goals', 'auth_users', 'storage_objects',
]

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function dayOffset(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let cache = null

export function getDB() {
  if (cache) return cache
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      cache = JSON.parse(raw)
      for (const t of TABLES) if (!cache[t]) cache[t] = []
      return cache
    } catch {
      // base corrupta: se resiembra
    }
  }
  cache = seed()
  persist()
  return cache
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // cuota llena (por ejemplo muchas fotos): la sesion sigue en memoria
  }
}

export function resetDB() {
  localStorage.removeItem(KEY)
  cache = null
}

function seed() {
  const db = {}
  for (const t of TABLES) db[t] = []

  db.exercises = DEMO_EXERCISES.map((e) => ({
    id: uuid(), name: e.name, muscle: e.muscle, video_url: e.video_url,
    created_by: null, is_global: true, created_at: new Date().toISOString(),
  }))
  const exByName = Object.fromEntries(db.exercises.map((e) => [e.name, e]))

  const mates = [
    { display_name: 'Carlos Méndez', username: 'carlosm', goal: 'fuerza', body_weight: 190, factor: 1.0, kmFactor: 0.6 },
    { display_name: 'José Ramírez', username: 'joser', goal: 'grasa', body_weight: 205, factor: 0.72, kmFactor: 1.5 },
    { display_name: 'Ana Batista', username: 'anab', goal: 'resistencia', body_weight: 140, factor: 0.55, kmFactor: 2.2 },
  ].map((m) => ({
    id: uuid(), username: m.username, display_name: m.display_name, avatar_url: null,
    goal: m.goal, body_weight: m.body_weight, unit: 'lb', weekly_target: 4, monthly_target: 16,
    streak_pardon_used_month: null, created_at: new Date().toISOString(),
    _factor: m.factor, _kmFactor: m.kmFactor,
  }))

  const group = {
    id: uuid(), name: 'Los Bestias', invite_code: DEMO_GROUP_CODE,
    owner_id: mates[0].id, created_at: new Date().toISOString(),
  }
  db.groups.push(group)

  const liftPlan = [
    { day: 'Push', names: ['Press banca con barra', 'Press de hombros con mancuernas', 'Elevaciones laterales'] },
    { day: 'Pull', names: ['Dominadas', 'Remo con barra', 'Curl con barra'] },
    { day: 'Legs', names: ['Sentadilla con barra', 'Prensa de pierna', 'Peso muerto rumano'] },
  ]

  mates.forEach((mate, mi) => {
    const { _factor: factor, _kmFactor: kmFactor } = mate
    delete mate._factor
    delete mate._kmFactor
    db.profiles.push(mate)
    db.group_members.push({ group_id: group.id, user_id: mate.id, joined_at: new Date().toISOString() })

    // Entrenos de los ultimos 40 dias, dejando huecos para que las rachas varien
    for (let d = 40; d >= 0; d--) {
      if ((d + mi) % 7 === 3 || (d + mi) % 7 === 6) continue
      if (d % 2 === (mi % 2)) continue
      const plan = liftPlan[(d + mi) % liftPlan.length]
      const session = {
        id: uuid(), user_id: mate.id, date: dayOffset(d), day_name: plan.day,
        partner_id: null, mood: 3 + ((d + mi) % 3), sleep_quality: 3 + (d % 3),
        note: null, created_at: new Date().toISOString(),
      }
      db.sessions.push(session)
      for (const name of plan.names) {
        const ex = exByName[name]
        if (!ex) continue
        const base = Math.round((95 + (40 - d) * 0.9 + (name.length % 7) * 6) * factor)
        for (let s = 0; s < 3; s++) {
          db.sets.push({
            id: uuid(), session_id: session.id, exercise_id: ex.id,
            weight: base + s * 5, unit: 'lb', reps: 10 - s, rpe: 7 + s * 0.5,
            note: null, is_pr: false, created_at: new Date().toISOString(),
          })
        }
      }
    }

    // Carreras: Ana corre mucho, Jose medio, Carlos poco
    const routes = ['Malecón 5K', 'Parque Mirador', 'Vuelta al barrio']
    for (let d = 38; d >= 0; d -= 4) {
      const km = Number((4 + ((d + mi) % 5) * 1.4 * kmFactor).toFixed(1))
      const paceBase = 400 - kmFactor * 40 + (d % 5) * 8
      const sec = Math.round(km * paceBase)
      db.runs.push({
        id: uuid(), user_id: mate.id, date: dayOffset(d), activity: 'correr',
        distance_km: km, duration_seconds: sec, avg_pace_seconds: Math.round(sec / km),
        elevation_m: null, note: null, route_name: routes[(d + mi) % routes.length],
        is_race: false, created_at: new Date().toISOString(),
      })
    }
  })

  markPRs(db)

  // Medallas del mes pasado para que la vitrina y la corona del ranking tengan datos
  const prev = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  db.medals.push(
    { id: uuid(), user_id: mates[0].id, group_id: group.id, month: prev, code: 'vol', rank: 1, value: 18400, awarded_at: new Date().toISOString() },
    { id: uuid(), user_id: mates[2].id, group_id: group.id, month: prev, code: 'km', rank: 1, value: 96, awarded_at: new Date().toISOString() },
    { id: uuid(), user_id: mates[1].id, group_id: group.id, month: prev, code: 'dias', rank: 1, value: 19, awarded_at: new Date().toISOString() }
  )

  // Feed inicial con actividad de los ultimos dias
  const feedSeed = [
    { user: mates[0], type: 'entreno', hours: 5, payload: { day_name: 'Push', volume_kg: 2180, sets: 12, prs: 1, duration_min: 58, partner: null } },
    { user: mates[2], type: 'run', hours: 20, payload: { activity: 'correr', distance_km: 8.4, duration_seconds: 2680, pace_seconds: 319, route_name: 'Malecón 5K', is_race: false, records: [] } },
    { user: mates[1], type: 'entreno', hours: 30, payload: { day_name: 'Legs', volume_kg: 1740, sets: 9, prs: 0, duration_min: 47, partner: 'Carlos Méndez' } },
    { user: mates[0], type: 'medalla', hours: 60, payload: { code: 'vol', rank: 1, month: prev } },
  ]
  for (const f of feedSeed) {
    const created = new Date()
    created.setHours(created.getHours() - f.hours)
    db.feed_events.push({
      id: uuid(), user_id: f.user.id, group_id: group.id, type: f.type,
      payload: f.payload, created_at: created.toISOString(),
    })
  }
  db.reactions.push(
    { event_id: db.feed_events[0].id, user_id: mates[1].id, emoji: '🔥' },
    { event_id: db.feed_events[0].id, user_id: mates[2].id, emoji: '🔥' },
    { event_id: db.feed_events[1].id, user_id: mates[0].id, emoji: '👏' }
  )

  // Duelo activo entre dos del squad, para que la pestaña tenga contenido
  const ends = new Date()
  ends.setDate(ends.getDate() + 5)
  db.duels.push({
    id: uuid(), challenger_id: mates[0].id, opponent_id: mates[1].id,
    metric: 'volumen_total', muscle: null, starts_on: dayOffset(9),
    ends_on: `${ends.getFullYear()}-${String(ends.getMonth() + 1).padStart(2, '0')}-${String(ends.getDate()).padStart(2, '0')}`,
    status: 'activo', winner_id: null, created_at: new Date().toISOString(),
  })

  return db
}

// Genera 6 semanas de historial de prueba para el usuario actual, para poder
// evaluar graficas, calendario, racha y rankings sin esperar semanas de uso.
export function seedCurrentUserHistory(userId) {
  const db = getDB()
  const plan = [
    { day: 'Push', names: ['Press banca con barra', 'Press de hombros con mancuernas', 'Elevaciones laterales'] },
    { day: 'Pull', names: ['Dominadas', 'Remo con barra', 'Curl con barra'] },
    { day: 'Legs', names: ['Sentadilla con barra', 'Prensa de pierna', 'Peso muerto rumano'] },
  ]
  const exByName = Object.fromEntries(db.exercises.map((e) => [e.name, e]))
  const existing = new Set(db.sessions.filter((s) => s.user_id === userId).map((s) => s.date))

  for (let d = 42; d >= 0; d--) {
    const date = dayOffset(d)
    if (existing.has(date)) continue
    // Se deja hoy siempre, para que los anillos de la semana muestren datos
    if (d > 0 && (d % 7 === 0 || d % 7 === 4)) continue
    const p = plan[d % plan.length]
    const session = {
      id: uuid(), user_id: userId, date, day_name: p.day, partner_id: null,
      mood: 3 + (d % 3), sleep_quality: 3 + (d % 2), note: null, created_at: new Date().toISOString(),
    }
    db.sessions.push(session)
    for (const name of p.names) {
      const ex = exByName[name]
      if (!ex) continue
      const base = Math.round(100 + (42 - d) * 1.1 + (name.length % 6) * 7)
      for (let s = 0; s < 3; s++) {
        db.sets.push({
          id: uuid(), session_id: session.id, exercise_id: ex.id,
          weight: base + s * 5, unit: 'lb', reps: 10 - s, rpe: 7 + s * 0.5,
          note: null, is_pr: false, created_at: new Date().toISOString(),
        })
      }
    }
  }

  const routes = ['Malecón 5K', 'Parque Mirador']
  for (let d = 40; d >= 0; d -= 5) {
    const km = Number((5 + (d % 4) * 1.3).toFixed(1))
    const sec = Math.round(km * (360 - (40 - d) * 1.4))
    db.runs.push({
      id: uuid(), user_id: userId, date: dayOffset(d), activity: 'correr',
      distance_km: km, duration_seconds: sec, avg_pace_seconds: Math.round(sec / km),
      elevation_m: null, note: null, route_name: routes[d % routes.length],
      is_race: false, created_at: new Date().toISOString(),
    })
  }

  db.body_logs.push(
    { id: uuid(), user_id: userId, date: dayOffset(40), weight: 188, arm_cm: 36, waist_cm: 88, chest_cm: 104, photo_url: null },
    { id: uuid(), user_id: userId, date: dayOffset(20), weight: 191, arm_cm: 37, waist_cm: 87, chest_cm: 106, photo_url: null },
    { id: uuid(), user_id: userId, date: dayOffset(3), weight: 193, arm_cm: 37.5, waist_cm: 86, chest_cm: 107, photo_url: null }
  )

  markPRs(db)
  persist()
}

// Marca is_pr igual que el trigger de Postgres: la serie mas pesada
// hasta ese momento por usuario y ejercicio.
function markPRs(db) {
  const sessionById = Object.fromEntries(db.sessions.map((s) => [s.id, s]))
  const ordered = db.sets.slice().sort((a, b) => {
    const da = sessionById[a.session_id]?.date || ''
    const dbb = sessionById[b.session_id]?.date || ''
    return da.localeCompare(dbb)
  })
  const best = {}
  for (const st of ordered) {
    const s = sessionById[st.session_id]
    if (!s) continue
    const kg = st.unit === 'lb' ? st.weight * 0.45359237 : st.weight
    const key = `${s.user_id}|${st.exercise_id}`
    if (best[key] == null || kg > best[key]) {
      best[key] = kg
      st.is_pr = true
    }
  }
}
