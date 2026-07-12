export default function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="row-between mb">
            <h2>{title}</h2>
            <button className="btn ghost small" onClick={onClose}>Cerrar</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
