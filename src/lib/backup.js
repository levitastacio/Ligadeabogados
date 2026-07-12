// Exportes CSV/JSON e importador del respaldo de la app vieja (Gym Progress AI)
import { supabase } from './supabase'

function download(content, fileName, mime) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
}

export async function exportAll(userId) {
  const [sessions, sets, runs, bodyLogs, routines] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId),
    supabase.from('sets').select('*, sessions!inner(user_id)').eq('sessions.user_id', userId),
    supabase.from('runs').select('*').eq('user_id', userId),
    supabase.from('body_logs').select('*').eq('user_id', userId),
    supabase.from('routines').select('*, routine_days(*, routine_day_exercises(*))').eq('user_id', userId),
  ])
  return {
    version: 2,
    exported_at: new Date().toISOString(),
    sessions: sessions.data || [],
    sets: sets.data || [],
    runs: runs.data || [],
    body_logs: bodyLogs.data || [],
    routines: routines.data || [],
  }
}

export async function exportJSON(userId) {
  const data = await exportAll(userId)
  download(JSON.stringify(data, null, 2), 'gym-squad-respaldo.json', 'application/json')
}

export async function exportCSV(userId) {
  const data = await exportAll(userId)
  const rows = [['fecha', 'tipo', 'detalle', 'peso', 'unidad', 'reps', 'rpe', 'pr']]
  const sessionById = Object.fromEntries(data.sessions.map((s) => [s.id, s]))
  for (const st of data.sets) {
    const s = sessionById[st.session_id]
    rows.push([s?.date || '', 'serie', st.exercise_id, st.weight, st.unit, st.reps, st.rpe || '', st.is_pr ? 'si' : 'no'])
  }
  for (const r of data.runs) {
    rows.push([r.date, r.activity, r.route_name || '', r.distance_km || '', 'km', '', '', ''])
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  download(csv, 'gym-squad-datos.csv', 'text/csv')
}

// Importa el JSON de Gym Progress AI: {version, sessions[], exercises[], routines[]}
// Cada session vieja: {date, dayName?, sets: [{exercise, weight, reps, rpe?}]}
export async function importLegacyBackup(json, userId, unit = 'lb') {
  const report = { exercisesCreated: 0, sessionsImported: 0, setsImported: 0, errors: [] }

  const { data: existing } = await supabase.from('exercises').select('id, name')
  const byName = new Map((existing || []).map((e) => [e.name.trim().toLowerCase(), e.id]))

  const legacyExercises = json.exercises || []
  const legacySessions = json.sessions || []

  const namesNeeded = new Set()
  for (const ex of legacyExercises) namesNeeded.add((ex.name || ex).toString().trim())
  for (const s of legacySessions) {
    for (const st of s.sets || []) {
      if (st.exercise) namesNeeded.add(String(st.exercise).trim())
    }
  }

  for (const name of namesNeeded) {
    if (!name || byName.has(name.toLowerCase())) continue
    const legacy = legacyExercises.find((e) => (e.name || e).toString().trim() === name)
    const muscle = legacy?.muscle || 'pecho'
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name, muscle, created_by: userId, is_global: false })
      .select('id')
      .single()
    if (error) {
      report.errors.push(`Ejercicio ${name}: ${error.message}`)
      continue
    }
    byName.set(name.toLowerCase(), data.id)
    report.exercisesCreated++
  }

  for (const s of legacySessions) {
    if (!s.date) continue
    const sessionId = crypto.randomUUID()
    const { error: se } = await supabase.from('sessions').insert({
      id: sessionId,
      user_id: userId,
      date: String(s.date).slice(0, 10),
      day_name: s.dayName || s.day_name || null,
      note: s.note || null,
    })
    if (se) {
      report.errors.push(`Sesión ${s.date}: ${se.message}`)
      continue
    }
    report.sessionsImported++
    const setRows = (s.sets || [])
      .filter((st) => st.exercise && st.weight != null && st.reps != null)
      .map((st) => ({
        session_id: sessionId,
        exercise_id: byName.get(String(st.exercise).trim().toLowerCase()),
        weight: Number(st.weight),
        unit: st.unit || unit,
        reps: Number(st.reps),
        rpe: st.rpe != null ? Number(st.rpe) : null,
      }))
      .filter((st) => st.exercise_id)
    if (setRows.length) {
      const { error: te } = await supabase.from('sets').insert(setRows)
      if (te) report.errors.push(`Series ${s.date}: ${te.message}`)
      else report.setsImported += setRows.length
    }
  }

  return report
}
