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
function saudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite' }
function primeiroNome(nome: string) { return nome.replace(/^(Tec\.|Dr\.|Enf\.)\s+/i, '').split(' ')[0] }

/* ─── tipos ─── */
type TecTab = 'recepcao' | 'analise' | 'validacao'
type FlagResultado = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
type EstadoAmostra = 'aguarda_colheita' | 'colhida' | 'em_transito' | 'recebida' | 'rejeitada'

interface IAmostra {
  _id: string; codigoAmostra: string; requisicaoNumero: string
  utenteNome: string; utenteProcesso: string
  tubos: { tipo: string; analises: string[] }[]
  tipoColheita: 'presencial' | 'domiciliaria'
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
  pendente: 'Pendente', normal: 'Normal', alto: 'Alto ↑', baixo: 'Baixo ↓',
  critico_alto: '⬆ Crítico', critico_baixo: '⬇ Crítico',
}
const FLAG_COLOR: Record<FlagResultado, string> = {
  pendente: '#888', normal: '#2E7A50', alto: '#C87800', baixo: '#0064B4',
  critico_alto: '#C8001A', critico_baixo: '#C8001A',
}
const CAT_COLOR: Record<string, string> = {
  hematologia: '#5A64C8', bioquímica: '#3A8ABF', endocrinologia: '#C87800',
  imunologia: '#9060C8', microbiologia: '#C8001A', urina: '#2E7A50',
  coagulação: '#C87830', marcadores: '#6A6A68',
}
const TUBO_COR: Record<string, string> = {
  edta: '#9B59B6', citrato: '#3498DB', gel: '#F1C40F', urina: '#95A5A6', outro: '#BDC3C7',
}
const TUBO_LBL: Record<string, string> = { edta: 'EDTA', citrato: 'Citrato', gel: 'Gel/SST', urina: 'Urina', outro: 'Outro' }

