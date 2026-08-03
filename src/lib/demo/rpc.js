// Funciones del modo demo equivalentes a las funciones security definer
// del esquema SQL (rankings, totales, rutas, duelos, medallas).
import { getDB, persist, uuid } from './db'

const LB_TO_KG = 0.45359237

function kgOf(set) {
  return (set.unit === 'lb' ? set.weight * LB_TO_KG : set.weight) * set.reps
}

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

function prevMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function memberIds(db, groupId) {
  return db.group_members.filter((m) => m.group_id === groupId).map((m) => m.user_id)
}

function userSets(db, userId, from, to) {
  const sessions = db.sessions.filter((s) => s.user_id === userId && s.date >= from && s.date <= to)
  const ids = new Set(sessions.map((s) => s.id))
  return { sessions, sets: db.sets.filter((st) => ids.has(st.session_id)) }
}

function activeDays(db, userId, from, to) {
  const days = new Set()
  db.sessions.forEach((s) => { if (s.user_id === userId && s.date >= from && s.date <= to) days.add(s.date) })
  db.runs.forEach((r) => { if (r.user_id === userId && r.date >= from && r.date <= to) days.add(r.date) })
  return days
}

function rankingRange(db, groupId, from, to) {
  return memberIds(db, groupId).map((id) => {
    const profile = db.profiles.find((p) => p.id === id) || { display_name: 'Usuario', avatar_url: null }
    const { sets } = userSets(db, id, from, to)
    const runs = db.runs.filter(
      (r) => r.user_id === id && r.date >= from && r.date <= to && ['correr', 'caminata', 'bici'].includes(r.activity)
    )
    const paces = runs.filter((r) => r.distance_km >= 5 && r.avg_pace_seconds).map((r) => r.avg_pace_seconds)
    return {
      user_id: id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      volume_kg: sets.reduce((a, s) => a + kgOf(s), 0),
      days: activeDays(db, id, from, to).size,
      km: runs.reduce((a, r) => a + Number(r.distance_km || 0), 0),
      prs_count: sets.filter((s) => s.is_pr).length,
      best_pace: paces.length ? Math.min(...paces) : null,
      activities: runs.length,
    }
  })
}

function duelValue(db, userId, metric, muscle, from, to) {
  if (metric === 'volumen_total') {
    return userSets(db, userId, from, to).sets.reduce((a, s) => a + kgOf(s), 0)
  }
  if (metric === 'volumen_musculo') {
    const { sets } = userSets(db, userId, from, to)
    return sets.reduce((a, s) => {
      const ex = db.exercises.find((e) => e.id === s.exercise_id)
      return ex && ex.muscle === muscle ? a + kgOf(s) : a
    }, 0)
  }
  if (metric === 'dias') return activeDays(db, userId, from, to).size
  if (metric === 'km') {
    return db.runs
      .filter((r) => r.user_id === userId && r.date >= from && r.date <= to && ['correr', 'caminata', 'bici'].includes(r.activity))
      .reduce((a, r) => a + Number(r.distance_km || 0), 0)
  }
  return 0
}

function topThree(list, valueKey, ascending = false) {
  return list
    .filter((x) => x[valueKey] != null && (ascending || x[valueKey] > 0))
    .sort((a, b) => (ascending ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey]))
    .slice(0, 3)
}

function awardMonthlyMedals(db, month) {
  const prev = prevMonth(month)
  const { from, to } = monthBounds(month)
  const pb = monthBounds(prev)

  const exists = (userId, groupId, code) =>
    db.medals.some((m) => m.user_id === userId && m.month === month && m.code === code && (m.group_id || null) === (groupId || null))

  const add = (userId, groupId, code, rank, value) => {
    if (exists(userId, groupId, code)) return
    db.medals.push({ id: uuid(), user_id: userId, group_id: groupId, month, code, rank, value, awarded_at: new Date().toISOString() })
    if (groupId && rank === 1) {
      db.feed_events.push({
        id: uuid(), user_id: userId, group_id: groupId, type: 'medalla',
        payload: { code, rank, value, month }, created_at: new Date().toISOString(),
      })
    }
  }

  // Medallas de competencia por grupo
  for (const group of db.groups) {
    const rows = rankingRange(db, group.id, from, to)
    topThree(rows, 'volume_kg').forEach((r, i) => add(r.user_id, group.id, 'vol', i + 1, r.volume_kg))
    topThree(rows, 'days').forEach((r, i) => add(r.user_id, group.id, 'dias', i + 1, r.days))
    topThree(rows, 'prs_count').forEach((r, i) => add(r.user_id, group.id, 'prs', i + 1, r.prs_count))
    topThree(rows, 'km').forEach((r, i) => add(r.user_id, group.id, 'km', i + 1, r.km))
    topThree(rows.filter((r) => r.best_pace), 'best_pace', true).forEach((r, i) => add(r.user_id, group.id, 'pace', i + 1, r.best_pace))
    const rel = rows
      .map((r) => {
        const p = db.profiles.find((x) => x.id === r.user_id)
        if (!p?.body_weight || r.volume_kg <= 0) return null
        const bw = p.unit === 'lb' ? p.body_weight * LB_TO_KG : p.body_weight
        return { user_id: r.user_id, relativo: r.volume_kg / bw }
      })
      .filter(Boolean)
    topThree(rel, 'relativo').forEach((r, i) => add(r.user_id, group.id, 'relativo', i + 1, Math.round(r.relativo * 10) / 10))
  }

  // Medallas de superacion personal
  for (const p of db.profiles) {
    const cur = userSets(db, p.id, from, to)
    const old = userSets(db, p.id, pb.from, pb.to)
    const curVol = cur.sets.reduce((a, s) => a + kgOf(s), 0)
    const oldVol = old.sets.reduce((a, s) => a + kgOf(s), 0)
    const curDays = activeDays(db, p.id, from, to)
    const oldDays = activeDays(db, p.id, pb.from, pb.to)
    const curPRs = cur.sets.filter((s) => s.is_pr).length

    const kmIn = (f, t) => db.runs.filter((r) => r.user_id === p.id && r.date >= f && r.date <= t).reduce((a, r) => a + Number(r.distance_km || 0), 0)
    const paceIn = (f, t) => {
      const list = db.runs.filter((r) => r.user_id === p.id && r.date >= f && r.date <= t && r.distance_km >= 1 && r.avg_pace_seconds).map((r) => r.avg_pace_seconds)
      return list.length ? Math.min(...list) : null
    }

    if (oldVol > 0 && curVol > oldVol) add(p.id, null, 'mejor_mes', null, curVol)
    if (curDays.size > oldDays.size && oldDays.size > 0) add(p.id, null, 'mas_constante', null, curDays.size)
    if (curPRs >= 3) add(p.id, null, 'superacion_prs', null, curPRs)

    const goal = db.monthly_goals.find((g) => g.user_id === p.id && g.month === month)
    const target = goal?.target_days || p.monthly_target || 0
    if (target > 0 && curDays.size >= Math.ceil(target * 0.9)) add(p.id, null, 'cumplidor', null, curDays.size)

    const curKm = kmIn(from, to)
    const oldKm = kmIn(pb.from, pb.to)
    if (oldKm > 0 && curKm > oldKm) add(p.id, null, 'corredor', null, curKm)

    const curPace = paceIn(from, to)
    const oldPace = paceIn(pb.from, pb.to)
    if (curPace && oldPace && curPace < oldPace) add(p.id, null, 'pace_propio', null, curPace)

    // Racha mas larga dentro del mes
    const sorted = [...curDays].sort()
    let best = 0
    let run = 0
    let prevDate = null
    for (const d of sorted) {
      const dt = new Date(d + 'T12:00:00')
      run = prevDate && (dt - prevDate) / 86400000 === 1 ? run + 1 : 1
      best = Math.max(best, run)
      prevDate = dt
    }
    if (best >= 14) add(p.id, null, 'racha', null, best)
  }

  persist()
  return null
}

