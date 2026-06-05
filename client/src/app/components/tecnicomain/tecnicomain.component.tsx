import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import NotificationBell from '../../../components/NotificationBell'
import '../staffportal/staffportal.css'
import './tecnicomain.component.css'

/* ─── utils ─── */
function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-PT') }
function fmtH(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleString('pt-PT', { dateStyle:'short', timeStyle:'short' }) }
function saudacao() { const h = new Date().getHours(); return h<12?'Bom dia':h<19?'Boa tarde':'Boa noite' }
function primeiroNome(nome: string) { return nome.replace(/^(Tec\.|Dr\.|Enf\.)\s+/i,'').split(' ')[0] }

/* ─── tipos ─── */
type TecTab = 'recepcao' | 'analise' | 'validacao'
type FlagResultado = 'pendente'|'normal'|'alto'|'baixo'|'critico_alto'|'critico_baixo'
type EstadoAmostra = 'aguarda_colheita'|'colhida'|'em_transito'|'recebida'|'rejeitada'

interface IAmostra {
  _id: string; codigoAmostra: string; requisicaoNumero: string
  utenteNome: string; utenteProcesso: string
  tubos: { tipo: string; analises: string[] }[]
  tipoColheita: 'presencial'|'domiciliaria'
  estado: EstadoAmostra; createdAt: string
  dataHoraColheita?: string
}
interface IResultado {
  _id: string; codigoResultado: string; codigoAmostra: string
  requisicaoNumero: string; utenteNome: string
  analise: { codigo: string; nome: string; categoria: string }
  valor?: string; unidade?: string; refMin?: number; refMax?: number
  flag: FlagResultado; estado: string
  equipamento?: string; observacoes?: string
  validacaoTecnica?: { nome: string; dataHora: string; observacoes?: string }
  createdAt: string
}
interface IStats {
  pendente: number; em_processamento: number; disponivel: number
  validado_tecnico: number; validado_medico: number
  criticos: number; criticosPorValidar: number
}
interface IAmostraStats { aguarda: number; em_transito: number; recebida: number }

/* ─── helpers ─── */
const FLAG_LABEL: Record<FlagResultado, string> = {
  pendente:'Pendente', normal:'Normal', alto:'Alto ↑', baixo:'Baixo ↓',
  critico_alto:'⬆ Crítico', critico_baixo:'⬇ Crítico',
}
const FLAG_COLOR: Record<FlagResultado, string> = {
  pendente:'#888', normal:'#2E7A50', alto:'#C87800', baixo:'#0064B4',
  critico_alto:'#C8001A', critico_baixo:'#C8001A',
}
const CAT_COLOR: Record<string, string> = {
  hematologia:'#5A64C8', bioquímica:'#3A8ABF', endocrinologia:'#C87800',
  imunologia:'#9060C8', microbiologia:'#C8001A', urina:'#2E7A50',
  coagulação:'#C87830', marcadores:'#6A6A68',
}
const TUBO_COR: Record<string, string> = {
  edta:'#9B59B6', citrato:'#3498DB', gel:'#F1C40F', urina:'#95A5A6', outro:'#BDC3C7',
}
const TUBO_LBL: Record<string, string> = { edta:'EDTA', citrato:'Citrato', gel:'Gel/SST', urina:'Urina', outro:'Outro' }

/* valores de referência default por código de análise */
const REFS: Record<string, { unidade: string; refMin?: number; refMax?: number }> = {
  BIO01:{ unidade:'mg/dL',   refMin:70,   refMax:100  },
  BIO02:{ unidade:'mg/dL',   refMin:10,   refMax:50   },
  BIO03:{ unidade:'mg/dL',   refMin:0.6,  refMax:1.2  },
  BIO04:{ unidade:'mg/dL',   refMin:2.4,  refMax:5.7  },
  BIO05:{ unidade:'mEq/L',   refMin:136,  refMax:145  },
  BIO06:{ unidade:'mg/L',    refMin:0,    refMax:5.0  },
  BIO07:{ unidade:'U/L',     refMin:7,    refMax:56   },
  BIO08:{ unidade:'U/L',     refMin:0,    refMax:60   },
  BIO09:{ unidade:'mg/dL',   refMin:0.2,  refMax:1.2  },
  BIO10:{ unidade:'g/dL',    refMin:6.0,  refMax:8.0  },
  BIO11:{ unidade:'U/L',     refMin:140,  refMax:280  },
  BIO12:{ unidade:'U/L',     refMin:30,   refMax:200  },
  BIO13:{ unidade:'mg/dL',   refMin:0,    refMax:200  },
  BIO14:{ unidade:'mg/dL',   refMin:0,    refMax:150  },
  END01:{ unidade:'mUI/L',   refMin:0.4,  refMax:4.0  },
  END02:{ unidade:'ng/dL',   refMin:0.8,  refMax:1.8  },
  END03:{ unidade:'µg/dL',   refMin:5,    refMax:25   },
  END04:{ unidade:'µUI/mL',  refMin:2,    refMax:25   },
  COA02:{ unidade:'µg/mL',   refMin:0,    refMax:0.5  },
  HEM01:{ unidade:'10³/µL',  refMin:4.0,  refMax:10.0 },
  URI01:{ unidade:'',        refMin:undefined, refMax:undefined },
  MAR01:{ unidade:'ng/mL',   refMin:0,    refMax:4.0  },
  MAR02:{ unidade:'U/mL',    refMin:0,    refMax:35   },
  MAR03:{ unidade:'U/mL',    refMin:0,    refMax:37   },
  MAR04:{ unidade:'ng/mL',   refMin:0,    refMax:5.0  },
}

