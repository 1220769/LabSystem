import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login   from './pages/Login'
import Modulo  from './pages/Modulo'
import Portal  from './pages/Portal'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'

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
        <Route path="/login"  element={<Login />} />
        <Route path="/"       element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path="/portal" element={<ProtectedRoute roles={['utente','administrador']}><Portal /></ProtectedRoute>} />
        <Route path="/modulo/:id" element={<ProtectedRoute><Modulo /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
