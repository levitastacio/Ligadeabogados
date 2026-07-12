import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDuration, fmtDate } from '../../lib/utils'
import { fmtPace } from '../../lib/pace'
import Modal from '../common/Modal'
import Avatar from '../common/Avatar'
import Spinner from '../common/Spinner'

// Segmentos simplificados estilo Strava: rutas con nombre y su leaderboard
export default function RoutesSection({ group }) {
  const [routes, setRoutes] = useState(null)
  const [selected, setSelected] = useState(null)
  const [board, setBoard] = useState(null)

  useEffect(() => {
    setRoutes(null)
    supabase.rpc('get_group_routes', { p_group_id: group.id }).then(({ data }) => setRoutes(data || []))
  }, [group.id])

  const open = async (route) => {
    setSelected(route)
    setBoard(null)
    const { data } = await supabase.rpc('get_route_leaderboard', { p_group_id: group.id, p_route: route.route_name })
    setBoard((data || []).sort((a, b) => a.best_seconds - b.best_seconds))
  }

  if (!routes) return <Spinner />

  return (
    <div>
      {routes.length === 0 && (
        <p className="muted center mt">
          Nadie ha corrido rutas con nombre todavía. Ponle nombre a tu ruta al registrar una carrera (por ejemplo "Malecón 5K") y aparecerá aquí con su tabla de tiempos.
        </p>
      )}
      {routes.map((r) => (
        <button
          key={r.route_name}
          className="card row-between"
          style={{ width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          onClick={() => open(r)}
        >
          <div>
            <h3>🗺️ {r.route_name}</h3>
            <p className="tiny">{r.runs_count} actividades · {r.runners} corredores</p>
          </div>
          <span style={{ fontSize: 22, color: 'var(--text-3)' }}>›</span>
        </button>
      ))}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `🗺️ ${selected.route_name}` : ''}>
        {!board ? (
          <Spinner />
        ) : (
          <>
            <p className="muted mb" style={{ fontSize: 13 }}>Mejor tiempo de cada corredor en esta ruta</p>
            {board.map((row, i) => (
              <div key={row.user_id} className="list-item">
                <span style={{ fontSize: 18, width: 26 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                <Avatar profile={{ id: row.user_id, display_name: row.display_name, avatar_url: row.avatar_url }} size={34} />
                <div className="col" style={{ flex: 1, gap: 2 }}>
                  <span className="bold" style={{ fontSize: 15 }}>{row.display_name}</span>
                  <span className="tiny">{fmtDate(row.run_date)} · {Number(row.distance_km).toFixed(1)} km</span>
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                  <span className="bold">{fmtDuration(row.best_seconds)}</span>
                  {row.best_pace && <span className="tiny">{fmtPace(row.best_pace)}</span>}
                </div>
              </div>
            ))}
          </>
        )}
      </Modal>
    </div>
  )
}