export function runRPC(name, args = {}, currentUserId = null) {
  const db = getDB()
  switch (name) {
    case 'username_available':
      return { data: !db.profiles.some((p) => p.username?.toLowerCase() === String(args.p_username).toLowerCase()), error: null }

    case 'get_group_ranking': {
      const { from, to } = monthBounds(args.p_month)
      return { data: rankingRange(db, args.p_group_id, from, to), error: null }
    }

    case 'get_group_ranking_range':
      return { data: rankingRange(db, args.p_group_id, args.p_from, args.p_to), error: null }

    case 'get_group_totals': {
      const { from, to } = monthBounds(args.p_month)
      const rows = rankingRange(db, args.p_group_id, from, to)
      return {
        data: [{
          volume_kg: rows.reduce((a, r) => a + r.volume_kg, 0),
          km: rows.reduce((a, r) => a + r.km, 0),
          days: rows.reduce((a, r) => a + r.days, 0),
          prs: rows.reduce((a, r) => a + r.prs_count, 0),
        }],
        error: null,
      }
    }

    case 'get_group_routes': {
      const ids = new Set(memberIds(db, args.p_group_id))
      const byRoute = {}
      for (const r of db.runs) {
        if (!ids.has(r.user_id) || !r.route_name?.trim()) continue
        const key = r.route_name.trim().toLowerCase()
        byRoute[key] = byRoute[key] || { route_name: r.route_name.trim(), runs_count: 0, runners: new Set() }
        byRoute[key].runs_count++
        byRoute[key].runners.add(r.user_id)
      }
      const data = Object.values(byRoute)
        .map((r) => ({ route_name: r.route_name, runs_count: r.runs_count, runners: r.runners.size }))
        .sort((a, b) => b.runs_count - a.runs_count)
      return { data, error: null }
    }

    case 'get_route_leaderboard': {
      const ids = new Set(memberIds(db, args.p_group_id))
      const target = String(args.p_route).trim().toLowerCase()
      const bestByUser = {}
      for (const r of db.runs) {
        if (!ids.has(r.user_id) || r.route_name?.trim().toLowerCase() !== target) continue
        const cur = bestByUser[r.user_id]
        if (!cur || r.duration_seconds < cur.best_seconds) {
          const p = db.profiles.find((x) => x.id === r.user_id) || {}
          bestByUser[r.user_id] = {
            user_id: r.user_id, display_name: p.display_name || 'Usuario', avatar_url: p.avatar_url || null,
            best_seconds: r.duration_seconds, distance_km: r.distance_km, best_pace: r.avg_pace_seconds, run_date: r.date,
          }
        }
      }
      return { data: Object.values(bestByUser).sort((a, b) => a.best_seconds - b.best_seconds), error: null }
    }

    case 'get_duel_progress': {
      const d = db.duels.find((x) => x.id === args.p_duel_id)
      if (!d) return { data: null, error: { message: 'Duelo no encontrado' } }
      return {
        data: [{
          challenger_value: duelValue(db, d.challenger_id, d.metric, d.muscle, d.starts_on, d.ends_on),
          opponent_value: duelValue(db, d.opponent_id, d.metric, d.muscle, d.starts_on, d.ends_on),
        }],
        error: null,
      }
    }

    case 'award_monthly_medals':
      awardMonthlyMedals(db, args.p_month)
      return { data: null, error: null }

    default:
      return { data: null, error: { message: `Función ${name} no disponible en modo demo` } }
  }
}
