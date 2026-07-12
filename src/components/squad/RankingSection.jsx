import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { cachedFetch } from '../../lib/offline'
import { fmtVolume, monthStr, prevMonthStr, weekRange } from '../../lib/utils'
import { fmtPace } from '../../lib/pace'
import Segmented from '../common/Segmented'
import Podium from './Podium'
import Avatar from '../common/Avatar'
import Spinner from '../common/Spinner'

const METRICS = {
  gym: { label: 'Gym', sort: (a, b) => b.volume_kg - a.volume_kg },
  running: { label: 'Running', sort: (a, b) => b.km - a.km },
  constancia: { label: 'Constancia', sort: (a, b) => b.days - a.days },
}

export default function RankingSection({ group, unit }) {
  const [metric, setMetric] = useState('gym')
  const [period, setPeriod] = useState('mes')
  const [rows, setRows] = useState(null)
  const [championId, setChampionId] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    const load = async () => {
      const key = `ranking-${group.id}-${period}`
      const { data } = await cachedFetch(key, async () => {
        let res
        if (period === 'mes') {
          res = await supabase.rpc('get_group_ranking', { p_group_id: group.id, p_month: monthStr() })
        } else {
          const w = weekRange()
          res = await supabase.rpc('get_group_ranking_range', { p_group_id: group.id, p_from: w.from, p_to: w.to })
        }
        if (res.error) throw res.error
        return res.data || []
      })
      if (alive) setRows(data)

      // Insignia dorada: campeon de volumen del mes anterior
      const { data: champ } = await supabase
        .from('medals')
        .select('user_id')
        .eq('group_id', group.id)
        .eq('month', prevMonthStr())
        .eq('code', 'vol')
        .eq('rank', 1)
        .maybeSingle()
      if (alive) setChampionId(champ?.user_id || null)
    }
    load()
    return () => { alive = false }
  }, [group.id, period])

  if (!rows) return <Spinner />

  const formatValue = (r) => {
    if (metric === 'gym') return fmtVolume(r.volume_kg, unit)
    if (metric === 'running') return `${Number(r.km || 0).toFixed(1)} km${r.best_pace ? ` · ${fmtPace(r.best_pace)}` : ''}`
    return `${r.days} días`
  }

  const sorted = rows.slice().sort(METRICS[metric].sort).filter((r) => {
    if (metric === 'gym') return r.volume_kg > 0
    if (metric === 'running') return r.km > 0
    return r.days > 0
  })
  const rest = rows.slice().sort(METRICS[metric].sort).filter((r) => !sorted.slice(0, 3).includes(r))

  return (
    <div>
      <Segmented
        options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))}
        value={metric}
        onChange={setMetric}
      />
      <div className="mt mb">
        <Segmented
          options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="muted center mt">Nadie ha registrado actividad todavía. ¡Sé el primero!</p>
      ) : (
        <>
          <Podium entries={sorted.slice(0, 3)} formatValue={formatValue} championId={championId} />
          {rest.length > 0 && (
            <div className="card">
              {rest.map((r, i) => (
                <div key={r.user_id} className="list-item">
                  <span className="tiny bold" style={{ width: 22 }}>{sorted.indexOf(r) + 1 || i + 4}</span>
                  <Avatar profile={{ id: r.user_id, display_name: r.display_name, avatar_url: r.avatar_url }} size={36} champion={r.user_id === championId} />
                  <span className="bold" style={{ flex: 1, fontSize: 15 }}>{r.display_name}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{formatValue(r)}</span>
                </div>
              ))}
            </div>
          )}
          {metric === 'running' && (
            <p className="tiny center">Ranking de running: km totales, mejor pace en 5km+, {sorted.reduce((a, r) => a + (r.activities || 0), 0)} actividades del squad</p>
          )}
        </>
      )}
    </div>
  )
}
