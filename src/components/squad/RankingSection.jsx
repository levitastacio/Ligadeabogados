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
  gym: { label: 'Gym', key: 'volume_kg' },
  running: { label: 'Running', key: 'km' },
  constancia: { label: 'Constancia', key: 'days' },
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
      const { data } = await cachedFetch(`ranking-${group.id}-${period}`, async () => {
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
    return `${r.days} ${r.days === 1 ? 'día' : 'días'}`
  }

  const key = METRICS[metric].key
  // Quien tiene actividad va ordenado por la metrica; quien no, al final
  const withActivity = rows.filter((r) => Number(r[key]) > 0).sort((a, b) => Number(b[key]) - Number(a[key]))
  const withoutActivity = rows.filter((r) => !(Number(r[key]) > 0))
  const ranked = [...withActivity, ...withoutActivity]
  const podium = withActivity.slice(0, 3)
  const rest = ranked.slice(podium.length)

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

      {podium.length === 0 ? (
        <p className="muted center mt">Nadie ha registrado actividad todavía. ¡Sé el primero!</p>
      ) : (
        <>
          <Podium entries={podium} formatValue={formatValue} championId={championId} />
          {rest.length > 0 && (
            <div className="card">
              {rest.map((r, i) => (
                <div key={r.user_id} className="list-item">
                  <span className="tiny bold" style={{ width: 22 }}>{podium.length + i + 1}</span>
                  <Avatar
                    profile={{ id: r.user_id, display_name: r.display_name, avatar_url: r.avatar_url }}
                    size={36}
                    champion={r.user_id === championId}
                  />
                  <span className="bold" style={{ flex: 1, fontSize: 15 }}>{r.display_name}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{formatValue(r)}</span>
                </div>
              ))}
            </div>
          )}
          {metric === 'running' && (
            <p className="tiny center">
              {ranked.reduce((a, r) => a + (r.activities || 0), 0)} actividades del squad este período
            </p>
          )}
        </>
      )}
    </div>
  )
}
