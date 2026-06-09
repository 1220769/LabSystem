import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import NotificationBell from '../../../components/NotificationBell'
import '../staffportal/staffportal.css'
import './medicomain.component.css'

/* ─── utils ─── */
function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-PT') }
function saudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite' }
function primeiroNome(nome: string) { return nome.replace(/^(Dr\.?|Dra\.?)\s+/i, '').split(' ')[0] }

/* ─── tipos ─── */
type MedTab = 'validacao' | 'requisicoes' | 'criticos'
type FlagR   = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
type ReqEstado = 'registada' | 'em_curso' | 'concluida' | 'cancelada'

interface IResultado {
  _id: string; codigoResultado: string; codigoAmostra: string
  requisicaoNumero: string; utenteNome: string
  analise: { codigo: string; nome: string; categoria: string }
  valor?: string; unidade?: string; refMin?: number; refMax?: number
  flag: FlagR; estado: string
  equipamento?: string; observacoes?: string
  validacaoTecnica?: { nome: string; dataHora: string }
  createdAt: string
}

interface IRequisicao {
  _id: string; numeroRequisicao: string; utenteNome: string
  analises: { codigo: string; nome: string; categoria: string }[]
  estado: ReqEstado; urgente: boolean; createdAt: string
  medicoNome?: string
}

interface IStats { aguardam: number; criticos: number; minhas: number }

/* ─── helpers ─── */
const FLAG_LABEL: Record<FlagR, string> = {
  pendente: 'Pendente', normal: 'Normal', alto: 'Alto ↑', baixo: 'Baixo ↓',
  critico_alto: '⬆ Crítico', critico_baixo: '⬇ Crítico',
}
const FLAG_COLOR: Record<FlagR, string> = {
  pendente: '#888', normal: '#2E7A50', alto: '#C87800', baixo: '#0064B4',
  critico_alto: '#C8001A', critico_baixo: '#C8001A',
}
const CAT_COLOR: Record<string, string> = {
  hematologia: '#5A64C8', bioquímica: '#3A8ABF', endocrinologia: '#C87800',
  imunologia: '#9060C8', microbiologia: '#C8001A', urina: '#2E7A50',
  coagulação: '#C87830', marcadores: '#6A6A68',
}
const REQ_ESTADO_LABEL: Record<ReqEstado, string> = {
  registada: 'Registada', em_curso: 'Em curso', concluida: 'Concluída', cancelada: 'Cancelada',
}
const REQ_ESTADO_COLOR: Record<ReqEstado, string> = {
  registada: '#888', em_curso: '#C87800', concluida: '#2E7A50', cancelada: '#C8001A',
}

function groupByReq(list: IResultado[]): Record<string, IResultado[]> {
  return list.reduce<Record<string, IResultado[]>>((acc, r) => {
    if (!acc[r.requisicaoNumero]) acc[r.requisicaoNumero] = []
    acc[r.requisicaoNumero].push(r)
    return acc
  }, {})
}

