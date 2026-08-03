// Constructor de consultas del modo demo: imita la API de postgrest-js
// (select con relaciones anidadas, filtros, order, limit, single) sobre la
// base local. Solo cubre lo que la app usa realmente.
import { getDB, persist, uuid } from './db'

// Relaciones para resolver los select anidados, equivalentes a las
// foreign keys del esquema SQL.
const RELATIONS = {
  sessions: { sets: { table: 'sets', type: 'many', fk: 'session_id' } },
  sets: {
    sessions: { table: 'sessions', type: 'one', fk: 'session_id' },
    exercises: { table: 'exercises', type: 'one', fk: 'exercise_id' },
  },
  routines: { routine_days: { table: 'routine_days', type: 'many', fk: 'routine_id' } },
  routine_days: { routine_day_exercises: { table: 'routine_day_exercises', type: 'many', fk: 'day_id' } },
  routine_day_exercises: { exercises: { table: 'exercises', type: 'one', fk: 'exercise_id' } },
  group_members: {
    groups: { table: 'groups', type: 'one', fk: 'group_id' },
    profiles: { table: 'profiles', type: 'one', fk: 'user_id' },
  },
  feed_events: {
    profiles: { table: 'profiles', type: 'one', fk: 'user_id' },
    reactions: { table: 'reactions', type: 'many', fk: 'event_id' },
  },
  medals: { profiles: { table: 'profiles', type: 'one', fk: 'user_id' } },
}

// Claves primarias compuestas, para detectar duplicados como en Postgres
const COMPOSITE_KEYS = {
  group_members: ['group_id', 'user_id'],
  reactions: ['event_id', 'user_id'],
  monthly_goals: ['user_id', 'month'],
}

const LB_TO_KG = 0.45359237

// Divide por comas respetando parentesis: "a, b(c, d), e" -> ["a","b(c, d)","e"]
function splitTop(str) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// Extrae las relaciones pedidas en un select: "*, sets(id)" -> [{name:'sets', inner:false, sub:'id'}]
function parseEmbeds(select) {
  if (!select || select === '*') return []
  return splitTop(select)
    .filter((part) => part.includes('('))
    .map((part) => {
      const open = part.indexOf('(')
      const head = part.slice(0, open)
      const sub = part.slice(open + 1, part.lastIndexOf(')'))
      const inner = head.includes('!inner')
      return { name: head.replace('!inner', '').trim(), inner, sub }
    })
}

function compare(value, op, target) {
  if (op === 'eq') return String(value) === String(target)
  if (op === 'neq') return String(value) !== String(target)
  if (op === 'gte') return value != null && value >= target
  if (op === 'lte') return value != null && value <= target
  if (op === 'gt') return value != null && value > target
  if (op === 'lt') return value != null && value < target
  if (op === 'in') return target.some((t) => String(t) === String(value))
  if (op === 'is') return target === null ? value == null : value === target
  if (op === 'not_is') return target === null ? value != null : value !== target
  return true
}

export class DemoQuery {
  constructor(table) {
    this.table = table
    this._filters = []
    this._select = null
    this._order = null
    this._limit = null
    this._single = null
    this._op = 'select'
    this._payload = null
  }

  select(cols = '*') {
    this._select = cols
    if (this._op === 'select') this._op = 'select'
    return this
  }

  insert(rows) {
    this._op = 'insert'
    this._payload = Array.isArray(rows) ? rows : [rows]
    return this
  }

  upsert(rows) {
    this._op = 'upsert'
    this._payload = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(values) {
    this._op = 'update'
    this._payload = values
    return this
  }

  delete() {
    this._op = 'delete'
    return this
  }

  eq(col, val) { this._filters.push({ col, op: 'eq', val }); return this }
  neq(col, val) { this._filters.push({ col, op: 'neq', val }); return this }
  gte(col, val) { this._filters.push({ col, op: 'gte', val }); return this }
  lte(col, val) { this._filters.push({ col, op: 'lte', val }); return this }
  in(col, vals) { this._filters.push({ col, op: 'in', val: vals }); return this }
  not(col, op, val) { this._filters.push({ col, op: op === 'is' ? 'not_is' : `not_${op}`, val }); return this }

  // Soporta "a.in.(1,2),b.eq.3" como en postgrest
  or(expr) {
    const parts = splitTop(expr)
    const clauses = parts.map((p) => {
      const [col, op, ...rest] = p.split('.')
      let raw = rest.join('.')
      if (op === 'in') {
        const list = raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.trim()).filter(Boolean)
        return { col, op: 'in', val: list }
      }
      if (raw === 'null') raw = null
      return { col, op, val: raw }
    })
    this._filters.push({ or: clauses })
    return this
  }

