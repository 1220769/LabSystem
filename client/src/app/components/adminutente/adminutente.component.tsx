import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import HeaderComponent from '../header/header.component'
import { nomesPerfis } from '../../interface/response/modulo'
import './adminutente.component.css'

interface UserRow {
  _id: string
  nome: string
  email: string
  role: string
  ativo: boolean
}

export default function AdminutenteComponent() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    api.get('/users')
      .then(({ data }) => {
        if (active) setUsers(data.data || [])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <HeaderComponent
      titulo="Gestao de utilizadores"
      subtitulo="Zona de administracao para perfis e contas internas."
    >
      <section className="private-panel">
        <div className="private-panel-head">
          <h2>Utilizadores</h2>
          {loading && <span>a carregar...</span>}
        </div>

        <div className="private-list">
          {users.map((row) => (
            <article key={row._id}>
              <div>
                <strong>{row.nome}</strong>
                <span>{row.email}</span>
              </div>
              <small>{nomesPerfis[row.role as keyof typeof nomesPerfis] || row.role}</small>
              <mark>{row.ativo ? 'activo' : 'inactivo'}</mark>
            </article>
          ))}
        </div>
      </section>
    </HeaderComponent>
  )
}
