import { fmtWeight } from '../../lib/utils'

export default function ExerciseBlock({ exercise, target, sets, onAddSet }) {
  return (
    <div className="card">
      <div className="row-between">
        <div>
          <h3>{exercise.name}</h3>
          <p className="tiny">
            {target ? `Objetivo: ${target.target_sets} × ${target.target_reps}` : exercise.muscle}
            {exercise.video_url && (
              <>
                {' · '}
                <a href={exercise.video_url} target="_blank" rel="noreferrer" className="accent" style={{ textDecoration: 'none' }}>
                  ▶ técnica
                </a>
              </>
            )}
          </p>
        </div>
        <span className="chip">{sets.length}{target ? `/${target.target_sets}` : ''}</span>
      </div>

      {sets.length > 0 && (
        <div className="mt">
          {sets.map((s, i) => (
            <div key={i} className="list-item" style={{ padding: '8px 0' }}>
              <span className="tiny" style={{ width: 20 }}>{i + 1}</span>
              <span className="bold" style={{ flex: 1 }}>
                {fmtWeight(s.weight, s.unit)} × {s.reps}
              </span>
              {s.rpe && <span className="tiny">RPE {s.rpe}</span>}
              {s.is_pr && <span title="Récord personal">🏆</span>}
            </div>
          ))}
        </div>
      )}

      <button className="btn secondary mt" onClick={onAddSet}>+ Agregar serie</button>
    </div>
  )
}
