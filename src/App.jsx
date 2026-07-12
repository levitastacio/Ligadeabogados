import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Spinner from './components/common/Spinner'
import TabBar from './components/common/TabBar'
import OfflineIndicator from './components/common/OfflineIndicator'
import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import HomePage from './pages/HomePage'
import TrainPage from './pages/TrainPage'
import LiveSessionPage from './pages/LiveSessionPage'
import RoutinesPage from './pages/RoutinesPage'
import RunFormPage from './pages/RunFormPage'
import SquadPage from './pages/SquadPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'
import WrappedPage from './pages/WrappedPage'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-plain center" style={{ paddingTop: '40vh' }}>
        <Spinner />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/entrenar" element={<TrainPage />} />
          <Route path="/entrenar/sesion" element={<LiveSessionPage />} />
          <Route path="/entrenar/rutinas" element={<RoutinesPage />} />
          <Route path="/carrera" element={<RunFormPage />} />
          <Route path="/squad" element={<SquadPage />} />
          <Route path="/progreso" element={<ProgressPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/wrapped" element={<WrappedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <OfflineIndicator />
      <TabBar />
    </>
  )
}
