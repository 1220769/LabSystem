import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import NotificationBell from '../../../components/NotificationBell'
import '../staffportal/staffportal.css'
import './enfermeirmain.component.css'

/* ── utils ── */
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}
function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}
function primeiroNome(nome: string) {
  return nome.replace(/^(Enf\.|Enfa\.|Dr\.|Dra\.|Tec\.)\s+/i, '').split(' ')[0]
}

/* ── types ── */
type EstadoAmostra = 'aguarda_colheita' | 'colhida' | 'em_transito' | 'recebida' | 'rejeitada'
type Tab = 'colheitas' | 'agendar' | 'utentes'

interface IAmostra {
  _id: string; codigoAmostra: string; requisicaoNumero: string
  utenteNome: string; utenteProcesso: string
  tubos: { tipo: string; analises: string[] }[]
  tipoColheita: 'presencial' | 'domiciliaria'
  moradaColheita?: string; dataHoraColheita?: string
  tecnico?: string; temperatura?: number
  estado: EstadoAmostra; motivoRejeicao?: string; observacoes?: string; createdAt: string
}
interface IReqOpt {
  _id: string; numeroRequisicao: string
  utenteNome: string; utenteProcesso: string; utente: string
  analises: { codigo: string; nome: string }[]
  urgente?: boolean
}
interface IUtente {
  _id: string; numeroProcesso: string; nome: string; sns: string; nif: string
  dataNascimento: string; contacto: string; email?: string; genero?: string
}
interface IStats { aguarda: number; colhida: number; em_transito: number; recebida: number; domiciliarias: number }

/* ── tube & estado helpers ── */
const ANALISE_TUBO: Record<string, string> = {
  HEM01:'edta', HEM02:'edta', MIC02:'edta',
  COA01:'citrato', COA02:'citrato',
  BIO01:'gel', BIO02:'gel', BIO03:'gel', BIO04:'gel', BIO05:'gel',
  BIO06:'gel', BIO07:'gel', BIO08:'gel', BIO09:'gel', BIO10:'gel',
  BIO11:'gel', BIO12:'gel', BIO13:'gel', BIO14:'gel',
  END01:'gel', END02:'gel', END03:'gel', END04:'gel',
  IMU01:'gel', IMU02:'gel', IMU03:'gel',
  MAR01:'gel', MAR02:'gel', MAR03:'gel', MAR04:'gel',
  MIC01:'urina', URI01:'urina', URI02:'urina',
}
const TUBO_COR: Record<string, string> = {
  edta:'#9B59B6', citrato:'#3498DB', gel:'#F1C40F', heparina:'#27AE60', urina:'#95A5A6', outro:'#BDC3C7',
}
const TUBO_LBL: Record<string, string> = {
  edta:'EDTA', citrato:'Citrato', gel:'Gel / SST', heparina:'Heparina', urina:'Urina', outro:'Outro',
}
const PIPELINE: EstadoAmostra[] = ['aguarda_colheita', 'colhida', 'em_transito', 'recebida']
const EST_LBL: Record<string, string> = {
  aguarda_colheita:'Aguarda colheita', colhida:'Colhida',
  em_transito:'Em trânsito', recebida:'Recebida', rejeitada:'Rejeitada',
}
const EST_COLOR: Record<string, string> = {
  aguarda_colheita:'#C87800', colhida:'#2D8B74',
  em_transito:'#0064B4', recebida:'rgba(26,18,8,0.45)', rejeitada:'#C8001A',
}

function buildTubos(analises: { codigo: string; nome: string }[]) {
  const g: Record<string, string[]> = {}
  for (const a of analises) {
    const t = ANALISE_TUBO[a.codigo] ?? 'gel'
    if (!g[t]) g[t] = []
    g[t].push(a.nome)
  }
  return Object.entries(g).map(([tipo, nomes]) => ({ tipo, analises: nomes }))
}

