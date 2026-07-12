import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { cachedFetch } from '../lib/offline'
import { toKg } from '../lib/utils'
import Segmented from '../components/common/Segmented'
import Spinner from '../components/common/Spinner'
import ExerciseProgress from '../components/progress/ExerciseProgress'
import AttendanceCalendar from '../components/progress/AttendanceCalendar'
import BodySection from '../components/progress/BodySection'
import RunningSection from '../components/progress/RunningSection'
import MedalCase from '../components/progress/MedalCase'

export default function ProgressPage() {
  const { user, profile, accent } = useAuth()
  const [section, setSection] = useState('gym')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    cachedFetch(`progress-${user.id}`, async () => {
      const [sets, exercises, runs, medals] = await Promise.all([
        supabase.from('sets')
          .select('exercise_id, weight, unit, reps, is_pr, created_at, sessions!inner(date, user_id)')
          .eq('sessions.user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3000),
        supabase.from('exercises').select('id, name, muscle').order('name'),
        supabase.from('runs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(500),
        supabase.from('medals').select('*').eq('user_id', user.id).order('awarded_at', { ascending: false }),
      ])
      return {
        sets: sets.data || [],
        exercises: exercises.data || [],
        runs: runs.data || [],
        medals: medals.data || [],
      }
    }).then(({ data: d }) => {
      if (alive) setData(d)
    })
    return () => { alive = false }
  }, [user.id])

  if (!data) return <Spinner />

  const volumeByDate = {}
  for (const s of data.sets) {
    const date = s.sessions.date
    volumeByDate[date] = (volumeByDate[date] || 0) + toKg(s.weight, s.unit) * s.reps
  }

  return (
    <div>
      <h1 className="mb">Progreso</h1>
      <div className="mb">
        <Segmented
          options={[
            { value: 'gym', label: 'Gym' },
            { value: 'cuerpo', label: 'Cuerpo' },
            { value: 'running', label: 'Running' },
            { value: 'medallas', label: 'Medallas' },
          ]}
          value={section}
          onChange={setSection}
        />
      </div>

      {section === 'gym' && (
        <>
          <div className="card">
            <h3 className="mb">Calendario de asistencia</h3>
            <AttendanceCalendar volumeByDate={volumeByDate} accent={accent} />
          </div>
          <ExerciseProgress sets={data.sets} exercises={data.exercises} unit={profile.unit} accent={accent} />
        </>
      )}

      {section === 'cuerpo' && <BodySection accent={accent} />}
      {section === 'running' && <RunningSection runs={data.runs} accent={accent} />}
      {section === 'medallas' && <MedalCase medals={data.medals} />}
    </div>
  )
}
