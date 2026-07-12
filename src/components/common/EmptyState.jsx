export default function EmptyState({ emoji = '🏋️', title, subtitle, children }) {
  return (
    <div className="center" style={{ padding: '36px 20px' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>{emoji}</div>
      <h3>{title}</h3>
      {subtitle && <p className="muted mt" style={{ marginTop: 6 }}>{subtitle}</p>}
      {children && <div className="mt">{children}</div>}
    </div>
  )
}
