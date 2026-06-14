import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../api/axios'
import './Seguranca.css'

type Tab = 'auditoria' | 'rgpd' | 'sessoes' | 'backups'
interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}

interface ILog { _id: string; utilizador: string; acao: string; modulo: string; detalhe?: string; ip?: string; createdAt: string }
interface ISessao { _id: string; nome: string; email: string; role: string; ultimoLogin?: string }
interface IStats { totalEventos: number; eventosHoje: number; sessoesAtivas: number }

const ROLE_LBL: Record<string, string> = {
  administrador:'Administrador', tecnico:'Técnico', medico:'Médico',
  enfermeiro:'Enfermeiro', utente:'Utente',
}

const BACKUPS_MOCK = [
  { id:1, tipo:'Completo',     data:'2026-06-03 02:00', tamanho:'2.4 GB', estado:'ok',  destino:'S3 · eu-west-1' },
  { id:2, tipo:'Incremental',  data:'2026-06-02 02:00', tamanho:'180 MB', estado:'ok',  destino:'S3 · eu-west-1' },
  { id:3, tipo:'Incremental',  data:'2026-06-01 02:00', tamanho:'210 MB', estado:'ok',  destino:'S3 · eu-west-1' },
  { id:4, tipo:'Completo',     data:'2026-05-27 02:00', tamanho:'2.3 GB', estado:'ok',  destino:'S3 · eu-west-1' },
  { id:5, tipo:'Incremental',  data:'2026-05-26 02:00', tamanho:'165 MB', estado:'warn', destino:'S3 · eu-west-1' },
]

const RGPD_PEDIDOS_MOCK = [
  { id:1, tipo:'Acesso',    utente:'Ana Silva',    data:'2026-05-20', estado:'resolvido' },
  { id:2, tipo:'Portabilidade', utente:'João Costa', data:'2026-05-28', estado:'pendente' },
  { id:3, tipo:'Apagamento', utente:'Maria F.',    data:'2026-06-01', estado:'pendente' },
]