function autoFlag(valor: string, refMin?: number, refMax?: number): FlagResultado {
  const n = parseFloat(valor)
  if (isNaN(n)) return 'pendente'
  if (refMin === undefined && refMax === undefined) return 'normal'
  if (refMax !== undefined && n > refMax * 1.5) return 'critico_alto'
  if (refMin !== undefined && n < refMin * 0.5) return 'critico_baixo'
  if (refMax !== undefined && n > refMax) return 'alto'
  if (refMin !== undefined && n < refMin) return 'baixo'
  return 'normal'
}

/* ─── form state por resultado ─── */
interface IForm { valor: string; unidade: string; refMin: string; refMax: string; flag: FlagResultado; equipamento: string; observacoes: string }
const emptyForm = (r: IResultado): IForm => {
  const d = REFS[r.analise.codigo]
  return {
    valor: r.valor ?? '',
    unidade: r.unidade ?? d?.unidade ?? '',
    refMin: r.refMin !== undefined ? String(r.refMin) : (d?.refMin !== undefined ? String(d.refMin) : ''),
    refMax: r.refMax !== undefined ? String(r.refMax) : (d?.refMax !== undefined ? String(d.refMax) : ''),
    flag: r.flag,
    equipamento: r.equipamento ?? '',
    observacoes: r.observacoes ?? '',
  }
}

