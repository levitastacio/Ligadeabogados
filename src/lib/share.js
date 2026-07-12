// Tarjeta compartible (canvas nativo) y compartir por WhatsApp / Web Share API

export function shareWhatsAppText(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

export async function shareCard({ title, lines, accent = '#0A84FF', fileName = 'gym-squad.png' }) {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0d0d1a')
  grad.addColorStop(1, '#16162e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(W - 120, 140, 300, 0, Math.PI * 2)
  ctx.globalAlpha = 0.12
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = accent
  ctx.font = 'bold 52px -apple-system, sans-serif'
  ctx.fillText('GYM SQUAD', 80, 140)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 84px -apple-system, sans-serif'
  wrapText(ctx, title, 80, 300, W - 160, 96)

  ctx.font = '600 56px -apple-system, sans-serif'
  let y = 560
  for (const line of lines) {
    if (line.big) {
      ctx.fillStyle = accent
      ctx.font = 'bold 120px -apple-system, sans-serif'
      ctx.fillText(line.value, 80, y + 40)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '600 44px -apple-system, sans-serif'
      ctx.fillText(line.label, 80, y + 105)
      y += 220
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 52px -apple-system, sans-serif'
      ctx.fillText(line.value, 80, y)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '500 38px -apple-system, sans-serif'
      ctx.fillText(line.label, 80, y + 52)
      y += 150
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '500 36px -apple-system, sans-serif'
  ctx.fillText(new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }), 80, H - 90)

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  const file = new File([blob], fileName, { type: 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Gym Squad' })
      return true
    } catch {
      return false
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  return true
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, y)
}
