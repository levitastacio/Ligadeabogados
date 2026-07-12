// Teclado numerico grande para registrar peso y reps en el gym
export default function NumPad({ value, onChange, allowDecimal = true }) {
  const press = (k) => {
    let v = String(value ?? '')
    if (k === 'del') v = v.slice(0, -1)
    else if (k === '.') {
      if (!allowDecimal || v.includes('.')) return
      v = v === '' ? '0.' : v + '.'
    } else {
      if (v.replace('.', '').length >= 5) return
      v = v === '0' ? k : v + k
    }
    onChange(v)
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '', '0', 'del']
  return (
    <div className="numpad">
      {keys.map((k, i) =>
        k === '' ? <span key={i} /> : (
          <button key={i} onClick={() => press(k)}>
            {k === 'del' ? '⌫' : k}
          </button>
        )
      )}
    </div>
  )
}
