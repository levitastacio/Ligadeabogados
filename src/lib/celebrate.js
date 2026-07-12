import confetti from 'canvas-confetti'

export function vibrate(pattern = 30) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

export function celebratePR() {
  vibrate([40, 60, 80])
  confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.65 },
    colors: ['#FFD60A', '#FF9F0A', '#0A84FF', '#30D158', '#BF5AF2'],
  })
}

export function celebrateBig() {
  vibrate([50, 80, 50, 80, 120])
  const end = Date.now() + 1200
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 } })
    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 } })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