/* ══════════════════════════════════════════════════════ */
export default function TecnicomainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab,        setTab]       = useState<TecTab>('recepcao')
  const [stats,      setStats]     = useState<IStats | null>(null)
  const [aStats,     setAStats]    = useState<IAmostraStats>({ aguarda:0, em_transito:0, recebida:0 })
  const [loading,    setLoading]   = useState(true)

  /* receção */
  const [transito,   setTransito]  = useState<IAmostra[]>([])
  const [recebidas,  setRecebidas] = useState<IAmostra[]>([])
  const [aLoading,   setALoad]     = useState(false)
  const [savingAmId, setSavingAmId]= useState<string | null>(null)
  const [wlDone,     setWlDone]    = useState<Record<string, boolean>>({})

  /* análise */
  const [resultados, setResultados]= useState<IResultado[]>([])
  const [rTotal,     setRTotal]    = useState(0)
  const [rPage,      setRPage]     = useState(1)
  const [rSearch,    setRSearch]   = useState('')
  const [rDeb,       setRDeb]      = useState('')
  const [rLoading,   setRLoad]     = useState(false)
  const [expanded,   setExpanded]  = useState<string | null>(null)
  const [forms,      setForms]     = useState<Record<string, IForm>>({})
  const [savingR,    setSavingR]   = useState<string | null>(null)
  const [savedR,     setSavedR]    = useState<string | null>(null)

  /* validação */
  const [valList,    setValList]   = useState<IResultado[]>([])
  const [vTotal,     setVTotal]    = useState(0)
  const [vPage,      setVPage]     = useState(1)
  const [vLoading,   setVLoad]     = useState(false)
  const [vPanel,     setVPanel]    = useState<IResultado | null>(null)
  const [vObs,       setVObs]      = useState('')
  const [vSaving,    setVSaving]   = useState(false)
  const [vSuccess,   setVSuccess]  = useState('')
  const [vErr,       setVErr]      = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ─── loaders ─── */
  const loadStats = useCallback(async () => {
    try {
      const [rs, as] = await Promise.all([
        api.get('/resultados/stats'),
        api.get('/amostras/stats'),
      ])
      setStats(rs.data)
      setAStats({ aguarda: as.data.aguarda ?? 0, em_transito: as.data.em_transito ?? 0, recebida: as.data.recebida ?? 0 })
    } catch { /* */ }
  }, [])

  const loadRecepcao = useCallback(() => {
    setALoad(true)
    Promise.all([
      api.get('/amostras', { params: { estado: 'em_transito', atribuidoA: 'tecnico', limit: 30 } }),
      api.get('/amostras', { params: { estado: 'recebida',    atribuidoA: 'tecnico', limit: 30 } }),
    ]).then(([t, r]) => {
      setTransito(t.data.data ?? [])
      setRecebidas(r.data.data ?? [])
    }).finally(() => setALoad(false))
  }, [])

  const loadAnalise = useCallback(() => {
    setRLoad(true)
    api.get('/resultados', { params: { estado: 'pendente', search: rDeb, page: rPage, limit: 20 } })
      .then(r => { setResultados(r.data.data ?? []); setRTotal(r.data.total ?? 0) })
      .finally(() => setRLoad(false))
  }, [rDeb, rPage])

  const loadValidacao = useCallback(() => {
    setVLoad(true)
    api.get('/resultados', { params: { estado: 'resultado_disponivel', page: vPage, limit: 25 } })
      .then(r => { setValList(r.data.data ?? []); setVTotal(r.data.total ?? 0) })
      .finally(() => setVLoad(false))
  }, [vPage])

  /* initial */
  useEffect(() => {
    Promise.all([loadStats(), loadRecepcao()]).finally(() => setLoading(false))
    const id = setInterval(loadStats, 60_000)
    return () => clearInterval(id)
  }, [loadStats, loadRecepcao])

  useEffect(() => { if (tab === 'recepcao')  loadRecepcao() },  [tab, loadRecepcao])
  useEffect(() => { if (tab === 'analise')   loadAnalise() },   [tab, loadAnalise])
  useEffect(() => { if (tab === 'validacao') loadValidacao() }, [tab, loadValidacao])

  /* debounce */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setRDeb(rSearch); setRPage(1) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [rSearch])

  /* ─── actions ─── */

  /* confirmar recepção */
  const confirmarRecepcao = async (id: string) => {
    setSavingAmId(id)
    try {
      await api.put(`/amostras/${id}`, { estado: 'recebida' })
      setTransito(prev => prev.filter(a => a._id !== id))
      await loadStats()
      setTimeout(() => loadRecepcao(), 300)
    } catch { /* */ } finally { setSavingAmId(null) }
  }

  /* gerar worklist */
  const gerarWorklist = async (amostraId: string) => {
    setSavingAmId(amostraId)
    try {
      const r = await api.post(`/resultados/worklist/${amostraId}`)
      setWlDone(prev => ({ ...prev, [amostraId]: true }))
      await loadStats()
      if (r.data.created > 0) {
        setTimeout(() => { setTab('analise'); loadAnalise() }, 600)
      }
    } catch { /* */ } finally { setSavingAmId(null) }
  }

  /* abrir form resultado */
  const openResult = (r: IResultado) => {
    setExpanded(r._id)
    if (!forms[r._id]) setForms(prev => ({ ...prev, [r._id]: emptyForm(r) }))
  }

  /* atualizar campo do form */
  const setField = (id: string, k: keyof IForm, v: string) => {
    setForms(prev => {
      const f = { ...prev[id], [k]: v }
      /* auto flag quando muda valor, refMin ou refMax */
      if (k === 'valor' || k === 'refMin' || k === 'refMax') {
        f.flag = autoFlag(f.valor, parseFloat(f.refMin)||undefined, parseFloat(f.refMax)||undefined)
      }
      return { ...prev, [id]: f }
    })
  }

  /* guardar resultado */
  const guardarResultado = async (r: IResultado, concluir = false) => {
    const f = forms[r._id]
    if (!f) return
    setSavingR(r._id)
    try {
      const body: Record<string, unknown> = {
        valor:       f.valor || undefined,
        unidade:     f.unidade || undefined,
        refMin:      f.refMin ? parseFloat(f.refMin) : undefined,
        refMax:      f.refMax ? parseFloat(f.refMax) : undefined,
        flag:        f.flag,
        equipamento: f.equipamento || undefined,
        observacoes: f.observacoes || undefined,
      }
      if (concluir) body.estado = 'resultado_disponivel'
      await api.put(`/resultados/${r._id}`, body)
      setSavedR(r._id); setTimeout(() => setSavedR(null), 2000)
      if (concluir) {
        setResultados(prev => prev.filter(x => x._id !== r._id))
        setExpanded(null)
        await loadStats()
      } else {
        setResultados(prev => prev.map(x => x._id === r._id ? { ...x, ...body, flag: f.flag } : x))
      }
    } catch { /* */ } finally { setSavingR(null) }
  }

  /* validar tecnicamente */
  const validarTecnico = async () => {
    if (!vPanel) return
    setVSaving(true); setVErr('')
    try {
      await api.post(`/resultados/${vPanel._id}/validar-tecnico`, { observacoes: vObs || undefined })
      setVSuccess('Resultado validado e assinado.')
      setTimeout(() => {
        setVPanel(null); setVObs(''); setVSuccess('')
        setValList(prev => prev.filter(x => x._id !== vPanel._id))
        loadStats()
      }, 1200)
    } catch (e: any) {
      setVErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setVSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const rPages = Math.ceil(rTotal / 20)
  const vPages = Math.ceil(vTotal / 25)

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="staff-portal staff-portal--tecnico">

      {/* ── HEADER ── */}
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Técnico</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">técnico · {new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' })}</div>
          </div>
          <NotificationBell theme="light" />
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="staff-hero">
        <div>
          <div className="staff-greeting">{saudacao()}, <em>{primeiroNome(user?.nome ?? 'Técnico')}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => setTab('recepcao')}>receber amostras</button>
            <button className="staff-btn-ghost"   onClick={() => setTab('analise')}>inserir resultados</button>
          </div>
        </div>

        <div className="staff-kpis tec-kpis">
          <button className={`tec-kpi${aStats.em_transito > 0 ? ' tec-kpi--warn' : ''}`}
            onClick={() => setTab('recepcao')}>
            <div className="tec-kpi-icon tec-kpi-icon--warn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : aStats.em_transito}</div>
            <div className="tec-kpi-lbl">em trânsito</div>
            {aStats.em_transito > 0 && <div className="tec-kpi-hint">aguardam recepção</div>}
          </button>

          <button className="tec-kpi" onClick={() => setTab('recepcao')}>
            <div className="tec-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : aStats.recebida}</div>
            <div className="tec-kpi-lbl">recebidas</div>
          </button>

          <button className={`tec-kpi${(stats?.pendente ?? 0) > 0 ? ' tec-kpi--action' : ''}`}
            onClick={() => setTab('analise')}>
            <div className="tec-kpi-icon tec-kpi-icon--action">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41c.4-.3.51-.86.26-1.3l-1.87-3.23c-.25-.44-.79-.62-1.25-.42l-2.15.91c-.37-.26-.76-.49-1.17-.68l-.29-2.31C14.8 2.38 14.37 2 13.87 2h-3.73c-.5 0-.93.38-.99.88L8.86 5.19c-.41.19-.8.42-1.17.68L5.54 4.96c-.46-.2-1-.02-1.25.42L2.41 8.62c-.25.44-.14.99.26 1.3l1.86 1.41A7.343 7.343 0 0 0 4.5 12c0 .23.01.45.03.68l-1.86 1.41c-.4.3-.51.86-.26 1.3l1.87 3.23c.25.44.79.62 1.25.42l2.15-.91c.37.26.76.49 1.17.68l.29 2.31c.06.5.49.88.99.88h3.73c.5 0 .93-.38.99-.88l.29-2.31c.41-.19.8-.42 1.17-.68l2.15.91c.46.2 1 .02 1.25-.42l1.87-3.23c.25-.44.14-.99-.26-1.3l-1.86-1.41c.02-.23.03-.45.03-.68zm-7.46 3.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : (stats?.pendente ?? 0)}</div>
            <div className="tec-kpi-lbl">para analisar</div>
          </button>

          <button className={`tec-kpi${(stats?.disponivel ?? 0) > 0 ? ' tec-kpi--ready' : ''}`}
            onClick={() => setTab('validacao')}>
            <div className="tec-kpi-icon tec-kpi-icon--ready">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : (stats?.disponivel ?? 0)}</div>
            <div className="tec-kpi-lbl">aguardam validação</div>
          </button>
        </div>
      </section>

      {/* ── TABS ── */}
      <nav className="staff-tabs tec-tabs">
        {([
          { id:'recepcao',  label:'Recepção',          badge: aStats.em_transito },
          { id:'analise',   label:'Análise',            badge: stats?.pendente ?? 0 },
          { id:'validacao', label:'Validação Técnica',  badge: stats?.disponivel ?? 0 },
        ] as const).map(t => (
          <button key={t.id}
            className={`tec-tab${tab===t.id ? ' tec-tab--on' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge > 0 && <span className="tec-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ════════════════ CONTENT ════════════════ */}
      <main className="staff-content">

        {/* ══ RECEPÇÃO ══ */}
        {tab === 'recepcao' && (
          <div className="tec-two">

            {/* Em trânsito */}
            <div className="tec-section">
              <div className="tec-sh">
                <div>
                  <div className="tec-stitle">Em trânsito</div>
                  <div className="tec-ssub">Confirmar chegada ao laboratório</div>
                </div>
                <span className="tec-count">{transito.length}</span>
              </div>
              {aLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}
              {!aLoading && transito.length === 0 && (
                <div className="tec-empty-state">
                  <div className="tec-empty-icon">✓</div>
                  <div className="tec-empty-title">Sem amostras em trânsito</div>
                </div>
              )}
              <ul className="tec-list">
                {transito.map((am, i) => (
                  <motion.li key={am._id} className="tec-item"
                    initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.02 }}>
                    <div className="tec-row">
                      <div className="tec-tubos-preview">
                        {am.tubos.map((t,ti) => (
                          <div key={ti} className="tec-tubo-swatch" style={{ background: TUBO_COR[t.tipo]??'#95A5A6' }} title={TUBO_LBL[t.tipo]??t.tipo} />
                        ))}
                      </div>
                      <div className="tec-row-info">
                        <div className="tec-nome">{am.utenteNome}</div>
                        <div className="tec-meta">
                          <span className="tec-mono">{am.codigoAmostra}</span>
                          <span className="tec-sep">·</span>
                          <span className="tec-mono">{am.requisicaoNumero}</span>
                          {am.tipoColheita==='domiciliaria' && <span className="tec-dom-tag">domicílio</span>}
                        </div>
                      </div>
                      <button className="tec-btn tec-btn--receber"
                        disabled={savingAmId === am._id}
                        onClick={() => confirmarRecepcao(am._id)}>
                        {savingAmId === am._id ? '…' : '✓ Confirmar recepção'}
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Recebidas — gerar worklist */}
            <div className="tec-section">
              <div className="tec-sh">
                <div>
                  <div className="tec-stitle">Recebidas</div>
                  <div className="tec-ssub">Gerar worklist para iniciar análise</div>
                </div>
                <span className="tec-count">{recebidas.length}</span>
              </div>
              {aLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}
              {!aLoading && recebidas.length === 0 && (
                <div className="tec-empty-state">
                  <div className="tec-empty-icon">◎</div>
                  <div className="tec-empty-title">Sem amostras para processar</div>
                </div>
              )}
              <ul className="tec-list">
                {recebidas.map((am, i) => (
                  <motion.li key={am._id} className={`tec-item${wlDone[am._id] ? ' tec-item--done' : ''}`}
                    initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.02 }}>
                    <div className="tec-row">
                      <div className="tec-tubos-preview">
                        {am.tubos.map((t,ti) => (
                          <div key={ti} className="tec-tubo-swatch" style={{ background: TUBO_COR[t.tipo]??'#95A5A6' }} title={TUBO_LBL[t.tipo]??t.tipo} />
                        ))}
                      </div>
                      <div className="tec-row-info">
                        <div className="tec-nome">{am.utenteNome}</div>
                        <div className="tec-meta">
                          <span className="tec-mono">{am.codigoAmostra}</span>
                          <span className="tec-sep">·</span>
                          <span className="tec-mono">{am.requisicaoNumero}</span>
                        </div>
                        <div className="tec-tubos-chips">
                          {am.tubos.map((t,ti) => (
                            <span key={ti} className="tec-chip"
                              style={{ background: (TUBO_COR[t.tipo]??'#888')+'18', color: TUBO_COR[t.tipo]??'#888', borderColor: (TUBO_COR[t.tipo]??'#888')+'30' }}>
                              {TUBO_LBL[t.tipo]??t.tipo} ({t.analises.length})
                            </span>
                          ))}
                        </div>
                      </div>
                      {wlDone[am._id] ? (
                        <div className="tec-wl-done">✓ Worklist gerada</div>
                      ) : (
                        <button className="tec-btn tec-btn--worklist"
                          disabled={savingAmId === am._id}
                          onClick={() => gerarWorklist(am._id)}>
                          {savingAmId === am._id ? 'a gerar…' : '▶ Gerar worklist'}
                        </button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ══ ANÁLISE ══ */}
        {tab === 'analise' && (
          <div className="tec-section">
            <div className="tec-toolbar">
              <div>
                <div className="tec-stitle">Resultados pendentes de análise</div>
                <div className="tec-ssub">Insira os valores obtidos nos equipamentos</div>
              </div>
              <input className="tec-search" placeholder="pesquisar análise · utente · amostra…"
                value={rSearch} onChange={e => setRSearch(e.target.value)} />
              <span className="tec-count">{rTotal} resultado{rTotal!==1?'s':''}</span>
            </div>

            {rLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}

            {!rLoading && resultados.length === 0 && (
              <div className="tec-empty-state">
                <div className="tec-empty-icon tec-empty-icon--ok">✓</div>
                <div className="tec-empty-title tec-empty-title--ok">Sem resultados pendentes</div>
                <div className="tec-empty-sub">Todos os resultados foram analisados</div>
              </div>
            )}

            <ul className="tec-list">
              <AnimatePresence initial={false}>
                {resultados.map((r, i) => {
                  const isOpen = expanded === r._id
                  const f = forms[r._id]
                  const isCrit = f ? (f.flag === 'critico_alto' || f.flag === 'critico_baixo') : false
                  return (
                    <motion.li key={r._id}
                      className={`tec-item${isOpen ? ' tec-item--open' : ''}${savedR === r._id ? ' tec-item--saved' : ''}${isCrit ? ' tec-item--crit' : ''}`}
                      initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.012 }}>

                      <button className="tec-row tec-row--btn" onClick={() => isOpen ? setExpanded(null) : openResult(r)}>
                        <div className="tec-row-info" style={{ flex:1 }}>
                          <div className="tec-nome-row">
                            <span className="tec-nome">{r.analise.nome}</span>
                            <span className="tec-cat-tag" style={{ background:(CAT_COLOR[r.analise.categoria]??'#888')+'18', color: CAT_COLOR[r.analise.categoria]??'#888' }}>
                              {r.analise.categoria}
                            </span>
                          </div>
                          <div className="tec-meta">
                            <span>{r.utenteNome}</span>
                            <span className="tec-sep">·</span>
                            <span className="tec-mono">{r.codigoAmostra}</span>
                            <span className="tec-sep">·</span>
                            <span className="tec-mono">{r.requisicaoNumero}</span>
                          </div>
                        </div>
                        <div className="tec-row-r">
                          {f?.valor && (
                            <span className="tec-valor-preview" style={{ color: FLAG_COLOR[f.flag] }}>
                              {f.valor} {f.unidade}
                            </span>
                          )}
                          <span className="tec-data">{fmtDate(r.createdAt)}</span>
                          <span className="tec-chev">{isOpen ? '↑' : '↓'}</span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && f && (
                          <motion.div className="tec-form-wrap"
                            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}>

                            <div className="tec-form">
                              {/* valor destaque */}
                              {f.valor && (
                                <div className="tec-result-preview" style={{ borderColor: FLAG_COLOR[f.flag]+'40' }}>
                                  <span className="tec-result-val" style={{ color: FLAG_COLOR[f.flag] }}>
                                    {f.valor}
                                  </span>
                                  <span className="tec-result-unit">{f.unidade}</span>
                                  <span className="tec-flag-badge" style={{ background: FLAG_COLOR[f.flag]+'18', color: FLAG_COLOR[f.flag] }}>
                                    {FLAG_LABEL[f.flag]}
                                  </span>
                                </div>
                              )}

                              <div className="tec-form-grid">
                                <div className="tec-ff">
                                  <label className="tec-lbl">Valor *</label>
                                  <input className="tec-input tec-input--valor"
                                    type="number" step="any"
                                    value={f.valor} onChange={e => setField(r._id,'valor',e.target.value)}
                                    placeholder="ex: 5.2" autoFocus />
                                </div>
                                <div className="tec-ff">
                                  <label className="tec-lbl">Unidade</label>
                                  <input className="tec-input"
                                    value={f.unidade} onChange={e => setField(r._id,'unidade',e.target.value)}
                                    placeholder="ex: mg/dL" />
                                </div>
                                <div className="tec-ff">
                                  <label className="tec-lbl">Ref. mín</label>
                                  <input className="tec-input" type="number" step="any"
                                    value={f.refMin} onChange={e => setField(r._id,'refMin',e.target.value)} />
                                </div>
                                <div className="tec-ff">
                                  <label className="tec-lbl">Ref. máx</label>
                                  <input className="tec-input" type="number" step="any"
                                    value={f.refMax} onChange={e => setField(r._id,'refMax',e.target.value)} />
                                </div>
                                <div className="tec-ff">
                                  <label className="tec-lbl">Flag</label>
                                  <select className="tec-input"
                                    value={f.flag} onChange={e => setField(r._id,'flag',e.target.value)}>
                                    {(['normal','alto','baixo','critico_alto','critico_baixo','pendente'] as FlagResultado[]).map(fl => (
                                      <option key={fl} value={fl}>{FLAG_LABEL[fl]}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="tec-ff">
                                  <label className="tec-lbl">Equipamento</label>
                                  <input className="tec-input"
                                    value={f.equipamento} onChange={e => setField(r._id,'equipamento',e.target.value)}
                                    placeholder="ex: AU5800" />
                                </div>
                              </div>

                              <div className="tec-ff">
                                <label className="tec-lbl">Observações <span className="tec-opt">(opcional)</span></label>
                                <textarea className="tec-input tec-textarea" rows={2}
                                  value={f.observacoes} onChange={e => setField(r._id,'observacoes',e.target.value)} />
                              </div>

                              {savedR === r._id && <div className="tec-success">✓ Guardado</div>}

                              <div className="tec-form-btns">
                                <button className="tec-btn tec-btn--concluir"
                                  disabled={!f.valor || savingR === r._id}
                                  onClick={() => guardarResultado(r, true)}>
                                  {savingR === r._id ? 'a guardar…' : '✓ Concluir análise'}
                                </button>
                                <button className="tec-btn tec-btn--guardar"
                                  disabled={savingR === r._id}
                                  onClick={() => guardarResultado(r, false)}>
                                  guardar rascunho
                                </button>
                                <button className="tec-btn" onClick={() => setExpanded(null)}>fechar</button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>

            {rPages > 1 && (
              <div className="tec-pag">
                <button className="tec-pag-btn" disabled={rPage<=1} onClick={()=>setRPage(p=>p-1)}>‹</button>
                <span className="tec-pag-info">{rPage} / {rPages}</span>
                <button className="tec-pag-btn" disabled={rPage>=rPages} onClick={()=>setRPage(p=>p+1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* ══ VALIDAÇÃO TÉCNICA ══ */}
        {tab === 'validacao' && (
          <div className="tec-section">
            <div className="tec-toolbar">
              <div>
                <div className="tec-stitle">Validação técnica</div>
                <div className="tec-ssub">Resultados com análise concluída aguardando a sua assinatura</div>
              </div>
              <span className="tec-count">{vTotal} resultado{vTotal!==1?'s':''}</span>
            </div>

            {vLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}

            {!vLoading && valList.length === 0 && (
              <div className="tec-empty-state">
                <div className="tec-empty-icon tec-empty-icon--ok">✓</div>
                <div className="tec-empty-title tec-empty-title--ok">Tudo validado</div>
                <div className="tec-empty-sub">Sem resultados pendentes de validação técnica</div>
              </div>
            )}

            <ul className="tec-list">
              {valList.map((r, i) => {
                const isCrit = r.flag === 'critico_alto' || r.flag === 'critico_baixo'
                return (
                  <motion.li key={r._id}
                    className={`tec-item${isCrit ? ' tec-item--crit' : ''}`}
                    initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.015 }}>
                    <div className="tec-val-row" onClick={() => { setVPanel(r); setVObs(''); setVErr(''); setVSuccess('') }}>
                      {isCrit && <span className="tec-crit-pulse" />}
                      <div className="tec-row-info" style={{ flex:1 }}>
                        <div className="tec-nome-row">
                          <span className="tec-nome">{r.analise.nome}</span>
                          <span className="tec-cat-tag" style={{ background:(CAT_COLOR[r.analise.categoria]??'#888')+'18', color: CAT_COLOR[r.analise.categoria]??'#888' }}>
                            {r.analise.categoria}
                          </span>
                        </div>
                        <div className="tec-meta">
                          <span>{r.utenteNome}</span>
                          <span className="tec-sep">·</span>
                          <span className="tec-mono">{r.codigoAmostra}</span>
                        </div>
                      </div>
                      <div className="tec-row-r">
                        {r.valor && (
                          <span className="tec-valor-preview" style={{ color: FLAG_COLOR[r.flag] }}>
                            {r.valor} {r.unidade}
                          </span>
                        )}
                        <span className="tec-flag-badge" style={{ background: FLAG_COLOR[r.flag]+'18', color: FLAG_COLOR[r.flag] }}>
                          {FLAG_LABEL[r.flag]}
                        </span>
                        <span className="tec-row-action">validar →</span>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ul>

            {vPages > 1 && (
              <div className="tec-pag">
                <button className="tec-pag-btn" disabled={vPage<=1} onClick={()=>setVPage(p=>p-1)}>‹</button>
                <span className="tec-pag-info">{vPage} / {vPages}</span>
                <button className="tec-pag-btn" disabled={vPage>=vPages} onClick={()=>setVPage(p=>p+1)}>›</button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ════════ PANEL VALIDAÇÃO TÉCNICA ════════ */}
      <AnimatePresence>
        {vPanel && (
          <motion.aside className="tec-val-panel"
            initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
            transition={{ type:'spring', damping:30, stiffness:280 }}>

            <div className={`tec-panel-hd${(vPanel.flag==='critico_alto'||vPanel.flag==='critico_baixo') ? ' tec-panel-hd--crit' : ''}`}>
              <button className="tec-panel-back" onClick={() => { setVPanel(null); setVObs(''); setVSuccess(''); setVErr('') }}>← fechar</button>
              <div className="tec-panel-label">{vPanel.analise.nome}</div>
              <div className="tec-panel-sub">{vPanel.utenteNome} · {vPanel.requisicaoNumero}</div>
              {(vPanel.flag==='critico_alto'||vPanel.flag==='critico_baixo') && (
                <div className="tec-panel-crit-tag">
                  <span className="tec-crit-pulse tec-crit-pulse--sm" />{FLAG_LABEL[vPanel.flag]}
                </div>
              )}
            </div>

            <div className="tec-panel-body">
              {/* resultado */}
              <div className="tec-result-card" style={{ borderColor: FLAG_COLOR[vPanel.flag]+'40' }}>
                <div className="tec-result-top">
                  <span className="tec-cat-tag" style={{ background:(CAT_COLOR[vPanel.analise.categoria]??'#888')+'18', color: CAT_COLOR[vPanel.analise.categoria]??'#888' }}>
                    {vPanel.analise.categoria}
                  </span>
                  <span className="tec-flag-badge tec-flag-badge--lg" style={{ background: FLAG_COLOR[vPanel.flag]+'18', color: FLAG_COLOR[vPanel.flag] }}>
                    {FLAG_LABEL[vPanel.flag]}
                  </span>
                </div>
                <div className="tec-result-val-big" style={{ color: FLAG_COLOR[vPanel.flag] }}>
                  {vPanel.valor ?? '—'}
                  {vPanel.unidade && <span className="tec-result-unit"> {vPanel.unidade}</span>}
                </div>
                {(vPanel.refMin !== undefined || vPanel.refMax !== undefined) && (
                  <div className="tec-result-ref">
                    Ref: {vPanel.refMin ?? '–'} – {vPanel.refMax ?? '–'} {vPanel.unidade}
                  </div>
                )}
              </div>

              {/* info */}
              <div className="tec-panel-grid">
                <DField l="Utente"     v={vPanel.utenteNome} />
                <DField l="Amostra"    v={vPanel.codigoAmostra} />
                <DField l="Requisição" v={vPanel.requisicaoNumero} />
                <DField l="Código"     v={vPanel.codigoResultado} />
                {vPanel.equipamento && <DField l="Equipamento" v={vPanel.equipamento} />}
                <DField l="Data" v={fmtDate(vPanel.createdAt)} />
                {vPanel.observacoes && <DField l="Observações" v={vPanel.observacoes} />}
              </div>

              {vSuccess && <div className="tec-success">{vSuccess}</div>}
              {vErr     && <div className="tec-err">{vErr}</div>}

              {!vSuccess && (
                <div className="tec-val-action">
                  <div className="tec-lbl-section">Validação Técnica</div>
                  <div className="tec-ff">
                    <label className="tec-lbl">Observações <span className="tec-opt">(opcional)</span></label>
                    <textarea className="tec-input tec-textarea" rows={3}
                      value={vObs} onChange={e => setVObs(e.target.value)}
                      placeholder="Notas técnicas, condições analíticas, desvios de procedimento…" />
                  </div>
                  <button className="tec-btn tec-btn--validar" disabled={vSaving} onClick={validarTecnico}>
                    {vSaving ? 'a validar…' : `✓ Assinar e Validar — ${user?.nome}`}
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

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="tec-dfield">
      <div className="tec-lbl">{l}</div>
      <div className="tec-dfield-v">{v}</div>
    </div>
  )
}
