import { useEffect, useState } from 'react'
import { onPendingChange } from '../../lib/offline'

export default function OfflineIndicator() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const off = onPendingChange(setPending)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      off()
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online && pending === 0) return null
  return (
    <div className="offline-pill">
      {!online && pending === 0 && 'Sin conexión, guardando local'}
      {pending > 0 && `${pending} ${pending === 1 ? 'registro pendiente' : 'registros pendientes'} de sincronizar`}
    </div>
  )
}
