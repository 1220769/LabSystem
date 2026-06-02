import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { nomesPerfis, paginasPorPerfil, type Perfil } from '../../interface/response/modulo'
import './header.component.css'

interface HeaderComponentProps {
  children?: ReactNode
  titulo: string
  subtitulo: string
}

export default function HeaderComponent({ children, titulo, subtitulo }: HeaderComponentProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const perfil = user?.role as Perfil | undefined
  const paginas = paginasPorPerfil(user?.role)
  const iniciais = user?.nome
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
  const dataHoje = new Date().toLocaleDateString('pt-PT')

  const terminarSessao = () => {
    logout()
    navigate('/login')
  }

  return (
    <main className="private-area">
      <aside className="private-sidebar">
        <div className="private-logo">
          <span className="private-logo-icon" aria-hidden="true">
            <i />
          </span>
          <div>
            <strong>LabSystem Pro</strong>
            <small>area privada</small>
          </div>
        </div>

        <nav className="private-menu" aria-label="Menu privado">
          <NavLink to="/private" end>Dashboard</NavLink>
          {paginas.map((pagina) => (
            <NavLink to={pagina.rota} key={pagina.id}>{pagina.titulo}</NavLink>
          ))}
          <Link to="/">Mapa visual</Link>
        </nav>

        <div className="private-tube" aria-hidden="true">
          <span className="private-tube-cap" />
          <span style={{ background: '#2A2A28' }} />
          <span style={{ background: '#E8D5B0' }} />
          <span style={{ background: '#B8CDE0' }} />
          <span style={{ background: '#C8001A' }} />
          <span style={{ background: '#D4920A' }} />
          <span style={{ background: '#7A9E7E' }} />
          <span className="private-tube-tip" />
        </div>
      </aside>

      <section className="private-content">
        <div className="private-topbar">
          <div className="private-topbar-brand">
            <span className="private-brand-icon" aria-hidden="true">
              <i />
            </span>
            <strong>LabSystem Pro</strong>
          </div>

          <div className="private-topbar-actions">
            <span className="private-date">{dataHoje}</span>
            <div className="private-user-pill">
              <span>{iniciais || 'LS'}</span>
              <strong>{user?.nome}</strong>
            </div>
            <button type="button" onClick={terminarSessao}>Sair</button>
          </div>
        </div>

        <header className="private-header">
          <div>
            <span className="private-eyebrow">
              {perfil ? nomesPerfis[perfil] : 'Perfil'} / area privada
            </span>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
          </div>
        </header>

        {children}
      </section>
    </main>
  )
}