/* ══════════════════════════════════════════════════════ */
export default function MedicomainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab,     setTab]     = useState<MedTab>('validacao')
  const [stats,   setStats]   = useState<IStats>({ aguardam: 0, criticos: 0, minhas: 0 })
  const [loading, setLoading] = useState(true)

  /* validação */
  const [valList,    setValList]    = useState<IResultado[]>([])
  const [valLoading, setValLoading] = useState(false)
  /* painel */
  const [valReqPanel, setValReqPanel] = useState<string | null>(null)
  const [valObs,      setValObs]      = useState('')
  const [valSaving,   setValSaving]   = useState<'all' | string | null>(null)
  const [valSuccess,  setValSuccess]  = useState('')
  const [valErr,      setValErr]      = useState('')

  /* requisições */
  const [reqs,       setReqs]       = useState<IRequisicao[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqFilter,  setReqFilter]  = useState<ReqEstado | 'todas'>('todas')
  const [reqSearch,  setReqSearch]  = useState('')
  const [reqDeb,     setReqDeb]     = useState('')

  /* críticos */
  const [criticos,   setCriticos]   = useState<IResultado[]>([])
  const [critLoading,setCritLoad]   = useState(false)

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ─── loaders ─── */
  const loadStats = useCallback(async () => {
    try {
      const [rs, rq] = await Promise.all([
        api.get('/resultados/stats'),
        api.get('/requisicoes', { params: { limit: 1 } }),
      ])
      setStats({
        aguardam: rs.data.validado_tecnico ?? rs.data.disponivel ?? 0,
        criticos: rs.data.criticosPorValidar ?? 0,
        minhas: rq.data.total ?? 0,
      })
    } catch { /* */ }
  }, [])

  const loadVal = useCallback(() => {
    setValLoading(true)
    // só mostra requisições onde TODOS os resultados estão validado_tecnico
    api.get('/resultados/requisicoes-prontas', { params: { estado: 'validado_tecnico' } })
      .then(r => {
        const flat: IResultado[] = []
        ;(r.data.data ?? []).forEach((g: any) => flat.push(...(g.items ?? [])))
        setValList(flat)
        setStats(prev => ({ ...prev, aguardam: r.data.data?.length ?? 0 }))
      })
      .finally(() => setValLoading(false))
  }, [])

  const loadReqs = useCallback(() => {
    setReqLoading(true)
    api.get('/requisicoes', {
      params: {
        estado: reqFilter === 'todas' ? undefined : reqFilter,
        search: reqDeb, limit: 50,
      }
    }).then(r => setReqs(r.data.data ?? []))
      .finally(() => setReqLoading(false))
  }, [reqFilter, reqDeb])

  const loadCriticos = useCallback(() => {
    setCritLoad(true)
    api.get('/resultados', { params: { flag: 'critico', limit: 50 } })
      .then(r => setCriticos(r.data.data ?? []))
      .finally(() => setCritLoad(false))
  }, [])

  useEffect(() => {
    Promise.all([loadStats(), loadVal()]).finally(() => setLoading(false))
    const id = setInterval(loadStats, 60_000)
    return () => clearInterval(id)
  }, [loadStats, loadVal])

  useEffect(() => { if (tab === 'validacao')   loadVal() },      [tab, loadVal])
  useEffect(() => { if (tab === 'requisicoes') loadReqs() },     [tab, loadReqs])
  useEffect(() => { if (tab === 'criticos')    loadCriticos() }, [tab, loadCriticos])

  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => setReqDeb(reqSearch), 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [reqSearch])

  const handleLogout = () => { logout(); navigate('/login') }

  /* ─── PDF export ─── */
  const printPDF = (reqNum: string, items: IResultado[]) => {
    const utente  = items[0]?.utenteNome ?? ''
    const amostra = items[0]?.codigoAmostra ?? ''
    const date    = fmtDate(items[0]?.createdAt)
    const rows = items.map(r => `
      <tr>
        <td>${r.analise.nome}</td>
        <td>${r.analise.categoria}</td>
        <td style="font-weight:600;color:${FLAG_COLOR[r.flag]}">${r.valor ?? '—'} ${r.unidade ?? ''}</td>
        <td>${r.refMin !== undefined && r.refMax !== undefined ? `${r.refMin} – ${r.refMax} ${r.unidade ?? ''}` : '—'}</td>
        <td style="color:${FLAG_COLOR[r.flag]}">${FLAG_LABEL[r.flag]}</td>
        ${r.observacoes ? `<td>${r.observacoes}</td>` : '<td>—</td>'}
      </tr>`).join('')
    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/>
      <title>Relatório ${reqNum}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#1A1208;font-size:13px}
        h1{font-size:22px;letter-spacing:.02em;margin-bottom:4px}
        .sub{font-size:11px;color:#888;margin-bottom:32px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#888;padding:6px 10px;border-bottom:2px solid #eee}
        td{padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;vertical-align:top}
        tr:last-child td{border-bottom:none}
        .footer{margin-top:40px;font-size:10px;color:#aaa;font-style:italic}
      </style></head><body>
      <h1>Relatório de Resultados</h1>
      <div class="sub">${reqNum} · ${utente} · ${amostra} · ${date}</div>
      <table>
        <thead><tr><th>Análise</th><th>Categoria</th><th>Resultado</th><th>Referência</th><th>Flag</th><th>Observações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Validado por ${user?.nome} · ${new Date().toLocaleString('pt-PT')}</div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  /* ─── validação médica ─── */
  const byReqVal = groupByReq(valList)

  const validarTodos = async () => {
    const items = byReqVal[valReqPanel!] ?? []
    setValSaving('all'); setValErr(''); setValSuccess('')
    try {
      /* usa o endpoint bulk se existir, senão fallback individual */
      try {
        await api.post(`/resultados/requisicao/${encodeURIComponent(valReqPanel!)}/validar-medico`, {
          observacoes: valObs || undefined,
        })
      } catch {
        await Promise.all(items.map(r =>
          api.post(`/resultados/${r._id}/validar-medico`, { observacoes: valObs || undefined })
        ))
      }
      setValSuccess(`✓ ${items.length} resultado${items.length !== 1 ? 's' : ''} validados — PDF enviado ao utente`)
      setValList(prev => prev.filter(r => r.requisicaoNumero !== valReqPanel))
      await loadStats()
      setTimeout(() => { setValReqPanel(null); setValObs(''); setValSuccess('') }, 2000)
    } catch (e: any) {
      setValErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setValSaving(null) }
  }

  const validarUm = async (r: IResultado) => {
    setValSaving(r._id); setValErr('')
    try {
      await api.post(`/resultados/${r._id}/validar-medico`, { observacoes: valObs || undefined })
      setValList(prev => prev.filter(x => x._id !== r._id))
      /* se era o último da req, fecha o painel */
      const remaining = (byReqVal[valReqPanel!] ?? []).filter(x => x._id !== r._id)
      if (remaining.length === 0) {
        setTimeout(() => { setValReqPanel(null); setValObs('') }, 800)
      }
      await loadStats()
    } catch (e: any) {
      setValErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setValSaving(null) }
  }

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="staff-portal staff-portal--medico">

      {/* ── HEADER ── */}
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Clínico</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">médico · {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <NotificationBell theme="light" />
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="staff-hero">
        <div>
          <div className="staff-greeting">{saudacao()}, <em>{primeiroNome(user?.nome ?? 'Dr.')}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => navigate('/modulo/2')}>+ nova requisição</button>
            <button className="staff-btn-ghost" onClick={() => setTab('validacao')}>rever resultados</button>
          </div>
        </div>

        <div className="staff-kpis med-kpis">
          <button className={`med-kpi${stats.aguardam > 0 ? ' med-kpi--action' : ''}`} onClick={() => setTab('validacao')}>
            <div className="med-kpi-icon">✓</div>
            <div className="med-kpi-val">{loading ? '—' : stats.aguardam}</div>
            <div className="med-kpi-lbl">aguardam validação</div>
          </button>
          <button className={`med-kpi${stats.criticos > 0 ? ' med-kpi--crit' : ''}`} onClick={() => setTab('criticos')}>
            <div className="med-kpi-icon">!</div>
            <div className="med-kpi-val">{loading ? '—' : stats.criticos}</div>
            <div className="med-kpi-lbl">críticos por validar</div>
          </button>
          <button className="med-kpi" onClick={() => setTab('requisicoes')}>
            <div className="med-kpi-icon">≡</div>
            <div className="med-kpi-val">{loading ? '—' : stats.minhas}</div>
            <div className="med-kpi-lbl">requisições</div>
          </button>
        </div>
      </section>

      {/* ── TABS ── */}
      <nav className="staff-tabs med-tabs">
        {([
          { id: 'validacao',   label: 'Validação Médica', badge: stats.aguardam },
          { id: 'criticos',    label: 'Críticos',         badge: stats.criticos },
          { id: 'requisicoes', label: 'Requisições',      badge: 0 },
        ] as const).map(t => (
          <button key={t.id} className={`med-tab${tab === t.id ? ' med-tab--on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge > 0 && <span className="med-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ════════════════ CONTENT ════════════════ */}
      <main className="staff-content">

        {/* ══ VALIDAÇÃO MÉDICA — cards por requisição ══ */}
        {tab === 'validacao' && (
          <div className="med-section">
            <div className="med-toolbar">
              <div>
                <div className="med-stitle">Validação médica</div>
                <div className="med-ssub">Clique numa requisição para rever todos os resultados e assinar</div>
              </div>
              <span className="med-count">{Object.keys(byReqVal).length} requisiç{Object.keys(byReqVal).length !== 1 ? 'ões' : 'ão'}</span>
            </div>

            {valLoading && <div className="med-loading"><div className="med-loading-bar" /></div>}

            {!valLoading && Object.keys(byReqVal).length === 0 && (
              <div className="med-empty">
                <div className="med-empty-icon">✓</div>
                <div className="med-empty-title">Sem resultados para validar</div>
                <div className="med-empty-sub">Todos os resultados foram validados</div>
              </div>
            )}

            <div className="med-req-list">
              {Object.entries(byReqVal).map(([reqNum, items], i) => {
                const hasCrit = items.some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo')
                const utente  = items[0]?.utenteNome ?? ''
                const date    = items[0] ? fmtDate(items[0].createdAt) : ''

                return (
                  <motion.div key={reqNum}
                    className={`med-req-card${hasCrit ? ' med-req-card--crit' : ''}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setValReqPanel(reqNum); setValObs(''); setValErr(''); setValSuccess('') }}>

                    <div className="med-req-card-hd">
                      <div className="med-req-left">
                        <span className="med-req-num">{reqNum}</span>
                        <span className="med-req-utente">{utente}</span>
                        <span className="med-req-amostra">{items[0]?.codigoAmostra}</span>
                      </div>
                      <div className="med-req-right">
                        {hasCrit && <span className="med-crit-chip">⬆ crítico</span>}
                        <span className="med-req-count">{items.length} análise{items.length !== 1 ? 's' : ''}</span>
                        <span className="med-req-arrow">→</span>
                      </div>
                    </div>

                    <div className="med-req-tags">
                      {items.map(r => (
                        <span key={r._id} className="med-req-tag"
                          style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '14', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                          {r.analise.nome}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ CRÍTICOS ══ */}
        {tab === 'criticos' && (
          <div className="med-section">
            <div className="med-toolbar">
              <div>
                <div className="med-stitle">Resultados críticos</div>
                <div className="med-ssub">Alertas que requerem atenção imediata</div>
              </div>
            </div>

            {critLoading && <div className="med-loading"><div className="med-loading-bar" /></div>}
            {!critLoading && criticos.length === 0 && (
              <div className="med-empty">
                <div className="med-empty-icon">✓</div>
                <div className="med-empty-title">Sem alertas críticos</div>
              </div>
            )}

            <div className="med-req-list">
              {criticos.map((r, i) => (
                <motion.div key={r._id} className="med-crit-card"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}>
                  <div className="med-crit-card-hd">
                    <span className="med-crit-dot" />
                    <span className="med-req-utente">{r.utenteNome}</span>
                    <span className="med-req-num">{r.requisicaoNumero}</span>
                  </div>
                  <div className="med-crit-card-body">
                    <div className="med-crit-analise">{r.analise.nome}</div>
                    <div className="med-crit-valor" style={{ color: FLAG_COLOR[r.flag] }}>
                      {r.valor ?? '—'} {r.unidade}
                    </div>
                    <div className="med-crit-flag" style={{ background: FLAG_COLOR[r.flag] + '18', color: FLAG_COLOR[r.flag] }}>
                      {FLAG_LABEL[r.flag]}
                    </div>
                  </div>
                  {r.validacaoTecnica && (
                    <div className="med-crit-tec">
                      Validado por {r.validacaoTecnica.nome} em {fmtDate(r.validacaoTecnica.dataHora)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ══ REQUISIÇÕES ══ */}
        {tab === 'requisicoes' && (
          <div className="med-section">
            <div className="med-toolbar">
              <div>
                <div className="med-stitle">Requisições</div>
                <div className="med-ssub">Todas as requisições associadas à sua conta</div>
              </div>
              <input className="med-search" placeholder="utente · número…"
                value={reqSearch} onChange={e => setReqSearch(e.target.value)} />
              <div className="med-filter-row">
                {(['todas', 'registada', 'em_curso', 'concluida', 'cancelada'] as const).map(f => (
                  <button key={f}
                    className={`med-filter${reqFilter === f ? ' med-filter--on' : ''}`}
                    onClick={() => setReqFilter(f)}>
                    {f === 'todas' ? 'Todas' : REQ_ESTADO_LABEL[f as ReqEstado]}
                  </button>
                ))}
              </div>
            </div>

            {reqLoading && <div className="med-loading"><div className="med-loading-bar" /></div>}
            {!reqLoading && reqs.length === 0 && (
              <div className="med-empty">
                <div className="med-empty-icon">=</div>
                <div className="med-empty-title">Sem requisições</div>
                <button className="med-btn med-btn--primary" onClick={() => navigate('/modulo/2')}>+ criar requisição</button>
              </div>
            )}

            <div className="med-req-list">
              {reqs.map((req, i) => (
                <motion.div key={req._id} className={`med-req-card med-req-card--req${req.urgente ? ' med-req-card--urgente' : ''}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}>
                  <div className="med-req-card-hd">
                    <div className="med-req-left">
                      <span className="med-req-num">{req.numeroRequisicao}</span>
                      <span className="med-req-utente">{req.utenteNome}</span>
                      {req.urgente && <span className="med-urgente-chip">URGENTE</span>}
                    </div>
                    <div className="med-req-right">
                      <span className="med-req-estado"
                        style={{ background: REQ_ESTADO_COLOR[req.estado] + '14', color: REQ_ESTADO_COLOR[req.estado] }}>
                        {REQ_ESTADO_LABEL[req.estado]}
                      </span>
                      <span className="med-req-date">{fmtDate(req.createdAt)}</span>
                    </div>
                  </div>
                  <div className="med-req-tags">
                    {req.analises.map((a, ai) => (
                      <span key={ai} className="med-req-tag"
                        style={{ background: (CAT_COLOR[a.categoria] ?? '#888') + '14', color: CAT_COLOR[a.categoria] ?? '#888' }}>
                        {a.nome}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ════════ PAINEL VALIDAÇÃO MÉDICA ════════ */}
      <AnimatePresence>
        {valReqPanel && (
          <motion.aside className="med-side-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className={`med-panel-hd${(byReqVal[valReqPanel] ?? []).some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo') ? ' med-panel-hd--crit' : ''}`}>
              <button className="med-panel-back" onClick={() => { setValReqPanel(null); setValObs(''); setValSuccess(''); setValErr('') }}>← fechar</button>
              <div>
                <div className="med-panel-label">Validação médica</div>
                <div className="med-panel-sub">{valReqPanel} · {(byReqVal[valReqPanel] ?? [])[0]?.utenteNome}</div>
              </div>
            </div>

            <div className="med-panel-body">
              {/* resultados com possibilidade de validar um a um */}
              <div className="med-val-results">
                {(byReqVal[valReqPanel] ?? []).map(r => {
                  const isCrit = r.flag === 'critico_alto' || r.flag === 'critico_baixo'
                  return (
                    <div key={r._id} className={`med-result-card${isCrit ? ' med-result-card--crit' : ''}`}
                      style={{ borderColor: FLAG_COLOR[r.flag] + '28' }}>
                      <div className="med-result-top">
                        <div className="med-result-info">
                          <span className="med-result-nome">{r.analise.nome}</span>
                          <span className="med-cat-tag" style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '18', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                            {r.analise.categoria}
                          </span>
                        </div>
                        <button className="med-btn-validar-um"
                          disabled={valSaving !== null}
                          onClick={e => { e.stopPropagation(); validarUm(r) }}>
                          {valSaving === r._id ? '…' : '✓'}
                        </button>
                      </div>
                      <div className="med-result-val-big" style={{ color: FLAG_COLOR[r.flag] }}>
                        {r.valor ?? '—'}
                        {r.unidade && <span className="med-result-unit"> {r.unidade}</span>}
                      </div>
                      <div className="med-result-row2">
                        <span className="med-flag-badge" style={{ background: FLAG_COLOR[r.flag] + '18', color: FLAG_COLOR[r.flag] }}>
                          {FLAG_LABEL[r.flag]}
                        </span>
                        {(r.refMin !== undefined || r.refMax !== undefined) && (
                          <span className="med-result-ref">ref: {r.refMin ?? '–'} – {r.refMax ?? '–'} {r.unidade}</span>
                        )}
                      </div>
                      {r.validacaoTecnica && (
                        <div className="med-result-tec">
                          Validado tecnicamente por {r.validacaoTecnica.nome}
                        </div>
                      )}
                      {r.observacoes && <div className="med-result-obs">{r.observacoes}</div>}
                    </div>
                  )
                })}
              </div>

              {valSuccess && <div className="med-success">{valSuccess}</div>}
              {valErr     && <div className="med-err">{valErr}</div>}

              {!valSuccess && (
                <div className="med-val-action">
                  <div className="med-ff">
                    <label className="med-lbl">Observações clínicas <span className="med-opt">(opcional)</span></label>
                    <textarea className="med-input med-textarea" rows={3}
                      value={valObs} onChange={e => setValObs(e.target.value)}
                      placeholder="Notas clínicas, recomendações, diagnóstico diferencial…" />
                  </div>
                  <button className="med-btn med-btn--validar-all"
                    disabled={valSaving !== null}
                    onClick={validarTodos}>
                    {valSaving === 'all' ? 'a validar…'
                      : `✓ Validar e assinar todos (${(byReqVal[valReqPanel] ?? []).length}) — ${user?.nome}`}
                  </button>
                  <button className="med-btn med-btn--pdf"
                    onClick={() => printPDF(valReqPanel!, byReqVal[valReqPanel] ?? [])}>
                    ↓ Exportar PDF com todos os resultados
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  )
}