  order(col, opts = {}) {
    this._order = { col, ascending: opts.ascending !== false }
    return this
  }

  limit(n) { this._limit = n; return this }
  single() { this._single = 'strict'; return this }
  maybeSingle() { this._single = 'maybe'; return this }

  then(resolve, reject) {
    let result
    try {
      result = this._run()
    } catch (err) {
      result = { data: null, error: { message: err.message } }
    }
    return Promise.resolve(result).then(resolve, reject)
  }

  // ---------- ejecucion ----------

  _run() {
    const db = getDB()
    if (!db[this.table]) db[this.table] = []

    if (this._op === 'insert' || this._op === 'upsert') return this._runInsert(db)
    if (this._op === 'update') return this._runUpdate(db)
    if (this._op === 'delete') return this._runDelete(db)
    return this._runSelect(db)
  }

  _matches(row, filter) {
    if (filter.or) return filter.or.some((c) => this._matches(row, c))
    const { col, op, val } = filter
    const realOp = op.startsWith('not_') && op !== 'not_is' ? op.slice(4) : op
    const negate = op.startsWith('not_') && op !== 'not_is'
    let value
    if (col.includes('.')) {
      const [rel, field] = col.split('.')
      const embedded = row[rel]
      if (Array.isArray(embedded)) return embedded.some((e) => compare(e?.[field], realOp, val))
      value = embedded?.[field]
    } else {
      value = row[col]
    }
    const res = compare(value, op === 'not_is' ? 'not_is' : realOp, val)
    return negate ? !res : res
  }

  _embed(db, rows) {
    const embeds = parseEmbeds(this._select)
    if (!embeds.length) return rows
    const rels = RELATIONS[this.table] || {}
    return rows.map((row) => {
      const copy = { ...row }
      for (const emb of embeds) {
        const rel = rels[emb.name]
        if (!rel) continue
        if (rel.type === 'many') {
          const children = (db[rel.table] || []).filter((c) => c[rel.fk] === row.id)
          copy[emb.name] = children.map((c) => this._embedNested(db, rel.table, c, emb.sub))
        } else {
          const parent = (db[rel.table] || []).find((p) => p.id === row[rel.fk]) || null
          copy[emb.name] = parent ? this._embedNested(db, rel.table, parent, emb.sub) : null
        }
      }
      return copy
    })
  }

  // Resuelve un nivel mas de anidacion, por ejemplo routine_days(routine_day_exercises(exercises(*)))
  _embedNested(db, table, row, sub) {
    const embeds = parseEmbeds(sub)
    if (!embeds.length) return { ...row }
    const rels = RELATIONS[table] || {}
    const copy = { ...row }
    for (const emb of embeds) {
      const rel = rels[emb.name]
      if (!rel) continue
      if (rel.type === 'many') {
        const children = (db[rel.table] || []).filter((c) => c[rel.fk] === row.id)
        copy[emb.name] = children.map((c) => this._embedNested(db, rel.table, c, emb.sub))
      } else {
        const parent = (db[rel.table] || []).find((p) => p.id === row[rel.fk]) || null
        copy[emb.name] = parent ? this._embedNested(db, rel.table, parent, emb.sub) : null
      }
    }
    return copy
  }

  _shape(rows) {
    if (this._single === 'strict') {
      if (!rows.length) return { data: null, error: { message: 'No rows found' } }
      return { data: rows[0], error: null }
    }
    if (this._single === 'maybe') return { data: rows[0] || null, error: null }
    return { data: rows, error: null }
  }