/* ══════════════════════════════════════════ */
export default function EnfermeiromainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab,       setTab]      = useState<Tab>('colheitas')
  const [amostras,  setAmostras] = useState<IAmostra[]>([])
  const [aTotal,    setATotal]   = useState(0)
  const [reqs,      setReqs]     = useState<IReqOpt[]>([])
  const [utentes,   setUtentes]  = useState<IUtente[]>([])
  const [stats,     setStats]    = useState<IStats>({ aguarda:0, colhida:0, em_transito:0, recebida:0, domiciliarias:0 })
  const [loading,   setLoading]  = useState(true)
  const [aLoading,  setALoad]    = useState(false)
  const [filtro,    setFiltro]   = useState<EstadoAmostra | 'todas'>('todas')
  const [search,    setSearch]   = useState('')
  const [debSearch, setDebSearch]= useState('')
  const [utenteQ,   setUtenteQ]  = useState('')
  const [expanded,  setExpanded] = useState<string | null>(null)
  const [saving,    setSaving]   = useState<string | null>(null) // id a guardar
  const [savedId,   setSavedId]  = useState<string | null>(null) // feedback

  /* form agendar */
  const [formReq,    setFormReq]    = useState<IReqOpt | null>(null)
  const [formTipo,   setFormTipo]   = useState<'presencial' | 'domiciliaria'>('presencial')
  const [formMorada, setFormMorada] = useState('')
  const [formData,   setFormData]   = useState('')
  const [formTemp,   setFormTemp]   = useState('')
  const [formObs,    setFormObs]    = useState('')
  const [formErr,    setFormErr]    = useState('')
  const [formOk,     setFormOk]     = useState('')
  const [rfSaving,   setRfSaving]   = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const utTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── loaders ── */
  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/amostras/stats')
      setStats(r.data)
    } catch { /* */ }
  }, [])

  const loadAmostras = useCallback((est: EstadoAmostra | 'todas' = filtro, q = debSearch) => {
    setALoad(true)
    const params: Record<string, string> = { limit: '50', atribuidoA: 'enfermeiro' }
    if (est !== 'todas') params.estado  = est
    if (q)               params.search  = q
    api.get('/amostras', { params })
      .then(r => { setAmostras(r.data.data ?? []); setATotal(r.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setALoad(false))
  }, [filtro, debSearch])

  const loadReqs = useCallback(async () => {
    try {
      const r = await api.get('/requisicoes', { params: { estado: 'pendente', limit: 60 } })
      setReqs(r.data.data ?? [])
    } catch { /* */ }
  }, [])

  /* initial load */
  useEffect(() => {
    Promise.all([loadStats(), loadReqs()]).finally(() => setLoading(false))
  }, [loadStats, loadReqs])

  useEffect(() => { loadAmostras() }, [loadAmostras])

  /* debounce search */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setDebSearch(search) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  /* debounce utente */
  useEffect(() => {
    if (!utenteQ.trim()) { setUtentes([]); return }
    if (utTimer.current) clearTimeout(utTimer.current)
    utTimer.current = setTimeout(() => {
      api.get('/utentes', { params: { search: utenteQ, limit: 20 } })
        .then(r => setUtentes(r.data.data ?? [])).catch(() => {})
    }, 350)
    return () => { if (utTimer.current) clearTimeout(utTimer.current) }
  }, [utenteQ])

  /* ── avançar estado ── */
  const avancar = async (id: string, estado: EstadoAmostra) => {
    setSaving(id)
    try {
      await api.put(`/amostras/${id}`, { estado })
      setAmostras(prev => prev.map(a => a._id === id ? { ...a, estado } : a))
      setSavedId(id)
      setTimeout(() => setSavedId(null), 2000)
      await loadStats()
    } catch { /* */ } finally { setSaving(null) }
  }

  /* ── criar colheita ── */
  const criarColheita = async () => {
    if (!formReq) { setFormErr('Selecione uma requisição.'); return }
    setFormErr(''); setRfSaving(true)
    try {
      const body: Record<string, unknown> = {
        requisicao:       formReq._id,
        requisicaoNumero: formReq.numeroRequisicao,
        utente:           formReq.utente,
        utenteNome:       formReq.utenteNome,
        utenteProcesso:   formReq.utenteProcesso,
        tubos:            buildTubos(formReq.analises),
        tipoColheita:     formTipo,
        observacoes:      formObs || undefined,
        dataHoraColheita: formData || undefined,
        temperatura:      formTemp ? parseFloat(formTemp) : undefined,
      }
      if (formTipo === 'domiciliaria') body.moradaColheita = formMorada
      await api.post('/amostras', body)
      setFormOk('Colheita registada com sucesso!')
      setFormReq(null); setFormTipo('presencial'); setFormMorada('')
      setFormObs(''); setFormData(''); setFormTemp('')
      await Promise.all([loadStats(), loadReqs()])
      loadAmostras('todas', '')
      setTimeout(() => { setTab('colheitas'); setFiltro('todas') }, 1000)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setFormErr(err.response?.data?.message ?? 'Erro ao registar.')
    } finally { setRfSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const urgentesCount = reqs.filter(r => r.urgente).length
  const pendentesCount = reqs.length

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="staff-portal staff-portal--enfermeiro">

      {/* ── HEADER ── */}
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong></div>
        <div className="staff-badge">Portal Enfermagem</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">enfermeiro · {new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' })}</div>
          </div>
          <NotificationBell theme="light" />
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="staff-hero">
        <div>
          <div className="staff-greeting">
            {saudacao()}, <em>{primeiroNome(user?.nome ?? 'Enfermeiro')}</em>
          </div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => { setTab('agendar'); setFormOk('') }}>
              + agendar colheita
            </button>
            <button className="staff-btn-ghost" onClick={() => setTab('utentes')}>
              pesquisar utente
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="staff-kpis enf-kpis">
          <button className="enf-kpi" onClick={() => { setTab('colheitas'); setFiltro('aguarda_colheita'); setSearch('') }}>
            <div className="enf-kpi-icon enf-kpi-icon--warn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 11H8v-2h4V7h2v4h4v2h-4v4h-2v-4z"/></svg>
            </div>
            <span className="enf-kpi-num">{loading ? '—' : stats.aguarda}</span>
            <span className="enf-kpi-lbl">Aguardam colheita</span>
          </button>

          <button className="enf-kpi" onClick={() => { setTab('colheitas'); setFiltro('em_transito'); setSearch('') }}>
            <div className="enf-kpi-icon enf-kpi-icon--transit">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            </div>
            <span className="enf-kpi-num">{loading ? '—' : stats.em_transito}</span>
            <span className="enf-kpi-lbl">Em trânsito</span>
          </button>

          <button className="enf-kpi enf-kpi--dest" onClick={() => { setTab('colheitas'); setFiltro('todas'); setSearch('') }}>
            <div className="enf-kpi-icon enf-kpi-icon--dom">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
            <span className="enf-kpi-num">{loading ? '—' : stats.domiciliarias}</span>
            <span className="enf-kpi-lbl">Domiciliárias activas</span>
          </button>

          <button className={`enf-kpi${urgentesCount > 0 ? ' enf-kpi--alert' : ''}`} onClick={() => { setTab('agendar'); setFormOk('') }}>
            <div className={`enf-kpi-icon${urgentesCount > 0 ? ' enf-kpi-icon--alert' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            </div>
            <span className={`enf-kpi-num${urgentesCount > 0 ? ' enf-kpi-num--alert' : ''}`}>{loading ? '—' : pendentesCount}</span>
            <span className="enf-kpi-lbl">
              Requisições pendentes
              {urgentesCount > 0 && <span className="enf-kpi-hint"> · {urgentesCount} urgentes</span>}
            </span>
          </button>
        </div>
      </section>

      {/* ── TABS ── */}
      <nav className="staff-tabs enf-tabs">
        <button className={`enf-tab${tab==='colheitas' ? ' enf-tab--on' : ''}`} onClick={() => setTab('colheitas')}>
          Colheitas
          {stats.aguarda > 0 && <span className="enf-tab-badge">{stats.aguarda}</span>}
        </button>
        <button className={`enf-tab${tab==='agendar' ? ' enf-tab--on' : ''}`} onClick={() => { setTab('agendar'); setFormOk('') }}>
          Agendar
          {pendentesCount > 0 && <span className="enf-tab-badge">{pendentesCount}</span>}
        </button>
        <button className={`enf-tab${tab==='utentes' ? ' enf-tab--on' : ''}`} onClick={() => setTab('utentes')}>
          Utentes
        </button>
      </nav>

      {/* ════════════════ CONTENT ════════════════ */}
      <main className="staff-content">

        {/* ══ COLHEITAS ══ */}
        {tab === 'colheitas' && (
          <div className="enf-section">
            <div className="enf-toolbar">
              <div className="enf-filtros">
                {(['todas','aguarda_colheita','colhida','em_transito','recebida','rejeitada'] as const).map(f => (
                  <button key={f}
                    className={`enf-fbtn${filtro===f ? ' enf-fbtn--on' : ''}`}
                    onClick={() => { setFiltro(f); loadAmostras(f, debSearch) }}>
                    {f === 'todas' ? 'Todas' : EST_LBL[f]}
                  </button>
                ))}
              </div>
              <input className="enf-search" placeholder="pesquisar utente, código, requisição…"
                value={search} onChange={e => setSearch(e.target.value)} />
              <span className="enf-count">{aTotal} amostra{aTotal !== 1 ? 's' : ''}</span>
            </div>

            {aLoading && <div className="enf-loading"><div className="enf-loading-bar" /></div>}

            {!aLoading && amostras.length === 0 && (
              <div className="enf-empty-state">
                <div className="enf-empty-icon">◎</div>
                <div className="enf-empty-title">
                  {filtro === 'todas' ? 'Sem amostras registadas' : `Sem amostras com estado "${EST_LBL[filtro]}"`}
                </div>
                {filtro === 'aguarda_colheita' && (
                  <button className="enf-empty-cta" onClick={() => setTab('agendar')}>+ agendar colheita</button>
                )}
              </div>
            )}

            {!aLoading && amostras.length > 0 && (
              <ul className="enf-list">
                <AnimatePresence initial={false}>
                  {amostras.map((am, i) => {
                    const open = expanded === am._id
                    const pipIdx = PIPELINE.indexOf(am.estado)
                    return (
                      <motion.li key={am._id}
                        className={`enf-item${open ? ' enf-item--open' : ''}${savedId === am._id ? ' enf-item--saved' : ''}`}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.015 }}>

                        <button className="enf-row" onClick={() => setExpanded(open ? null : am._id)}>
                          <div className="enf-row-l">
                            {/* tubos como swatches */}
                            <div className="enf-tubos-preview">
                              {am.tubos.map((t,ti) => (
                                <div key={ti} className="enf-tubo-swatch" style={{ background: TUBO_COR[t.tipo]??'#95A5A6' }}
                                  title={TUBO_LBL[t.tipo]??t.tipo} />
                              ))}
                            </div>
                            <div className="enf-row-info">
                              <div className="enf-nome">
                                {am.utenteNome}
                                {am.tipoColheita==='domiciliaria' && <span className="enf-dom-tag">domicílio</span>}
                              </div>
                              <div className="enf-meta">
                                <span className="enf-mono">{am.codigoAmostra}</span>
                                <span className="enf-sep">·</span>
                                <span className="enf-mono">{am.requisicaoNumero}</span>
                                <span className="enf-sep">·</span>
                                <span>{fmtDate(am.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="enf-row-r">
                            {am.estado !== 'rejeitada' && (
                              <div className="enf-mini-pipeline">
                                {PIPELINE.map((s, si) => (
                                  <div key={s} className="enf-mini-step">
                                    <div className={`enf-mini-dot${si <= pipIdx ? ' enf-mini-dot--done' : ''}${si === pipIdx ? ' enf-mini-dot--active' : ''}`} />
                                    {si < PIPELINE.length - 1 && (
                                      <div className={`enf-mini-line${si < pipIdx ? ' enf-mini-line--done' : ''}`} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <span className="enf-est" style={{ background: EST_COLOR[am.estado]+'18', color: EST_COLOR[am.estado] }}>
                              {EST_LBL[am.estado]}
                            </span>
                            <span className="enf-chev">{open ? '↑' : '↓'}</span>
                          </div>
                        </button>

                        <AnimatePresence>
                          {open && (
                            <motion.div className="enf-detail"
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>

                              {/* pipeline completo */}
                              {am.estado !== 'rejeitada' && (
                                <div className="enf-pipeline">
                                  {PIPELINE.map((s, si) => {
                                    const done   = si <= pipIdx
                                    const active = si === pipIdx
                                    return (
                                      <div key={s} className="enf-pip-wrap">
                                        <div className="enf-pip-step">
                                          <div className={`enf-pip-dot${done ? ' enf-pip-dot--done' : ''}${active ? ' enf-pip-dot--active' : ''}`} />
                                          <span className={`enf-pip-lbl${active ? ' enf-pip-lbl--active' : ''}`}>{EST_LBL[s]}</span>
                                        </div>
                                        {si < PIPELINE.length - 1 && (
                                          <div className={`enf-pip-conn${si < pipIdx ? ' enf-pip-conn--done' : ''}`} />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* guia de tubos */}
                              <div className="enf-tubos-guia">
                                <div className="enf-field-lbl">Guia de tubos</div>
                                <div className="enf-tubos-list">
                                  {am.tubos.map((t,ti) => (
                                    <div key={ti} className="enf-tubo-card">
                                      <div className="enf-tubo-cap" style={{ background: TUBO_COR[t.tipo]??'#95A5A6' }} />
                                      <div className="enf-tubo-body">
                                        <div className="enf-tubo-tipo">{TUBO_LBL[t.tipo]??t.tipo}</div>
                                        <div className="enf-tubo-analises">{t.analises.join(' · ')}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* info grid */}
                              <div className="enf-detail-grid">
                                <DField l="Processo"  v={am.utenteProcesso} />
                                <DField l="Tipo"      v={am.tipoColheita === 'domiciliaria' ? 'Domiciliária' : 'Presencial'} />
                                {am.dataHoraColheita && <DField l="Data / hora"   v={fmtDateTime(am.dataHoraColheita)} />}
                                {am.tecnico          && <DField l="Técnico"       v={am.tecnico} />}
                                {am.temperatura !== undefined && <DField l="Temperatura" v={`${am.temperatura} °C`} />}
                                {am.moradaColheita   && <DField l="Morada"        v={am.moradaColheita} />}
                              </div>

                              {am.observacoes    && <div className="enf-obs-box">{am.observacoes}</div>}
                              {am.motivoRejeicao && <div className="enf-obs-box enf-obs-box--rej">Motivo de rejeição: {am.motivoRejeicao}</div>}

                              {savedId === am._id && (
                                <div className="enf-success">✓ Estado actualizado com sucesso</div>
                              )}

                              {/* acções */}
                              <div className="enf-acoes">
                                {am.estado === 'aguarda_colheita' && (
                                  <button className="enf-btn enf-btn--colher" disabled={saving === am._id}
                                    onClick={() => avancar(am._id, 'colhida')}>
                                    {saving === am._id ? 'a guardar…' : '✓ Marcar como colhida'}
                                  </button>
                                )}
                                {am.estado === 'colhida' && (
                                  <button className="enf-btn enf-btn--transito" disabled={saving === am._id}
                                    onClick={() => avancar(am._id, 'em_transito')}>
                                    {saving === am._id ? 'a guardar…' : '→ Enviar para laboratório'}
                                  </button>
                                )}
                                {am.estado === 'em_transito' && (
                                  <button className="enf-btn enf-btn--receber" disabled={saving === am._id}
                                    onClick={() => avancar(am._id, 'recebida')}>
                                    {saving === am._id ? 'a guardar…' : '✓ Confirmar recepção'}
                                  </button>
                                )}
                                {(am.estado === 'aguarda_colheita' || am.estado === 'colhida') && (
                                  <button className="enf-btn enf-btn--rejeitar" disabled={saving === am._id}
                                    onClick={() => avancar(am._id, 'rejeitada')}>
                                    Rejeitar
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        )}

        {/* ══ AGENDAR ══ */}
        {tab === 'agendar' && (
          <div className="enf-two">
            {/* lista de requisições */}
            <div className="enf-section">
              <div className="enf-sh">
                <span className="enf-stitle">Requisições sem colheita</span>
                <span className="enf-count">{pendentesCount} pendente{pendentesCount !== 1 ? 's' : ''}</span>
              </div>
              {reqs.length === 0 ? (
                <div className="enf-empty-state">
                  <div className="enf-empty-icon">✓</div>
                  <div className="enf-empty-title">Sem requisições pendentes</div>
                </div>
              ) : (
                <ul className="enf-list">
                  {reqs.map(r => (
                    <li key={r._id} className={`enf-item${formReq?._id===r._id ? ' enf-item--sel' : ''}`}>
                      <button className="enf-row" onClick={() => { setFormReq(r); setFormOk(''); setFormErr('') }}>
                        <div className="enf-row-info" style={{ flex: 1 }}>
                          <div className="enf-nome">
                            {r.utenteNome}
                            {r.urgente && <span className="enf-urgente-tag">urgente</span>}
                          </div>
                          <div className="enf-meta">
                            <span className="enf-mono">{r.numeroRequisicao}</span>
                            <span className="enf-sep">·</span>
                            <span>{r.analises.length} análise{r.analises.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="enf-chips-row">
                            {r.analises.slice(0,3).map(a => (
                              <span key={a.codigo} className="enf-chip">{a.nome}</span>
                            ))}
                            {r.analises.length > 3 && <span className="enf-chip enf-chip--more">+{r.analises.length-3}</span>}
                          </div>
                        </div>
                        <span className="enf-chev">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* form registar colheita */}
            <div className="enf-section">
              <div className="enf-sh"><span className="enf-stitle">Registar colheita</span></div>
              {!formReq ? (
                <div className="enf-empty-state">
                  <div className="enf-empty-icon">←</div>
                  <div className="enf-empty-title">Selecione uma requisição</div>
                  <div className="enf-empty-sub">Clique numa requisição da lista para registar a colheita</div>
                </div>
              ) : (
                <div className="enf-form">
                  {formErr && <div className="enf-msg enf-msg--err">{formErr}</div>}
                  {formOk  && <div className="enf-msg enf-msg--ok">{formOk}</div>}

                  {/* utente + preview tubos */}
                  <div className="enf-form-utente">
                    <div className="enf-form-utente-avatar">
                      {formReq.utenteNome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="enf-nome">{formReq.utenteNome}</div>
                      <div className="enf-meta enf-mono">{formReq.numeroRequisicao} · {formReq.utenteProcesso}</div>
                    </div>
                    <button className="enf-form-clear" onClick={() => { setFormReq(null); setFormErr(''); setFormOk('') }}>×</button>
                  </div>

                  {/* guia de tubos prevista */}
                  <div className="enf-tubos-guia enf-tubos-guia--form">
                    <div className="enf-field-lbl">Tubos necessários</div>
                    <div className="enf-tubos-list">
                      {buildTubos(formReq.analises).map((t,i) => (
                        <div key={i} className="enf-tubo-card">
                          <div className="enf-tubo-cap" style={{ background: TUBO_COR[t.tipo]??'#95A5A6' }} />
                          <div className="enf-tubo-body">
                            <div className="enf-tubo-tipo">{TUBO_LBL[t.tipo]??t.tipo}</div>
                            <div className="enf-tubo-analises">{t.analises.join(' · ')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* tipo colheita */}
                  <div className="enf-field">
                    <label className="enf-field-lbl">Tipo de colheita</label>
                    <div className="enf-tipo-btns">
                      <button
                        className={`enf-tipo-btn${formTipo==='presencial' ? ' enf-tipo-btn--on' : ''}`}
                        onClick={() => setFormTipo('presencial')}>
                        Presencial
                      </button>
                      <button
                        className={`enf-tipo-btn${formTipo==='domiciliaria' ? ' enf-tipo-btn--on' : ''}`}
                        onClick={() => setFormTipo('domiciliaria')}>
                        Domiciliária
                      </button>
                    </div>
                  </div>

                  {formTipo === 'domiciliaria' && (
                    <div className="enf-field">
                      <label className="enf-field-lbl">Morada de colheita</label>
                      <input className="enf-input" value={formMorada}
                        onChange={e => setFormMorada(e.target.value)} placeholder="Rua, nº, código postal, localidade" />
                    </div>
                  )}

                  <div className="enf-field-row">
                    <div className="enf-field">
                      <label className="enf-field-lbl">Data / hora <span className="enf-opt">(opcional)</span></label>
                      <input className="enf-input" type="datetime-local"
                        value={formData} onChange={e => setFormData(e.target.value)} />
                    </div>
                    <div className="enf-field">
                      <label className="enf-field-lbl">Temperatura °C <span className="enf-opt">(opcional)</span></label>
                      <input className="enf-input" type="number" step="0.1" min="0" max="45"
                        value={formTemp} onChange={e => setFormTemp(e.target.value)} placeholder="ex: 36.5" />
                    </div>
                  </div>

                  <div className="enf-field">
                    <label className="enf-field-lbl">Observações <span className="enf-opt">(opcional)</span></label>
                    <textarea className="enf-textarea" value={formObs}
                      onChange={e => setFormObs(e.target.value)} rows={3}
                      placeholder="Notas clínicas, condições especiais…" />
                  </div>

                  <div className="enf-form-btns">
                    <button className="enf-btn enf-btn--save" disabled={rfSaving} onClick={criarColheita}>
                      {rfSaving ? 'a registar…' : '✓ Registar colheita'}
                    </button>
                    <button className="enf-btn" onClick={() => { setFormReq(null); setFormErr(''); setFormOk('') }}>
                      cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ UTENTES ══ */}
        {tab === 'utentes' && (
          <div className="enf-section">
            <div className="enf-toolbar">
              <div className="enf-search-wrap">
                <svg className="enf-search-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input className="enf-search enf-search--icon enf-search--wide"
                  placeholder="pesquisar por nome, NIF ou SNS…"
                  value={utenteQ} onChange={e => setUtenteQ(e.target.value)} autoFocus />
              </div>
              {utentes.length > 0 && <span className="enf-count">{utentes.length} resultado{utentes.length!==1?'s':''}</span>}
            </div>

            {utenteQ.trim().length === 0 ? (
              <div className="enf-empty-state">
                <div className="enf-empty-icon">◉</div>
                <div className="enf-empty-title">Pesquise um utente</div>
                <div className="enf-empty-sub">Introduza nome, NIF ou SNS para aceder à ficha</div>
              </div>
            ) : utentes.length === 0 ? (
              <div className="enf-empty-state">
                <div className="enf-empty-icon">◉</div>
                <div className="enf-empty-title">Nenhum utente encontrado</div>
              </div>
            ) : (
              <ul className="enf-list">
                {utentes.map((u, i) => (
                  <motion.li key={u._id} className="enf-item"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}>
                    <div className="enf-row enf-row--utente">
                      <div className="enf-avatar">{u.nome.split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()}</div>
                      <div className="enf-row-info" style={{ flex: 1 }}>
                        <div className="enf-nome">{u.nome}</div>
                        <div className="enf-meta">
                          <span className="enf-mono">Proc. {u.numeroProcesso}</span>
                          <span className="enf-sep">·</span>
                          <span>SNS {u.sns}</span>
                          <span className="enf-sep">·</span>
                          <span>NIF {u.nif}</span>
                        </div>
                        <div className="enf-meta" style={{ marginTop: 2 }}>
                          Nasc. {fmtDate(u.dataNascimento)}
                          {u.contacto && <> · {u.contacto}</>}
                          {u.email && <> · {u.email}</>}
                        </div>
                      </div>
                      <div className="enf-ut-actions">
                        <button className="enf-btn enf-btn--sm" onClick={() => {
                          const opt: IReqOpt = { _id:'', numeroRequisicao:'', utenteNome: u.nome, utenteProcesso: u.numeroProcesso, utente: u._id, analises: [] }
                          setTab('agendar')
                          setFormOk(''); setFormErr('')
                          // pré-seleccionar o utente no form via a primeira req dele
                          const req = reqs.find(r => r.utente === u._id)
                          if (req) setFormReq(req)
                          else setFormReq(opt)
                        }}>
                          + colheita
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>
    </div>
  )
}

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="enf-dfield">
      <div className="enf-field-lbl">{l}</div>
      <div className="enf-dfield-v">{v}</div>
    </div>
  )
}
