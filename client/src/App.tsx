import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Modulo from './pages/Modulo'
import ProtectedRoute from './components/ProtectedRoute'
import AdminmainComponent from './app/components/adminmain/adminmain.component'
import UtentemainComponent from './app/components/utentemain/utentemain.component'
import ModuloprivadoComponent from './app/components/moduloprivado/moduloprivado.component'
import { paginasPrivadas } from './app/interface/response/modulo'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Landing />} />
        <Route path="/modulo/:id" element={<Modulo />} />
        <Route path="/private" element={
          <ProtectedRoute>
            <AdminmainComponent />
          </ProtectedRoute>
        } />
        <Route path="/private/utentes" element={
          <ProtectedRoute roles={['administrador', 'tecnico', 'medico', 'enfermeiro', 'utente']}>
            <UtentemainComponent />
          </ProtectedRoute>
        } />
        {paginasPrivadas.map((pagina) => (
          <Route
            key={pagina.id}
            path={pagina.rota}
            element={
              <ProtectedRoute roles={pagina.perfis}>
                <ModuloprivadoComponent modulo={pagina} />
              </ProtectedRoute>
            }
          />
        ))}
      </Routes>
    </BrowserRouter>
  )
}
