import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Modulo from './pages/Modulo'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Landing />
          </ProtectedRoute>
        } />
        <Route path="/modulo/:id" element={
          <ProtectedRoute>
            <Modulo />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}