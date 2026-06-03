import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import '../staffportal/staffportal.css'
import './financeiromain.component.css'

interface FaturaRow {
  _id: string
  numeroFatura: string
  utenteNome: string
  tipo: string
  valorLiquido: number
  estado: string
}

interface Stats {
  faturacaoMes: number
  recebidoMes: number
  porEstado: { rascunho: number; emitida: number; paga: number; anulada: number }
}

type FinTab = 'faturas' | 'pagamentos' | 'seguradoras' | 'relatorios' | 'nova'

const ESTADO_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  emitida:  'Emitida',
  paga:     'Paga',
  anulada:  'Anulada',
}

function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

export default function FinanceiromainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [faturas, setFaturas] = useState<FaturaRow[]>([])
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FinTab>('faturas')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/faturas/stats'),
      api.get('/faturas?estado=emitida&limit=20'),
    ])
      .then(([s, f]) => {
        if (!active) return
        setStats(s.data)
        setFaturas(f.data.data ?? f.data ?? [])
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const pendente = faturas.reduce((s, f) => s + f.valorLiquido, 0)
  const handleLogout = () => { logout(); navigate('/login') }
  const exportarMapa = () => {
    const header = 'Numero,Utente,Tipo,Estado,Valor\n'
    const rows = faturas.map(f => [
      f.numeroFatura,
      f.utenteNome,
      f.tipo,
      f.estado,
      f.valorLiquido.toFixed(2),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mapa-financeiro.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="staff-portal staff-portal--financeiro">
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Financeiro</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">financeiro · {new Date().toLocaleDateString('pt-PT')}</div>
          </div>
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      <section className="staff-hero">
        <div>
          <div className="staff-greeting">Bom dia, <em>{user?.nome?.split(' ')[0] || 'Financeiro'}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => setTab('nova')}>+ emitir fatura</button>
            <button className="staff-btn-ghost" onClick={exportarMapa}>exportar mapa</button>
          </div>
        </div>
        <div className="staff-kpis">
          <button className="staff-kpi" onClick={() => setTab('relatorios')}><i>€</i><span>{fmtEur(stats?.faturacaoMes ?? 0)}</span><small>faturacao mensal</small></button>
          <button className="staff-kpi staff-kpi--ok" onClick={() => setTab('pagamentos')}><i>✓</i><span>{fmtEur(stats?.recebidoMes ?? 0)}</span><small>recebido este mes</small></button>
          <button className="staff-kpi staff-kpi--alert" onClick={() => setTab('pagamentos')}><i>!</i><span>{fmtEur(pendente)}</span><small>pendente de cobranca</small></button>
          <button className="staff-kpi staff-kpi--link" onClick={() => setTab('nova')}><i>▣</i><span>{stats?.porEstado?.rascunho ?? '-'}</span><small>rascunhos por emitir</small></button>
        </div>
      </section>

      <nav className="staff-tabs">
        {([
          ['faturas', '▣', 'faturas'],
          ['pagamentos', '✓', 'pagamentos'],
          ['seguradoras', '⊙', 'seguradoras'],
          ['relatorios', '≡', 'relatorios'],
        ] as const).map(([id, icon, label]) => (
          <button key={id} className={`staff-tab${tab === id ? ' staff-tab--on' : ''}`} onClick={() => setTab(id)}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      <main className="staff-content">
        <section className="staff-section">
          <div className="staff-section-header">
            <span>
              {tab === 'faturas' && 'faturas emitidas'}
              {tab === 'pagamentos' && 'pagamentos'}
              {tab === 'seguradoras' && 'seguradoras'}
              {tab === 'relatorios' && 'relatorios financeiros'}
              {tab === 'nova' && 'emitir fatura'}
            </span>
            {loading && <small>a carregar...</small>}
            {tab === 'relatorios' && <button className="staff-btn-primary" onClick={exportarMapa}>exportar csv</button>}
          </div>

          {tab === 'nova' && (
            <div className="staff-empty">
              <div className="staff-empty-mark">+</div>
              <strong>Nova fatura</strong>
              <p>Escolha uma requisicao faturavel para emitir a fatura.</p>
              <button className="staff-btn-primary" onClick={() => setTab('faturas')}>ver faturas emitidas</button>
            </div>
          )}

          {tab === 'pagamentos' && (
            <div className="staff-empty">
              <div className="staff-empty-mark">=</div>
              <strong>{fmtEur(pendente)} pendente de cobranca</strong>
              <p>As faturas emitidas por pagar aparecem na lista de faturas.</p>
              <button className="staff-btn-primary" onClick={() => setTab('faturas')}>abrir faturas</button>
            </div>
          )}

          {tab === 'seguradoras' && (
            <div className="staff-empty">
              <div className="staff-empty-mark">⊙</div>
              <strong>Sem acordos por rever</strong>
              <p>Consulte seguradoras associadas nas faturas emitidas.</p>
            </div>
          )}

          {tab === 'relatorios' && (
            <div className="staff-empty">
              <div className="staff-empty-mark">≡</div>
              <strong>Mapa financeiro pronto</strong>
              <p>Exporte as faturas carregadas para CSV.</p>
              <button className="staff-btn-primary" onClick={exportarMapa}>exportar csv</button>
            </div>
          )}

          {tab === 'faturas' && !loading && faturas.length === 0 && (
            <div className="staff-empty">
              <div className="staff-empty-mark">=</div>
              <strong>Sem faturas emitidas pendentes.</strong>
            </div>
          )}

          {tab === 'faturas' && faturas.map(fat => (
            <article key={fat._id} className="fin-row">
              <div>
                <strong>{fat.utenteNome}</strong>
                <span>{fat.numeroFatura} · {fat.tipo.toUpperCase()}</span>
              </div>
              <mark className={`fin-estado fin-estado--${fat.estado}`}>
                {ESTADO_LABEL[fat.estado] ?? fat.estado}
              </mark>
              <mark className="fin-valor">{fmtEur(fat.valorLiquido)}</mark>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
