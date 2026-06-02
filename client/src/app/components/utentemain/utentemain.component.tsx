import { useEffect, useState } from 'react'
import api from '../../../api/axios'
import HeaderComponent from '../header/header.component'
import '../adminutente/adminutente.component.css'

interface UtenteRow {
  _id: string
  nome: string
  numeroProcesso: string
  email?: string
  telefone?: string
}

export default function UtentemainComponent() {
  const [utentes, setUtentes] = useState<UtenteRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    api.get('/utentes')
      .then(({ data }) => {
        if (active) setUtentes(data.data || [])
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
      titulo="Utentes"
      subtitulo="Ficha clinica, contactos e registos usados pelos perfis com permissao."
    >
      <section className="private-panel">
        <div className="private-panel-head">
          <h2>Lista de utentes</h2>
          {loading && <span>a carregar...</span>}
        </div>

        <div className="private-list">
          {utentes.map((row) => (
            <article key={row._id}>
              <div>
                <strong>{row.nome}</strong>
                <span>{row.numeroProcesso}</span>
              </div>
              <small>{row.email || row.telefone || 'sem contacto'}</small>
            </article>
          ))}
        </div>
      </section>
    </HeaderComponent>
  )
}
