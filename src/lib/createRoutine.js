import { supabase } from './supabase'
import { NAME_FALLBACKS } from './templates'

function normalize(name) {
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

// Crea una rutina completa (dias + ejercicios) a partir de una plantilla,
// mapeando nombres de ejercicios a la biblioteca precargada.
export async function createRoutineFromTemplate(template, userId, makeActive = true) {
  const { data: allExercises, error: exErr } = await supabase.from('exercises').select('id, name')
  if (exErr) throw exErr
  const byName = new Map((allExercises || []).map((e) => [normalize(e.name), e.id]))

  const { data: routine, error: rErr } = await supabase
    .from('routines')
    .insert({ user_id: userId, name: template.name, is_active: makeActive })
    .select()
    .single()
  if (rErr) throw rErr

  if (makeActive) {
    await supabase.from('routines').update({ is_active: false }).eq('user_id', userId).neq('id', routine.id)
  }

  for (let d = 0; d < template.days.length; d++) {
    const day = template.days[d]
    const { data: dayRow, error: dErr } = await supabase
      .from('routine_days')
      .insert({
        routine_id: routine.id,
        name: day.name,
        emoji: day.emoji,
        color: day.color,
        muscles: day.muscles,
        sort_order: d,
      })
      .select()
      .single()
    if (dErr) throw dErr

    const rows = []
    for (let i = 0; i < day.exercises.length; i++) {
      const [rawName, cfg] = day.exercises[i]
      const name = NAME_FALLBACKS[rawName] || rawName
      const exerciseId = byName.get(normalize(name))
      if (!exerciseId) continue
      rows.push({
        day_id: dayRow.id,
        exercise_id: exerciseId,
        target_sets: cfg.sets,
        target_reps: cfg.reps,
        rest_seconds: cfg.rest,
        sort_order: i,
      })
    }
    if (rows.length) {
      const { error: eErr } = await supabase.from('routine_day_exercises').insert(rows)
      if (eErr) throw eErr
    }
  }

  return routine
}