  _runSelect(db) {
    let rows = this._embed(db, db[this.table])
    for (const f of this._filters) rows = rows.filter((r) => this._matches(r, f))
    // Los embeds !inner descartan filas sin relacion
    for (const emb of parseEmbeds(this._select)) {
      if (emb.inner) rows = rows.filter((r) => r[emb.name] != null && (!Array.isArray(r[emb.name]) || r[emb.name].length))
    }
    if (this._order) {
      const { col, ascending } = this._order
      rows = rows.slice().sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av === bv) return 0
        const cmp = av == null ? -1 : bv == null ? 1 : av > bv ? 1 : -1
        return ascending ? cmp : -cmp
      })
    }
    if (this._limit != null) rows = rows.slice(0, this._limit)
    return this._shape(rows)
  }

  _defaults(row) {
    const now = new Date().toISOString()
    const withId = { id: row.id || uuid(), ...row }
    switch (this.table) {
      case 'sets':
        return { unit: 'lb', rpe: null, note: null, is_pr: false, created_at: now, ...withId }
      case 'sessions':
        return { date: now.slice(0, 10), day_name: null, partner_id: null, mood: null, sleep_quality: null, note: null, created_at: now, ...withId }
      case 'runs':
        return { date: now.slice(0, 10), activity: 'correr', distance_km: null, avg_pace_seconds: null, elevation_m: null, note: null, route_name: null, is_race: false, created_at: now, ...withId }
      case 'group_members':
        return { joined_at: now, ...row }
      case 'reactions':
        return { emoji: '🔥', ...row }
      case 'monthly_goals':
        return { target_km: null, ...row }
      case 'medals':
        return { awarded_at: now, ...withId }
      case 'duels':
        return { status: 'pendiente', winner_id: null, muscle: null, created_at: now, ...withId }
      case 'feed_events':
        return { payload: {}, created_at: now, ...withId }
      case 'routine_days':
        return { emoji: '💪', color: '#0A84FF', muscles: [], sort_order: 0, ...withId }
      case 'routine_day_exercises':
        return { target_sets: 3, target_reps: '8-12', rest_seconds: 90, sort_order: 0, ...withId }
      case 'routines':
        return { is_active: false, created_at: now, ...withId }
      case 'exercises':
        return { is_global: true, video_url: null, created_at: now, ...withId }
      case 'profiles':
        return { avatar_url: null, body_weight: null, unit: 'lb', weekly_target: 4, monthly_target: 16, streak_pardon_used_month: null, created_at: now, ...row }
      case 'body_logs':
        return { date: now.slice(0, 10), weight: null, arm_cm: null, waist_cm: null, chest_cm: null, photo_url: null, ...withId }
      default:
        return withId
    }
  }

  // Replica el trigger detect_pr del esquema SQL
  _applySetTrigger(db, row) {
    const session = db.sessions.find((s) => s.id === row.session_id)
    if (!session) return row
    const kg = row.unit === 'lb' ? row.weight * LB_TO_KG : row.weight
    let max = null
    for (const st of db.sets) {
      if (st.exercise_id !== row.exercise_id || st.id === row.id) continue
      const s = db.sessions.find((x) => x.id === st.session_id)
      if (!s || s.user_id !== session.user_id) continue
      const k = st.unit === 'lb' ? st.weight * LB_TO_KG : st.weight
      if (max == null || k > max) max = k
    }
    return { ...row, is_pr: max == null || kg > max }
  }

  // Replica el trigger compute_pace
  _applyRunTrigger(row) {
    if (row.distance_km > 0 && row.avg_pace_seconds == null) {
      return { ...row, avg_pace_seconds: Math.round(row.duration_seconds / row.distance_km) }
    }
    return row
  }

  _duplicateOf(db, row) {
    const keys = COMPOSITE_KEYS[this.table]
    if (!keys) return null
    return db[this.table].find((r) => keys.every((k) => String(r[k]) === String(row[k]))) || null
  }

  _runInsert(db) {
    const inserted = []
    for (const raw of this._payload) {
      let row = this._defaults(raw)
      const dup = this._duplicateOf(db, row)
      if (dup) {
        if (this._op === 'upsert') {
          Object.assign(dup, raw)
          inserted.push(dup)
          continue
        }
        return { data: null, error: { message: 'duplicate key value violates unique constraint' } }
      }
      if (this.table === 'profiles' && db.profiles.some((p) => p.username?.toLowerCase() === String(row.username).toLowerCase())) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' } }
      }
      if (this.table === 'sets') row = this._applySetTrigger(db, row)
      if (this.table === 'runs') row = this._applyRunTrigger(row)
      db[this.table].push(row)
      inserted.push(row)
    }
    persist()
    return this._shape(this._select ? this._embed(db, inserted) : inserted)
  }

  _runUpdate(db) {
    const targets = db[this.table].filter((r) => this._filters.every((f) => this._matches(r, f)))
    for (const row of targets) Object.assign(row, this._payload)
    persist()
    return this._shape(this._select ? this._embed(db, targets) : targets)
  }

  _runDelete(db) {
    const keep = []
    const removed = []
    for (const row of db[this.table]) {
      if (this._filters.every((f) => this._matches(row, f))) removed.push(row)
      else keep.push(row)
    }
    db[this.table] = keep
    // Borrado en cascada de las relaciones que la app usa
    const cascade = {
      routines: ['routine_days.routine_id'],
      routine_days: ['routine_day_exercises.day_id'],
      sessions: ['sets.session_id'],
      feed_events: ['reactions.event_id'],
    }[this.table]
    if (cascade) {
      for (const spec of cascade) {
        const [child, fk] = spec.split('.')
        const ids = new Set(removed.map((r) => r.id))
        db[child] = db[child].filter((c) => !ids.has(c[fk]))
      }
    }
    persist()
    return { data: removed, error: null }
  }
}
