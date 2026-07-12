import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/', icon: '🏠', label: 'Inicio' },
  { path: '/entrenar', icon: '🏋️', label: 'Entrenar' },
  { path: '/squad', icon: '👥', label: 'Squad' },
  { path: '/progreso', icon: '📈', label: 'Progreso' },
  { path: '/perfil', icon: '⚙️', label: 'Perfil' },
]

export default function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map((tab) => (
          <button
            key={tab.path}
            className={pathname === tab.path ? 'active' : ''}
            onClick={() => navigate(tab.path)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
