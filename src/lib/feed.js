import { supabase } from './supabase'
import { offlineInsert } from './offline'

// Publica un evento en el feed de todos los grupos del usuario
export async function publishToGroups(userId, type, payload) {
  const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', userId)
  const groups = memberships || []
  if (!groups.length) return
  const rows = groups.map((m) => ({ user_id: userId, group_id: m.group_id, type, payload }))
  await offlineInsert('feed_events', rows)
}
