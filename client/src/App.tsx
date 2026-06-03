import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing                 from './pages/Landing'
import Login                   from './pages/Login'
import Modulo                  from './pages/Modulo'
import Portal                  from './pages/Portal'
import ProtectedRoute          from './components/ProtectedRoute'
import EnfermeiromainComponent from './app/components/enfermeirmain/enfermeirmain.component'
import FinanceiromainComponent from './app/components/financeiromain/financeiromain.component'
import MedicomainComponent     from './app/components/medicomain/medicomain.component'
import { useAuthStore }        from './store/authStore'

/* /private → dashboard por perfil */
function PrivateDashboard() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'utente')        return <Navigate to="/portal"  replace />
  if (user.role === 'medico')        return <Navigate to="/medico"  replace />
  if (user.role === 'enfermeiro')    return <EnfermeiromainComponent />
  if (user.role === 'financeiro')    return <FinanceiromainComponent />
  if (user.role === 'administrador') return <Navigate to="/" replace />
  /* médico, técnico → tubo */
  return <Landing />
}

/* / → utente vai para /portal, resto Landing */
function RootRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'utente') return <Navigate to="/portal" replace />
  return (
    <ProtectedRoute>
      <Landing />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/"         element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path="/portal"   element={<ProtectedRoute roles={['utente','administrador']}><Portal /></ProtectedRoute>} />
        <Route path="/medico"   element={<ProtectedRoute roles={['medico','administrador']}><MedicomainComponent /></ProtectedRoute>} />
        <Route path="/private"  element={<ProtectedRoute><PrivateDashboard /></ProtectedRoute>} />
        <Route path="/modulo/:id" element={<ProtectedRoute><Modulo /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
