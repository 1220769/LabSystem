import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import '../staffportal/staffportal.css'
import './medicomain.component.css'

type Tab = 'validacao' | 'requisicoes' | 'utentes' | 'criticos'
type ReqFilter = 'todas' | 'registada' | 'em_curso' | 'concluida' | 'cancelada'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'validacao', label: 'Validacao', icon: '✓' },
  { id: 'requisicoes', label: 'Requisicoes', icon: '≡' },
  { id: 'utentes', label: 'Utentes', icon: '⊙' },
  { id: 'criticos', label: 'Criticos', icon: '!' },
]

const reqFilters: { id: ReqFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'registada', label: 'Registada' },
  { id: 'em_curso', label: 'Em curso' },
  { id: 'concluida', label: 'Concluida' },
  { id: 'cancelada', label: 'Cancelada' },
]

export default function MedicomainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('requisicoes')
  const [reqFilter, setReqFilter] = useState<ReqFilter>('todas')
  const [stats, setStats] = useState({ aguardam: 0, criticos: 0, minhas: 0 })

  useEffect(() => {
    Promise.all([
      api.get('/resultados/stats').catch(() => null),
      api.get('/requisicoes/stats').catch(() => null),
    ]).then(([res, req]) => {
      setStats({
        aguardam: res?.data?.validado_tecnico ?? res?.data?.disponivel ?? 0,
        criticos: res?.data?.criticosPorValidar ?? 0,
        minhas: req?.data?.total ?? req?.data?.pendente ?? 0,
      })
    })
  }, [])

  const firstName = user?.nome?.replace(/^Dr\.?\s+/i, '').split(' ')[0] || 'Joao'
  const handleLogout = () => { logout(); navigate('/login') }
  const novaRequisicao = () => {
    setTab('requisicoes')
    setReqFilter('todas')
  }

  return (
    <div className="staff-portal staff-portal--medico">
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Clinico</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome || 'Dr. Joao Costa'}</div>
            <div className="staff-user-role">medico · {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <span className="staff-bell" aria-hidden="true">●</span>
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      <section className="staff-hero">
        <div>
          <div className="staff-greeting">Bom dia, <em>{firstName}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={novaRequisicao}>+ nova requisicao</button>
            <button className="staff-btn-ghost" onClick={() => setTab('utentes')}>⌕ pesquisar utente</button>
          </div>
        </div>

        <div className="staff-kpis">
          <button className="staff-kpi" onClick={() => setTab('validacao')}>
            <i>✓</i><span>{stats.aguardam}</span><small>aguardam validacao</small>
          </button>
          <button className="staff-kpi" onClick={() => setTab('criticos')}>
            <i>!</i><span>{stats.criticos}</span><small>criticos por validar</small>
          </button>
          <button className="staff-kpi" onClick={() => setTab('requisicoes')}>
            <i>▣</i><span>{stats.minhas}</span><small>minhas requisicoes</small>
          </button>
          <button className="staff-kpi staff-kpi--link" onClick={() => setTab('utentes')}>
            <i>♟</i><span>Utentes</span><small>pesquisar ficha clinica</small>
          </button>
        </div>
      </section>

      <nav className="staff-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`staff-tab${tab === t.id ? ' staff-tab--on' : ''}`} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <main className="staff-content">
        <section className="staff-section">
          <div className="staff-section-header staff-section-header--filters">
            <div>
              <span>
                {tab === 'requisicoes' && 'As minhas requisicoes'}
                {tab === 'validacao' && 'Validacao medica'}
                {tab === 'utentes' && 'Pesquisar utentes'}
                {tab === 'criticos' && 'Resultados criticos'}
              </span>
              <p>
                {tab === 'requisicoes' && 'Requisicoes criadas por si, filtradas por estado'}
                {tab === 'validacao' && 'Resultados disponiveis para validacao clinica'}
                {tab === 'utentes' && 'Pesquisa rapida de ficha clinica'}
                {tab === 'criticos' && 'Alertas criticos por rever'}
              </p>
            </div>

            {tab === 'requisicoes' && (
              <>
                <div className="staff-filter-row">
                  {reqFilters.map(filter => (
                    <button
                      key={filter.id}
                      className={`staff-filter${reqFilter === filter.id ? ' staff-filter--on' : ''}`}
                      onClick={() => setReqFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button className="staff-btn-primary staff-section-action" onClick={novaRequisicao}>+ nova requisicao</button>
              </>
            )}
          </div>

          <div className="staff-empty">
            <div className="staff-empty-mark">=</div>
            <strong>
              {tab === 'requisicoes' && 'Sem requisicoes'}
              {tab === 'validacao' && 'Sem resultados pendentes'}
              {tab === 'utentes' && 'Nenhum utente selecionado'}
              {tab === 'criticos' && 'Sem criticos por validar'}
            </strong>
            <p>
              {tab === 'requisicoes' && 'Ainda nao criou nenhuma requisicao.'}
              {tab === 'validacao' && 'Nao existem resultados para validar neste momento.'}
              {tab === 'utentes' && 'Use a pesquisa de utente para abrir a ficha clinica.'}
              {tab === 'criticos' && 'Nao ha alertas criticos pendentes.'}
            </p>
            {tab === 'requisicoes' && <button className="staff-btn-primary" onClick={novaRequisicao}>+ criar primeira requisicao</button>}
          </div>
        </section>
      </main>
    </div>
  )
}