const REFS: Record<string, { unidade: string; refMin?: number; refMax?: number }> = {
  BIO01: { unidade: 'mg/dL', refMin: 70, refMax: 100 },
  BIO02: { unidade: 'mg/dL', refMin: 10, refMax: 50 },
  BIO03: { unidade: 'mg/dL', refMin: 0.6, refMax: 1.2 },
  BIO04: { unidade: 'mg/dL', refMin: 2.4, refMax: 5.7 },
  BIO05: { unidade: 'mEq/L', refMin: 136, refMax: 145 },
  BIO06: { unidade: 'mg/L', refMin: 0, refMax: 5.0 },
  BIO07: { unidade: 'U/L', refMin: 7, refMax: 56 },
  BIO08: { unidade: 'U/L', refMin: 0, refMax: 60 },
  BIO09: { unidade: 'mg/dL', refMin: 0.2, refMax: 1.2 },
  BIO10: { unidade: 'g/dL', refMin: 6.0, refMax: 8.0 },
  BIO11: { unidade: 'U/L', refMin: 140, refMax: 280 },
  BIO12: { unidade: 'U/L', refMin: 30, refMax: 200 },
  BIO13: { unidade: 'mg/dL', refMin: 0, refMax: 200 },
  BIO14: { unidade: 'mg/dL', refMin: 0, refMax: 150 },
  END01: { unidade: 'mUI/L', refMin: 0.4, refMax: 4.0 },
  END02: { unidade: 'ng/dL', refMin: 0.8, refMax: 1.8 },
  END03: { unidade: 'µg/dL', refMin: 5, refMax: 25 },
  END04: { unidade: 'µUI/mL', refMin: 2, refMax: 25 },
  COA02: { unidade: 'µg/mL', refMin: 0, refMax: 0.5 },
  HEM01: { unidade: '10³/µL', refMin: 4.0, refMax: 10.0 },
  URI01: { unidade: '' },
  MAR01: { unidade: 'ng/mL', refMin: 0, refMax: 4.0 },
  MAR02: { unidade: 'U/mL', refMin: 0, refMax: 35 },
  MAR03: { unidade: 'U/mL', refMin: 0, refMax: 37 },
  MAR04: { unidade: 'ng/mL', refMin: 0, refMax: 5.0 },
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

function groupByReq(list: IResultado[]): Record<string, IResultado[]> {
  return list.reduce<Record<string, IResultado[]>>((acc, r) => {
    if (!acc[r.requisicaoNumero]) acc[r.requisicaoNumero] = []
    acc[r.requisicaoNumero].push(r)
    return acc
  }, {})
}

/* ══════════════════════════════════════════════════════ */
export default function TecnicomainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab, setTab]       = useState<TecTab>('recepcao')
  const [stats, setStats]   = useState<IStats | null>(null)
  const [aStats, setAStats] = useState<IAmostraStats>({ aguarda: 0, em_transito: 0, recebida: 0 })
  const [loading, setLoading] = useState(true)

  /* receção */
  const [transito,   setTransito]   = useState<IAmostra[]>([])
  const [recebidas,  setRecebidas]  = useState<IAmostra[]>([])
  const [aLoading,   setALoad]      = useState(false)
  const [savingAmId, setSavingAmId] = useState<string | null>(null)
  const [wlDone,     setWlDone]     = useState<Record<string, boolean>>({})

  /* análise */
  const [resultados, setResultados] = useState<IResultado[]>([])
  const [rTotal,     setRTotal]     = useState(0)
  const [rPage,      setRPage]      = useState(1)
  const [rSearch,    setRSearch]    = useState('')
  const [rDeb,       setRDeb]       = useState('')
  const [rLoading,   setRLoad]      = useState(false)
  /* painel requisição — análise */
  const [reqPanel,   setReqPanel]   = useState<string | null>(null)
  const [reqForms,   setReqForms]   = useState<Record<string, IForm>>({})
  const [savingReq,  setSavingReq]  = useState(false)
  const [reqMsg,     setReqMsg]     = useState('')
  const [reqErr,     setReqErr]     = useState('')

  /* validação técnica */
  const [valList,    setValList]    = useState<IResultado[]>([])
  const [vTotal,     setVTotal]     = useState(0)
  const [vPage,      setVPage]      = useState(1)
  const [vLoading,   setVLoad]      = useState(false)
  /* painel requisição — validação */
  const [vReqPanel,  setVReqPanel]  = useState<string | null>(null)
  const [vObs,       setVObs]       = useState('')
  const [vSaving,    setVSaving]    = useState(false)
  const [vSuccess,   setVSuccess]   = useState('')
  const [vErr,       setVErr]       = useState('')

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
      api.get('/amostras', { params: { estado: 'recebida', atribuidoA: 'tecnico', limit: 30 } }),
    ]).then(([t, r]) => {
      setTransito(t.data.data ?? [])
      setRecebidas(r.data.data ?? [])
    }).finally(() => setALoad(false))
  }, [])

  const loadAnalise = useCallback(() => {
    setRLoad(true)
    api.get('/resultados', { params: { estado: 'pendente', search: rDeb, page: rPage, limit: 100 } })
      .then(r => { setResultados(r.data.data ?? []); setRTotal(r.data.total ?? 0) })
      .finally(() => setRLoad(false))
  }, [rDeb, rPage])

  const loadValidacao = useCallback(() => {
    setVLoad(true)
    api.get('/resultados', { params: { estado: 'resultado_disponivel', page: vPage, limit: 100 } })
      .then(r => { setValList(r.data.data ?? []); setVTotal(r.data.total ?? 0) })
      .finally(() => setVLoad(false))
  }, [vPage])

  useEffect(() => {
    Promise.all([loadStats(), loadRecepcao()]).finally(() => setLoading(false))
    const id = setInterval(loadStats, 60_000)
    return () => clearInterval(id)
  }, [loadStats, loadRecepcao])

  useEffect(() => { if (tab === 'recepcao')  loadRecepcao() }, [tab, loadRecepcao])
  useEffect(() => { if (tab === 'analise')   loadAnalise() },  [tab, loadAnalise])
  useEffect(() => { if (tab === 'validacao') loadValidacao() }, [tab, loadValidacao])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setRDeb(rSearch); setRPage(1) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [rSearch])

  /* ─── receção ─── */
  const confirmarRecepcao = async (id: string) => {
    setSavingAmId(id)
    try {
      await api.put(`/amostras/${id}`, { estado: 'recebida' })
      setTransito(prev => prev.filter(a => a._id !== id))
      await loadStats()
      setTimeout(() => loadRecepcao(), 300)
    } catch { /* */ } finally { setSavingAmId(null) }
  }

  const gerarWorklist = async (amostraId: string) => {
    setSavingAmId(amostraId)
    try {
      const r = await api.post(`/resultados/worklist/${amostraId}`)
      setWlDone(prev => ({ ...prev, [amostraId]: true }))
      await loadStats()
      if (r.data.created > 0) setTimeout(() => { setTab('analise'); loadAnalise() }, 600)
    } catch { /* */ } finally { setSavingAmId(null) }
  }

  /* ─── análise — painel por requisição ─── */
  const byReqAnalise = groupByReq(resultados)

  const openReqPanel = (reqNum: string) => {
    const items = byReqAnalise[reqNum] ?? []
    const forms: Record<string, IForm> = {}
    items.forEach(r => { forms[r._id] = emptyForm(r) })
    setReqForms(forms)
    setReqPanel(reqNum)
    setReqMsg(''); setReqErr('')
  }

  const setReqField = (id: string, k: keyof IForm, v: string) => {
    setReqForms(prev => {
      const f = { ...prev[id], [k]: v }
      if (k === 'valor' || k === 'refMin' || k === 'refMax') {
        f.flag = autoFlag(f.valor, parseFloat(f.refMin) || undefined, parseFloat(f.refMax) || undefined)
      }
      return { ...prev, [id]: f }
    })
  }

  const guardarTudo = async (concluir: boolean) => {
    const items = byReqAnalise[reqPanel!] ?? []
    if (concluir) {
      const missing = items.filter(r => !reqForms[r._id]?.valor.trim())
      if (missing.length > 0) {
        setReqErr(`Faltam valores: ${missing.map(r => r.analise.nome).join(', ')}`)
        return
      }
    }
    setSavingReq(true); setReqErr(''); setReqMsg('')
    try {
      await Promise.all(items.map(r => {
        const f = reqForms[r._id]
        return api.put(`/resultados/${r._id}`, {
          valor:       f.valor       || undefined,
          unidade:     f.unidade     || undefined,
          refMin:      f.refMin ? parseFloat(f.refMin) : undefined,
          refMax:      f.refMax ? parseFloat(f.refMax) : undefined,
          flag:        f.flag,
          equipamento: f.equipamento || undefined,
          observacoes: f.observacoes || undefined,
          ...(concluir ? { estado: 'resultado_disponivel' } : {}),
        })
      }))
      if (concluir) {
        setReqMsg('✓ Análise concluída — resultados enviados para validação')
        setResultados(prev => prev.filter(r => r.requisicaoNumero !== reqPanel))
        await loadStats()
        setTimeout(() => { setReqPanel(null); setReqMsg('') }, 1800)
      } else {
        setReqMsg('✓ Rascunho guardado')
      }
    } catch { setReqErr('Erro ao guardar. Tente novamente.') }
    finally { setSavingReq(false) }
  }

  /* ─── validação técnica — painel por requisição ─── */
  const byReqVal = groupByReq(valList)

  const validarRequisicao = async (obsGlobal?: string) => {
    const items = byReqVal[vReqPanel!] ?? []
    setVSaving(true); setVErr(''); setVSuccess('')
    try {
      await Promise.all(items.map(r =>
        api.post(`/resultados/${r._id}/validar-tecnico`, { observacoes: obsGlobal || undefined })
      ))
      setVSuccess(`✓ ${items.length} resultado${items.length !== 1 ? 's' : ''} validado${items.length !== 1 ? 's' : ''} e assinados`)
      setValList(prev => prev.filter(r => r.requisicaoNumero !== vReqPanel))
      await loadStats()
      setTimeout(() => { setVReqPanel(null); setVObs(''); setVSuccess('') }, 1800)
    } catch (e: any) {
      setVErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setVSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const rPages = Math.ceil(rTotal / 100)
  const vPages = Math.ceil(vTotal / 100)

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
            <div className="staff-user-role">técnico · {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
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
          <button className={`tec-kpi${aStats.em_transito > 0 ? ' tec-kpi--warn' : ''}`} onClick={() => setTab('recepcao')}>
            <div className="tec-kpi-icon tec-kpi-icon--warn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : aStats.em_transito}</div>
            <div className="tec-kpi-lbl">em trânsito</div>
            {aStats.em_transito > 0 && <div className="tec-kpi-hint">aguardam recepção</div>}
          </button>

          <button className="tec-kpi" onClick={() => setTab('recepcao')}>
            <div className="tec-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" /></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : aStats.recebida}</div>
            <div className="tec-kpi-lbl">recebidas</div>
          </button>

          <button className={`tec-kpi${(stats?.pendente ?? 0) > 0 ? ' tec-kpi--action' : ''}`} onClick={() => setTab('analise')}>
            <div className="tec-kpi-icon tec-kpi-icon--action">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41c.4-.3.51-.86.26-1.3l-1.87-3.23c-.25-.44-.79-.62-1.25-.42l-2.15.91c-.37-.26-.76-.49-1.17-.68l-.29-2.31C14.8 2.38 14.37 2 13.87 2h-3.73c-.5 0-.93.38-.99.88L8.86 5.19c-.41.19-.8.42-1.17.68L5.54 4.96c-.46-.2-1-.02-1.25.42L2.41 8.62c-.25.44-.14.99.26 1.3l1.86 1.41A7.343 7.343 0 0 0 4.5 12c0 .23.01.45.03.68l-1.86 1.41c-.4.3-.51.86-.26 1.3l1.87 3.23c.25.44.79.62 1.25.42l2.15-.91c.37.26.76.49 1.17.68l.29 2.31c.06.5.49.88.99.88h3.73c.5 0 .93-.38.99-.88l.29-2.31c.41-.19.8-.42 1.17-.68l2.15.91c.46.2 1 .02 1.25-.42l1.87-3.23c.25-.44.14-.99-.26-1.3l-1.86-1.41c.02-.23.03-.45.03-.68zm-7.46 3.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" /></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : (stats?.pendente ?? 0)}</div>
            <div className="tec-kpi-lbl">para analisar</div>
          </button>

          <button className={`tec-kpi${(stats?.disponivel ?? 0) > 0 ? ' tec-kpi--ready' : ''}`} onClick={() => setTab('validacao')}>
            <div className="tec-kpi-icon tec-kpi-icon--ready">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </div>
            <div className="tec-kpi-val">{loading ? '—' : (stats?.disponivel ?? 0)}</div>
            <div className="tec-kpi-lbl">aguardam validação</div>
          </button>
        </div>
      </section>

      {/* ── TABS ── */}
      <nav className="staff-tabs tec-tabs">
        {([
          { id: 'recepcao',  label: 'Recepção',         badge: aStats.em_transito },
          { id: 'analise',   label: 'Análise',           badge: stats?.pendente ?? 0 },
          { id: 'validacao', label: 'Validação Técnica', badge: stats?.disponivel ?? 0 },
        ] as const).map(t => (
          <button key={t.id} className={`tec-tab${tab === t.id ? ' tec-tab--on' : ''}`} onClick={() => setTab(t.id)}>
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
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <div className="tec-row">
                      <div className="tec-tubos-preview">
                        {am.tubos.map((t, ti) => (
                          <div key={ti} className="tec-tubo-swatch" style={{ background: TUBO_COR[t.tipo] ?? '#95A5A6' }} title={TUBO_LBL[t.tipo] ?? t.tipo} />
                        ))}
                      </div>
                      <div className="tec-row-info">
                        <div className="tec-nome">{am.utenteNome}</div>
                        <div className="tec-meta">
                          <span className="tec-mono">{am.codigoAmostra}</span>
                          <span className="tec-sep">·</span>
                          <span className="tec-mono">{am.requisicaoNumero}</span>
                          {am.tipoColheita === 'domiciliaria' && <span className="tec-dom-tag">domicílio</span>}
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
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <div className="tec-row">
                      <div className="tec-tubos-preview">
                        {am.tubos.map((t, ti) => (
                          <div key={ti} className="tec-tubo-swatch" style={{ background: TUBO_COR[t.tipo] ?? '#95A5A6' }} title={TUBO_LBL[t.tipo] ?? t.tipo} />
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
                          {am.tubos.map((t, ti) => (
                            <span key={ti} className="tec-chip"
                              style={{ background: (TUBO_COR[t.tipo] ?? '#888') + '18', color: TUBO_COR[t.tipo] ?? '#888', borderColor: (TUBO_COR[t.tipo] ?? '#888') + '30' }}>
                              {TUBO_LBL[t.tipo] ?? t.tipo} ({t.analises.length})
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

        {/* ══ ANÁLISE — cards agrupados por requisição ══ */}
        {tab === 'analise' && (
          <div className="tec-section">
            <div className="tec-toolbar">
              <div>
                <div className="tec-stitle">Resultados pendentes de análise</div>
                <div className="tec-ssub">Clique numa requisição para inserir todos os valores</div>
              </div>
              <input className="tec-search" placeholder="pesquisar utente · amostra · requisição…"
                value={rSearch} onChange={e => setRSearch(e.target.value)} />
              <span className="tec-count">{Object.keys(byReqAnalise).length} requisiç{Object.keys(byReqAnalise).length !== 1 ? 'ões' : 'ão'}</span>
            </div>

            {rLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}

            {!rLoading && Object.keys(byReqAnalise).length === 0 && (
              <div className="tec-empty-state">
                <div className="tec-empty-icon tec-empty-icon--ok">✓</div>
                <div className="tec-empty-title tec-empty-title--ok">Sem análises pendentes</div>
                <div className="tec-empty-sub">Todos os resultados foram analisados</div>
              </div>
            )}

            <div className="tec-req-list">
              <AnimatePresence initial={false}>
                {Object.entries(byReqAnalise).map(([reqNum, items], i) => {
                  const hasCrit = items.some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo')
                  const utente  = items[0]?.utenteNome ?? ''
                  const amostra = items[0]?.codigoAmostra ?? ''

                  return (
                    <motion.div key={reqNum}
                      className={`tec-req-card${hasCrit ? ' tec-req-card--crit' : ''}`}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => openReqPanel(reqNum)}>

                      <div className="tec-req-card-hd">
                        <div className="tec-req-card-left">
                          <span className="tec-req-num">{reqNum}</span>
                          <span className="tec-req-utente">{utente}</span>
                          <span className="tec-req-amostra">{amostra}</span>
                        </div>
                        <div className="tec-req-card-right">
                          {hasCrit && <span className="tec-crit-chip">⬆ crítico</span>}
                          <span className="tec-req-count">{items.length} análise{items.length !== 1 ? 's' : ''}</span>
                          <span className="tec-req-arrow">→</span>
                        </div>
                      </div>

                      <div className="tec-req-tags">
                        {items.map(r => (
                          <span key={r._id}
                            className={`tec-req-tag${r.flag === 'critico_alto' || r.flag === 'critico_baixo' ? ' tec-req-tag--crit' : ''}`}
                            style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '14', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                            {r.analise.nome}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {rPages > 1 && (
              <div className="tec-pag">
                <button className="tec-pag-btn" disabled={rPage <= 1} onClick={() => setRPage(p => p - 1)}>‹</button>
                <span className="tec-pag-info">{rPage} / {rPages}</span>
                <button className="tec-pag-btn" disabled={rPage >= rPages} onClick={() => setRPage(p => p + 1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* ══ VALIDAÇÃO TÉCNICA — cards agrupados por requisição ══ */}
        {tab === 'validacao' && (
          <div className="tec-section">
            <div className="tec-toolbar">
              <div>
                <div className="tec-stitle">Validação técnica</div>
                <div className="tec-ssub">Clique numa requisição para rever e assinar os resultados</div>
              </div>
              <span className="tec-count">{Object.keys(byReqVal).length} requisiç{Object.keys(byReqVal).length !== 1 ? 'ões' : 'ão'}</span>
            </div>

            {vLoading && <div className="tec-loading"><div className="tec-loading-bar" /></div>}

            {!vLoading && Object.keys(byReqVal).length === 0 && (
              <div className="tec-empty-state">
                <div className="tec-empty-icon tec-empty-icon--ok">✓</div>
                <div className="tec-empty-title tec-empty-title--ok">Tudo validado</div>
                <div className="tec-empty-sub">Sem resultados pendentes de validação técnica</div>
              </div>
            )}

            <div className="tec-req-list">
              {Object.entries(byReqVal).map(([reqNum, items], i) => {
                const hasCrit = items.some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo')
                const utente  = items[0]?.utenteNome ?? ''

                return (
                  <motion.div key={reqNum}
                    className={`tec-req-card${hasCrit ? ' tec-req-card--crit' : ''}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setVReqPanel(reqNum); setVObs(''); setVErr(''); setVSuccess('') }}>

                    <div className="tec-req-card-hd">
                      <div className="tec-req-card-left">
                        <span className="tec-req-num">{reqNum}</span>
                        <span className="tec-req-utente">{utente}</span>
                      </div>
                      <div className="tec-req-card-right">
                        {hasCrit && <span className="tec-crit-chip">⬆ crítico</span>}
                        <span className="tec-req-count">{items.length} resultado{items.length !== 1 ? 's' : ''}</span>
                        <span className="tec-req-arrow">validar →</span>
                      </div>
                    </div>

                    <div className="tec-req-val-rows">
                      {items.map(r => (
                        <div key={r._id} className="tec-req-val-row">
                          <span className="tec-req-val-nome">{r.analise.nome}</span>
                          {r.valor && (
                            <span className="tec-req-val-valor" style={{ color: FLAG_COLOR[r.flag] }}>
                              {r.valor} {r.unidade}
                            </span>
                          )}
                          <span className="tec-req-val-flag" style={{ color: FLAG_COLOR[r.flag] }}>
                            {FLAG_LABEL[r.flag]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {vPages > 1 && (
              <div className="tec-pag">
                <button className="tec-pag-btn" disabled={vPage <= 1} onClick={() => setVPage(p => p - 1)}>‹</button>
                <span className="tec-pag-info">{vPage} / {vPages}</span>
                <button className="tec-pag-btn" disabled={vPage >= vPages} onClick={() => setVPage(p => p + 1)}>›</button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ════════ PAINEL — ANÁLISE POR REQUISIÇÃO ════════ */}
      <AnimatePresence>
        {reqPanel && (
          <motion.aside className="tec-side-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className="tec-panel-hd">
              <button className="tec-panel-back" onClick={() => { setReqPanel(null); setReqMsg(''); setReqErr('') }}>← fechar</button>
              <div>
                <div className="tec-panel-label">Inserir resultados</div>
                <div className="tec-panel-sub">{reqPanel} · {byReqAnalise[reqPanel]?.[0]?.utenteNome}</div>
              </div>
            </div>

            <div className="tec-panel-body">
              {reqErr && <div className="tec-err">{reqErr}</div>}
              {reqMsg && <div className="tec-success">{reqMsg}</div>}

              <div className="tec-req-form-list">
                {(byReqAnalise[reqPanel] ?? []).map(r => {
                  const f = reqForms[r._id]
                  if (!f) return null
                  const isCrit = f.flag === 'critico_alto' || f.flag === 'critico_baixo'
                  return (
                    <div key={r._id} className={`tec-req-form-item${isCrit ? ' tec-req-form-item--crit' : ''}`}>
                      <div className="tec-req-form-hd">
                        <span className="tec-req-form-nome">{r.analise.nome}</span>
                        <span className="tec-cat-tag" style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '18', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                          {r.analise.categoria}
                        </span>
                        {f.refMin && f.refMax && (
                          <span className="tec-req-form-ref">ref: {f.refMin} – {f.refMax} {f.unidade}</span>
                        )}
                      </div>

                      <div className="tec-req-form-inputs">
                        <div className="tec-ff tec-ff--valor">
                          <label className="tec-lbl">Valor *</label>
                          <input className={`tec-input tec-input--sm${isCrit ? ' tec-input--crit' : ''}`}
                            type="number" step="any" placeholder="ex: 5.2"
                            value={f.valor}
                            onChange={e => setReqField(r._id, 'valor', e.target.value)} />
                        </div>
                        <div className="tec-ff tec-ff--unit">
                          <label className="tec-lbl">Unidade</label>
                          <input className="tec-input tec-input--sm" placeholder="mg/dL"
                            value={f.unidade}
                            onChange={e => setReqField(r._id, 'unidade', e.target.value)} />
                        </div>
                        <div className="tec-ff tec-ff--flag">
                          <label className="tec-lbl">Flag</label>
                          <div className="tec-flag-chip" style={{ background: FLAG_COLOR[f.flag] + '18', color: FLAG_COLOR[f.flag] }}>
                            {FLAG_LABEL[f.flag]}
                          </div>
                        </div>
                      </div>

                      <div className="tec-req-form-extra">
                        <input className="tec-input tec-input--sm" placeholder={`equipamento (${r.equipamento ?? 'ex: AU5800'})`}
                          value={f.equipamento}
                          onChange={e => setReqField(r._id, 'equipamento', e.target.value)} />
                        <input className="tec-input tec-input--sm" placeholder="observações (opcional)"
                          value={f.observacoes}
                          onChange={e => setReqField(r._id, 'observacoes', e.target.value)} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="tec-panel-actions">
                <button className="tec-btn tec-btn--concluir" disabled={savingReq} onClick={() => guardarTudo(true)}>
                  {savingReq ? 'a guardar…' : `✓ Concluir ${(byReqAnalise[reqPanel] ?? []).length} análise${(byReqAnalise[reqPanel]?.length ?? 0) !== 1 ? 's' : ''}`}
                </button>
                <button className="tec-btn tec-btn--guardar" disabled={savingReq} onClick={() => guardarTudo(false)}>
                  guardar rascunho
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ════════ PAINEL — VALIDAÇÃO POR REQUISIÇÃO ════════ */}
      <AnimatePresence>
        {vReqPanel && (
          <motion.aside className="tec-side-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className={`tec-panel-hd${(byReqVal[vReqPanel] ?? []).some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo') ? ' tec-panel-hd--crit' : ''}`}>
              <button className="tec-panel-back" onClick={() => { setVReqPanel(null); setVObs(''); setVSuccess(''); setVErr('') }}>← fechar</button>
              <div>
                <div className="tec-panel-label">Validação técnica</div>
                <div className="tec-panel-sub">{vReqPanel} · {(byReqVal[vReqPanel] ?? [])[0]?.utenteNome}</div>
              </div>
            </div>

            <div className="tec-panel-body">
              {/* resultados */}
              <div className="tec-val-results">
                {(byReqVal[vReqPanel] ?? []).map(r => {
                  const isCrit = r.flag === 'critico_alto' || r.flag === 'critico_baixo'
                  return (
                    <div key={r._id} className={`tec-result-card${isCrit ? ' tec-result-card--crit' : ''}`}
                      style={{ borderColor: FLAG_COLOR[r.flag] + '30' }}>
                      <div className="tec-result-top">
                        <span className="tec-req-form-nome">{r.analise.nome}</span>
                        <span className="tec-cat-tag" style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '18', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                          {r.analise.categoria}
                        </span>
                        {isCrit && <span className="tec-crit-pulse" />}
                      </div>
                      <div className="tec-result-val-big" style={{ color: FLAG_COLOR[r.flag] }}>
                        {r.valor ?? '—'}
                        {r.unidade && <span className="tec-result-unit"> {r.unidade}</span>}
                      </div>
                      <div className="tec-result-row2">
                        <span className="tec-flag-badge" style={{ background: FLAG_COLOR[r.flag] + '18', color: FLAG_COLOR[r.flag] }}>
                          {FLAG_LABEL[r.flag]}
                        </span>
                        {(r.refMin !== undefined || r.refMax !== undefined) && (
                          <span className="tec-result-ref">ref: {r.refMin ?? '–'} – {r.refMax ?? '–'} {r.unidade}</span>
                        )}
                      </div>
                      {r.observacoes && <div className="tec-result-obs">{r.observacoes}</div>}
                    </div>
                  )
                })}
              </div>

              {vSuccess && <div className="tec-success">{vSuccess}</div>}
              {vErr     && <div className="tec-err">{vErr}</div>}

              {!vSuccess && (
                <div className="tec-val-action">
                  <div className="tec-ff">
                    <label className="tec-lbl">Observações técnicas <span className="tec-opt">(opcional)</span></label>
                    <textarea className="tec-input tec-textarea" rows={3}
                      value={vObs} onChange={e => setVObs(e.target.value)}
                      placeholder="Notas técnicas, condições analíticas, desvios de procedimento…" />
                  </div>
                  <button className="tec-btn tec-btn--validar" disabled={vSaving} onClick={() => validarRequisicao(vObs)}>
                    {vSaving ? 'a validar…' : `✓ Assinar e validar ${(byReqVal[vReqPanel] ?? []).length} resultado${(byReqVal[vReqPanel]?.length ?? 0) !== 1 ? 's' : ''} — ${user?.nome}`}
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
