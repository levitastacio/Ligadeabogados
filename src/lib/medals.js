// Catalogo de medallas: metadata visual para renderizar
export const MEDAL_CATALOG = {
  vol: { name: 'Rey del volumen', emoji: '👑', type: 'grupo', desc: 'Mayor volumen total del mes' },
  dias: { name: 'El más constante', emoji: '📅', type: 'grupo', desc: 'Más días entrenados' },
  prs: { name: 'Rompe-récords', emoji: '💥', type: 'grupo', desc: 'Más récords personales rotos' },
  km: { name: 'Rey de la ruta', emoji: '🛣️', type: 'grupo', desc: 'Más kilómetros corridos' },
  pace: { name: 'El más rápido', emoji: '⚡', type: 'grupo', desc: 'Mejor pace en carreras de 5km o más' },
  relativo: { name: 'Fuerza relativa', emoji: '🦍', type: 'grupo', desc: 'Mayor volumen por peso corporal' },
  mejor_mes: { name: 'Mejor mes', emoji: '📈', type: 'personal', desc: 'Superaste tu volumen del mes anterior' },
  mas_constante: { name: 'Más constante', emoji: '🗓️', type: 'personal', desc: 'Entrenaste más días que el mes pasado' },
  superacion_prs: { name: 'Superación', emoji: '🚀', type: 'personal', desc: 'Mejoraste 3 o más marcas personales' },
  cumplidor: { name: 'Cumplidor', emoji: '✅', type: 'personal', desc: 'Completaste 90% o más de tu meta mensual' },
  corredor: { name: 'Corredor en ascenso', emoji: '🏃‍♂️', type: 'personal', desc: 'Corriste más km que el mes anterior' },
  pace_propio: { name: 'Contra el reloj', emoji: '⏱️', type: 'personal', desc: 'Mejoraste tu mejor pace del mes anterior' },
  racha: { name: 'Racha de hierro', emoji: '🔥', type: 'personal', desc: 'Racha de 14 o más días sin fallar' },
}

export const RANK_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function medalInfo(code) {
  return MEDAL_CATALOG[code] || { name: code, emoji: '🏅', type: 'personal', desc: '' }
}