export default function Seguranca({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const [tab,    setTab]    = useState<Tab>('auditoria')
  const [logs,   setLogs]   = useState<ILog[]>([])
  const [sessoes,setSessoes] = useState<ISessao[]>([])
  const [stats,  setStats]  = useState<IStats | null>(null)
  const [loading,setLoading] = useState(true)
  const [modulo, setModulo] = useState('')
  const [user,   setUser]   = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/auditoria/stats'),
      api.get('/auditoria/logs'),
      api.get('/auditoria/sessoes'),
    ]).then(([s, l, se]) => {
      setStats(s.data)
      setLogs(l.data.data ?? [])
      setSessoes(se.data.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtrarLogs = () => {
    const params: Record<string,string> = {}
    if (modulo) params.modulo = modulo
    if (user)   params.utilizador = user
    api.get('/auditoria/logs', { params }).then(r => setLogs(r.data.data ?? [])).catch(() => {})
  }

  return (
    <motion.div className="seg-page" style={{ background: seg.color }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>

      <button className="seg-back" onClick={() => navigate('/')}>← voltar</button>

      <div className="seg-top">
        <div className="seg-num">0{seg.id}</div>
        <div className="seg-title">{seg.name}</div>
        <div className="seg-sub">{seg.sub}</div>
      </div>

      {/* KPIs */}
      <div className="seg-kpis">
        <div className="seg-kpi"><span className="seg-kpi-val">{loading ? '—' : stats?.eventosHoje ?? 0}</span><span className="seg-kpi-lbl">Eventos hoje</span></div>
        <div className="seg-kpi"><span className="seg-kpi-val">{loading ? '—' : stats?.totalEventos ?? 0}</span><span className="seg-kpi-lbl">Total no log</span></div>
        <div className="seg-kpi"><span className="seg-kpi-val">{loading ? '—' : stats?.sessoesAtivas ?? 0}</span><span className="seg-kpi-lbl">Utilizadores activos</span></div>
        <div className="seg-kpi seg-kpi--ok"><span className="seg-kpi-val">✓</span><span className="seg-kpi-lbl">Último backup OK</span></div>
      </div>

      {/* Tabs */}
      <div className="seg-tabs">
        <button className={`seg-tab${tab==='auditoria'?' seg-tab--on':''}`} onClick={() => setTab('auditoria')}>Log de Auditoria</button>
        <button className={`seg-tab${tab==='rgpd'     ?' seg-tab--on':''}`} onClick={() => setTab('rgpd')}>RGPD</button>
        <button className={`seg-tab${tab==='sessoes'  ?' seg-tab--on':''}`} onClick={() => setTab('sessoes')}>Sessões</button>
        <button className={`seg-tab${tab==='backups'  ?' seg-tab--on':''}`} onClick={() => setTab('backups')}>Backups</button>
      </div>

      <div className="seg-content">

        {/* ═══ AUDITORIA ═══ */}
        {tab === 'auditoria' && (
          <div className="seg-section">
            <div className="seg-toolbar">
              <input className="seg-input" placeholder="Filtrar por utilizador…" value={user} onChange={e => setUser(e.target.value)} />
              <select className="seg-input seg-select" value={modulo} onChange={e => setModulo(e.target.value)}>
                <option value="">Todos os módulos</option>
                {['auth','utentes','requisicoes','amostras','resultados','faturas','equipamentos'].map(m =>
                  <option key={m} value={m}>{m}</option>
                )}
              </select>
              <button className="seg-btn-filter" onClick={filtrarLogs}>Filtrar</button>
            </div>
            <div className="seg-sh"><span className="seg-stitle">Registo imutável de eventos</span><span className="seg-cnt">{logs.length} entradas</span></div>
            <div className="seg-note">Este log é de só leitura. Cada evento é registado automaticamente pelo sistema.</div>
            {logs.length === 0 && !loading
              ? <div className="seg-empty">Sem eventos registados{modulo || user ? ' para este filtro' : ''}.</div>
              : <div className="seg-log-table">
                  <div className="seg-log-header"><span>Data / Hora</span><span>Utilizador</span><span>Módulo</span><span>Acção</span><span>IP</span></div>
                  {logs.map(l => (
                    <div key={l._id} className="seg-log-row">
                      <span className="seg-mono">{fmtDateTime(l.createdAt)}</span>
                      <span>{l.utilizador}</span>
                      <span className="seg-tag-mod">{l.modulo}</span>
                      <span>{l.acao}{l.detalhe && <span className="seg-detail"> · {l.detalhe}</span>}</span>
                      <span className="seg-mono seg-ip">{l.ip ?? '—'}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ═══ RGPD ═══ */}
        {tab === 'rgpd' && (
          <div className="seg-section">
            <div className="seg-sh"><span className="seg-stitle">Conformidade RGPD</span></div>
            <div className="seg-rgpd-info">
              <div className="seg-rgpd-item"><span className="seg-rgpd-icon">🔒</span><div><div className="seg-rgpd-titulo">Dados encriptados em repouso</div><div className="seg-rgpd-sub">AES-256 · MongoDB Atlas Encryption at Rest</div></div><span className="seg-ok-badge">Activo</span></div>
              <div className="seg-rgpd-item"><span className="seg-rgpd-icon">🔐</span><div><div className="seg-rgpd-titulo">Transmissão segura</div><div className="seg-rgpd-sub">TLS 1.3 em todas as ligações API</div></div><span className="seg-ok-badge">Activo</span></div>
              <div className="seg-rgpd-item"><span className="seg-rgpd-icon">📋</span><div><div className="seg-rgpd-titulo">Log de auditoria imutável</div><div className="seg-rgpd-sub">Todos os acessos a dados pessoais são registados</div></div><span className="seg-ok-badge">Activo</span></div>
              <div className="seg-rgpd-item"><span className="seg-rgpd-icon">⏱</span><div><div className="seg-rgpd-titulo">Retenção de dados</div><div className="seg-rgpd-sub">Dados de utentes: 10 anos conforme lei</div></div><span className="seg-ok-badge">Configurado</span></div>
            </div>
            <div className="seg-sh" style={{ marginTop: 0 }}><span className="seg-stitle">Pedidos de titulares</span><span className="seg-cnt">{RGPD_PEDIDOS_MOCK.length}</span></div>
            <ul className="seg-list">
              {RGPD_PEDIDOS_MOCK.map(p => (
                <li key={p.id} className="seg-row">
                  <div><div className="seg-nome">{p.utente}</div><div className="seg-meta">Pedido de <strong>{p.tipo}</strong> · {fmtDate(p.data)}</div></div>
                  <span className={`seg-estado ${p.estado==='resolvido' ? 'seg-estado--ok' : 'seg-estado--pend'}`}>{p.estado}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ═══ SESSÕES ═══ */}
        {tab === 'sessoes' && (
          <div className="seg-section">
            <div className="seg-sh"><span className="seg-stitle">Utilizadores activos</span><span className="seg-cnt">{sessoes.length}</span></div>
            {sessoes.length === 0 && !loading
              ? <div className="seg-empty">Sem dados de sessão disponíveis.</div>
              : <ul className="seg-list">
                  {sessoes.map(s => (
                    <li key={s._id} className="seg-row">
                      <div className="seg-sessao-avatar">{s.nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div className="seg-nome">{s.nome}</div>
                        <div className="seg-meta"><span className="seg-mono">{s.email}</span>· {ROLE_LBL[s.role] ?? s.role}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="seg-meta">Último acesso</div>
                        <div className="seg-mono" style={{ fontSize:11 }}>{fmtDateTime(s.ultimoLogin)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
            }
          </div>
        )}

        {/* ═══ BACKUPS ═══ */}
        {tab === 'backups' && (
          <div className="seg-section">
            <div className="seg-sh"><span className="seg-stitle">Estado dos backups automáticos</span></div>
            <div className="seg-backup-info">
              <div><span className="seg-lbl">Frequência</span><div>Completo: semanal (dom 02:00) · Incremental: diário (02:00)</div></div>
              <div><span className="seg-lbl">Retenção</span><div>90 dias</div></div>
              <div><span className="seg-lbl">Destino</span><div>Amazon S3 · eu-west-1 (Dublin)</div></div>
              <div><span className="seg-lbl">Encriptação</span><div>AES-256-GCM</div></div>
            </div>
            <div className="seg-sh" style={{ marginTop:0 }}><span className="seg-stitle">Histórico de backups</span></div>
            <ul className="seg-list">
              {BACKUPS_MOCK.map(b => (
                <li key={b.id} className="seg-row">
                  <div>
                    <div className="seg-nome">{b.tipo} · {b.tamanho}</div>
                    <div className="seg-meta"><span className="seg-mono">{b.data}</span>· {b.destino}</div>
                  </div>
                  <span className={`seg-estado ${b.estado==='ok' ? 'seg-estado--ok' : 'seg-estado--warn'}`}>
                    {b.estado === 'ok' ? 'Sucesso' : 'Aviso'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="seg-disaster-row">
              <div><div className="seg-nome">Disaster Recovery</div><div className="seg-meta">RPO: 24h · RTO: 4h · Último teste: 2026-05-01</div></div>
              <button className="seg-btn seg-btn--test">Simular recuperação</button>
            </div>
          </div>
        )}

      </div>
    </motion.div>
  )
}
