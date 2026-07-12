export const GOALS = {
  masa: { label: 'Masa muscular', color: '#0A84FF', emoji: '💪', desc: 'Ganar músculo y tamaño' },
  grasa: { label: 'Bajar grasa', color: '#30D158', emoji: '🔥', desc: 'Definir y perder grasa' },
  fuerza: { label: 'Fuerza', color: '#FF453A', emoji: '🏋️', desc: 'Levantar más pesado' },
  resistencia: { label: 'Resistencia', color: '#40C8E0', emoji: '🏃', desc: 'Correr más y mejor' },
  recomposicion: { label: 'Recomposición', color: '#BF5AF2', emoji: '⚖️', desc: 'Perder grasa y ganar músculo' },
}

export const MUSCLES = ['pecho', 'espalda', 'pierna', 'hombro', 'biceps', 'triceps', 'abdomen', 'cardio']

export const MUSCLE_LABELS = {
  pecho: 'Pecho', espalda: 'Espalda', pierna: 'Pierna', hombro: 'Hombro',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdomen', cardio: 'Cardio',
}

export const ACTIVITIES = {
  correr: { label: 'Correr', emoji: '🏃' },
  bici: { label: 'Bici', emoji: '🚴' },
  caminata: { label: 'Caminata', emoji: '🚶' },
  basquet: { label: 'Básquet', emoji: '🏀' },
  otro: { label: 'Otro', emoji: '⚡' },
}

export const LB_TO_KG = 0.45359237

export function toKg(weight, unit) {
  return unit === 'lb' ? weight * LB_TO_KG : weight
}

export function fromKg(kg, unit) {
  return unit === 'lb' ? kg / LB_TO_KG : kg
}

export function fmtWeight(w, unit) {
  if (w == null) return ''
  return `${Number(w) % 1 === 0 ? Number(w) : Number(w).toFixed(1)} ${unit}`
}

export function fmtVolume(kg, unit = 'lb') {
  const v = unit === 'lb' ? kg / LB_TO_KG : kg
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k ${unit}`
  return `${Math.round(v)} ${unit}`
}

export function fmtDate(d, opts = { day: 'numeric', month: 'short' }) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d
  return date.toLocaleDateString('es-DO', opts)
}

export function fmtDateLong(d) {
  return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function prevMonthStr(m = monthStr()) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return monthStr(d)
}

export function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

export function weekRange(d = new Date()) {
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const from = new Date(d)
  from.setDate(d.getDate() - diff)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { from: f(from), to: f(to) }
}

export function monthRange(m = monthStr()) {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` }
}

// Color deterministico derivado del user id (para avatares con iniciales)
const AVATAR_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#40C8E0', '#FF375F', '#64D2FF', '#FFD60A', '#AC8E68']

export function avatarColor(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

export function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Racha: dias consecutivos activos terminando hoy o ayer
export function currentStreak(dates, pardonMonth) {
  const set = new Set(dates)
  if (set.size === 0) return 0
  const d = new Date()
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (!set.has(key(d))) d.setDate(d.getDate() - 1)
  if (!set.has(key(d))) return 0
  let streak = 0
  let pardonAvailable = Boolean(pardonMonth)
  while (true) {
    if (set.has(key(d))) {
      streak++
    } else if (pardonAvailable) {
      pardonAvailable = false
    } else {
      break
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// 1RM estimado con formula de Epley
export function epley1RM(weight, reps) {
  if (!weight || !reps) return 0
  return weight * (1 + reps / 30)
}

export function restSecondsForGoal(goal) {
  switch (goal) {
    case 'grasa': return 45
    case 'fuerza': return 180
    case 'resistencia': return 60
    default: return 90
  }
}

export function fmtDuration(totalSeconds) {
  if (totalSeconds == null) return ''
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtTons(kg) {
  return `${(kg / 1000).toLocaleString('es-DO', { maximumFractionDigits: 1 })} toneladas`
}
