import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import NotificationBell from '../../../components/NotificationBell'
import '../staffportal/staffportal.css'
import './financeiromain.component.css'

/* ─── utils ─── */
function fmtEur(v: number) { return v.toLocaleString('pt-PT', { style:'currency', currency:'EUR' }) }
function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-PT') }
function saudacao() { const h = new Date().getHours(); return h<12?'Bom dia':h<19?'Boa tarde':'Boa noite' }
function primeiroNome(nome: string) { return nome.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.)\s+/i,'').split(' ')[0] }

/* ─── types ─── */
type FinTab = 'faturas' | 'nova' | 'pagamentos' | 'relatorio'
type EstadoFatura = 'rascunho' | 'emitida' | 'paga' | 'anulada'
type TipoFatura   = 'particular' | 'sns' | 'seguradora'

interface ILinha { codigo: string; descricao: string; preco: number }
interface IFatura {
  _id: string; numeroFatura: string
  requisicao: string; requisicaoNumero: string
  utente: string; utenteNome: string
  tipo: TipoFatura; seguradora?: string
  linhas: ILinha[]
  valorBruto: number; percentComparticipacao: number
  valorComparticipado: number; valorLiquido: number
  estado: EstadoFatura
  referenciaPagamento?: string; observacoes?: string
  dataEmissao?: string; dataPagamento?: string
  createdAt: string
}
interface IReqLivre {
  _id: string; numeroRequisicao: string
  utenteNome: string; utente: string
  analises: { codigo: string; nome: string; categoria?: string }[]
}
interface IStats {
  faturacaoMes: number; recebidoMes: number
  porEstado: { _id: string; count: number; valor: number }[]
}

/* ─── helpers ─── */
const ESTADO_LABEL: Record<string, string> = { rascunho:'Rascunho', emitida:'Emitida', paga:'Paga', anulada:'Anulada' }
const ESTADO_COLOR: Record<string, string> = {
  rascunho: 'rgba(26,18,8,0.5)', emitida: '#655C86', paga: '#2E7A50', anulada: '#C8001A',
}
const TIPO_LABEL: Record<string, string> = { particular:'Particular', sns:'SNS', seguradora:'Seguradora' }

/* preço por código de análise */
const PRECO_ANALISE: Record<string, number> = {
  HEM01:12, HEM02:14, COA01:18, COA02:22, BIO01:8, BIO02:9, BIO03:10, BIO04:11,
  BIO05:15, BIO06:10, BIO07:14, BIO08:14, BIO09:16, BIO10:12, BIO11:12, BIO12:14,
  BIO13:20, BIO14:16, END01:22, END02:28, END03:26, END04:24, IMU01:35, IMU02:30,
  IMU03:40, MIC01:25, MIC02:35, URI01:9, URI02:18, MAR01:45, MAR02:48, MAR03:48, MAR04:40,
}

function buildLinhas(analises: { codigo: string; nome: string }[]): ILinha[] {
  return analises.map(a => ({ codigo: a.codigo, descricao: a.nome, preco: PRECO_ANALISE[a.codigo] ?? 20 }))
}

/* ══════════════════════════════════════════ */
export default function FinanceiromainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab,      setTab]      = useState<FinTab>('faturas')
  const [stats,    setStats]    = useState<IStats | null>(null)
  const [loading,  setLoading]  = useState(true)

  /* faturas list */
  const [faturas,  setFaturas]  = useState<IFatura[]>([])
  const [fTotal,   setFTotal]   = useState(0)
  const [fPage,    setFPage]    = useState(1)
  const [fLoading, setFLoad]    = useState(false)
  const [fEstado,  setFEstado]  = useState<EstadoFatura | 'todas'>('todas')
  const [fSearch,  setFSearch]  = useState('')
  const [fDebSearch, setFDeb]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [savedId,  setSavedId]  = useState<string | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})

  /* nova fatura */
  const [reqs,       setReqs]      = useState<IReqLivre[]>([])
  const [selReq,     setSelReq]    = useState<IReqLivre | null>(null)
  const [nfTipo,     setNfTipo]    = useState<TipoFatura>('particular')
  const [nfSegur,    setNfSegur]   = useState('')
  const [nfComp,     setNfComp]    = useState(0)
  const [nfLinhas,   setNfLinhas]  = useState<ILinha[]>([])
  const [nfObs,      setNfObs]     = useState('')
  const [nfEmitir,   setNfEmitir]  = useState(false)
  const [nfSaving,   setNfSaving]  = useState(false)
  const [nfErr,      setNfErr]     = useState('')
  const [nfOk,       setNfOk]      = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ─── derived ─── */
  const porEstadoMap: Record<string, { count: number; valor: number }> = {}
  stats?.porEstado.forEach(e => { porEstadoMap[e._id] = { count: e.count, valor: e.valor } })

  const totalPendente = (porEstadoMap['emitida']?.valor ?? 0)

  /* ─── loaders ─── */
  const loadStats = useCallback(async () => {
    try { const r = await api.get('/faturas/stats'); setStats(r.data) } catch { /* */ }
  }, [])

  const loadFaturas = useCallback(() => {
    setFLoad(true)
    const params: Record<string, string | number> = { page: fPage, limit: 20 }
    if (fEstado !== 'todas') params.estado = fEstado
    if (fDebSearch) params.search = fDebSearch
    api.get('/faturas', { params })
      .then(r => { setFaturas(r.data.data ?? []); setFTotal(r.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setFLoad(false))
  }, [fEstado, fPage, fDebSearch])

  const loadReqs = useCallback(async () => {
    try { const r = await api.get('/faturas/requisicoes-livres'); setReqs(r.data.data ?? []) }
    catch { /* */ }
  }, [])

  useEffect(() => {
    Promise.all([loadStats(), loadFaturas(), loadReqs()]).finally(() => setLoading(false))
  }, [loadStats, loadFaturas, loadReqs])

  useEffect(() => {
    if (tab === 'faturas') loadFaturas()
  }, [tab, loadFaturas])

  useEffect(() => {
    if (tab === 'nova' && reqs.length === 0) loadReqs()
  }, [tab, loadReqs, reqs.length])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setFDeb(fSearch); setFPage(1) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [fSearch])

  /* ─── actions ─── */
  const emitirFatura = async (id: string) => {
    setSaving(id)
    try {
      await api.patch(`/faturas/${id}`, { estado: 'emitida' })
      setFaturas(prev => prev.map(f => f._id === id ? { ...f, estado: 'emitida', dataEmissao: new Date().toISOString() } : f))
      setSavedId(id); setTimeout(() => setSavedId(null), 2200)
      await loadStats()
    } catch { /* */ } finally { setSaving(null) }
  }

  const registarPagamento = async (id: string) => {
    setSaving(id)
    try {
      const ref = refInput[id] || undefined
      await api.patch(`/faturas/${id}`, { estado: 'paga', referenciaPagamento: ref })
      setFaturas(prev => prev.map(f => f._id === id ? { ...f, estado: 'paga', dataPagamento: new Date().toISOString(), referenciaPagamento: ref } : f))
      setSavedId(id); setTimeout(() => setSavedId(null), 2200)
      await loadStats()
    } catch { /* */ } finally { setSaving(null) }
  }

  const anularFatura = async (id: string) => {
    if (!window.confirm('Anular esta fatura?')) return
    setSaving(id)
    try {
      await api.patch(`/faturas/${id}`, { estado: 'anulada' })
      setFaturas(prev => prev.map(f => f._id === id ? { ...f, estado: 'anulada' } : f))
      await loadStats()
    } catch { /* */ } finally { setSaving(null) }
  }

  /* ─── nova fatura calc ─── */
  const nfBruto  = nfLinhas.reduce((s, l) => s + l.preco, 0)
  const nfCompVal = nfBruto * nfComp / 100
  const nfLiquido = nfBruto - nfCompVal

  const selecReq = (r: IReqLivre) => {
    setSelReq(r); setNfLinhas(buildLinhas(r.analises)); setNfErr(''); setNfOk('')
  }

  const criarFatura = async () => {
    if (!selReq) return setNfErr('Selecione uma requisição.')
    if (nfLinhas.length === 0) return setNfErr('Adicione pelo menos uma linha.')
    if (nfTipo === 'seguradora' && !nfSegur.trim()) return setNfErr('Indique o nome da seguradora.')
    setNfSaving(true); setNfErr('')
    try {
      const body = {
        requisicao: selReq._id, requisicaoNumero: selReq.numeroRequisicao,
        utente: selReq.utente, utenteNome: selReq.utenteNome,
        tipo: nfTipo, seguradora: nfTipo === 'seguradora' ? nfSegur : undefined,
        linhas: nfLinhas, valorBruto: nfBruto,
        percentComparticipacao: nfComp, valorComparticipado: nfCompVal, valorLiquido: nfLiquido,
        observacoes: nfObs || undefined,
        estado: 'rascunho',
      }
      const r = await api.post('/faturas', body)
      if (nfEmitir) await api.patch(`/faturas/${r.data._id}`, { estado: 'emitida' })
      setNfOk(`Fatura ${nfEmitir ? 'emitida' : 'guardada'} com sucesso!`)
      setSelReq(null); setNfLinhas([]); setNfTipo('particular'); setNfSegur('')
      setNfComp(0); setNfObs(''); setNfEmitir(false)
      await Promise.all([loadStats(), loadFaturas(), loadReqs()])
      setTimeout(() => { setTab('faturas'); setNfOk('') }, 1200)
    } catch (e: any) {
      setNfErr(e.response?.data?.message ?? 'Erro ao criar fatura.')
    } finally { setNfSaving(false) }
  }

  /* ─── exportar CSV ─── */
  const exportarCSV = async () => {
    const r = await api.get('/faturas', { params: { limit: 200 } })
    const all: IFatura[] = r.data.data ?? []
    const header = 'Numero,Utente,Tipo,Estado,Bruto,Comparticipação,Liquido,Emissão,Pagamento,Seguradora\n'
    const rows = all.map(f => [
      f.numeroFatura, f.utenteNome, f.tipo, f.estado,
      f.valorBruto.toFixed(2), f.valorComparticipado.toFixed(2), f.valorLiquido.toFixed(2),
      fmtDate(f.dataEmissao), fmtDate(f.dataPagamento), f.seguradora ?? '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mapa-financeiro-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const fPages = Math.ceil(fTotal / 20)

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="staff-portal staff-portal--financeiro">

      {/* ── HEADER ── */}
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Financeiro</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">financeiro · {new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' })}</div>
          </div>
          <NotificationBell theme="light" />
          <button className="staff-btn-ghost" onClick={() => navigate('/')}>← voltar</button>
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="staff-hero">
        <div>
          <div className="staff-greeting">{saudacao()}, <em>{primeiroNome(user?.nome ?? 'Financeiro')}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => { setTab('nova'); setNfOk('') }}>+ emitir fatura</button>
            <button className="staff-btn-ghost"   onClick={exportarCSV}>↓ exportar CSV</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="staff-kpis fin-kpis">
          <button className="fin-kpi" onClick={() => setTab('relatorio')}>
            <div className="fin-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            </div>
            <div className="fin-kpi-val">{loading ? '—' : fmtEur(stats?.faturacaoMes ?? 0)}</div>
            <div className="fin-kpi-lbl">faturação este mês</div>
          </button>

          <button className="fin-kpi fin-kpi--ok" onClick={() => setTab('relatorio')}>
            <div className="fin-kpi-icon fin-kpi-icon--ok">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div className="fin-kpi-val">{loading ? '—' : fmtEur(stats?.recebidoMes ?? 0)}</div>
            <div className="fin-kpi-lbl">recebido este mês</div>
          </button>

          <button className={`fin-kpi${totalPendente > 0 ? ' fin-kpi--alert' : ''}`} onClick={() => { setTab('pagamentos') }}>
            <div className={`fin-kpi-icon${totalPendente > 0 ? ' fin-kpi-icon--alert' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </div>
            <div className="fin-kpi-val">{loading ? '—' : fmtEur(totalPendente)}</div>
            <div className="fin-kpi-lbl">
              por cobrar
              {(porEstadoMap['emitida']?.count ?? 0) > 0 && (
                <span className="fin-kpi-hint"> · {porEstadoMap['emitida']?.count} fatura{(porEstadoMap['emitida']?.count ?? 0) !== 1 ? 's' : ''}</span>
              )}
            </div>
          </button>

          <button className="fin-kpi fin-kpi--draft" onClick={() => { setTab('nova') }}>
            <div className="fin-kpi-icon fin-kpi-icon--draft">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            </div>
            <div className="fin-kpi-val">{loading ? '—' : (porEstadoMap['rascunho']?.count ?? 0)}</div>
            <div className="fin-kpi-lbl">rascunhos por emitir</div>
            {(reqs.length > 0) && <div className="fin-kpi-hint">{reqs.length} req. sem fatura</div>}
          </button>
        </div>
      </section>

      {/* ── TABS ── */}
      <nav className="staff-tabs fin-tabs">
        {([
          { id:'faturas',    label:'Faturas',     badge: fTotal > 0 && fEstado !== 'todas' ? fTotal : null },
          { id:'nova',       label:'Nova Fatura',  badge: reqs.length > 0 ? reqs.length : null },
          { id:'pagamentos', label:'Pagamentos',   badge: porEstadoMap['emitida']?.count ?? null },
          { id:'relatorio',  label:'Relatório',    badge: null },
        ] as const).map(t => (
          <button key={t.id}
            className={`fin-tab${tab === t.id ? ' fin-tab--on' : ''}${t.id === 'pagamentos' && (porEstadoMap['emitida']?.count ?? 0) > 0 ? ' fin-tab--alert' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge !== null && t.badge > 0 && <span className="fin-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ════════════════ CONTENT ════════════════ */}
      <main className="staff-content">

        {/* ══ FATURAS ══ */}
        {tab === 'faturas' && (
          <div className="fin-section">
            <div className="fin-toolbar">
              <div className="fin-estado-tabs">
                {(['todas','rascunho','emitida','paga','anulada'] as const).map(e => (
                  <button key={e}
                    className={`fin-fbtn${fEstado === e ? ' fin-fbtn--on' : ''} fin-fbtn--${e}`}
                    onClick={() => { setFEstado(e); setFPage(1) }}>
                    {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]}
                    {e !== 'todas' && porEstadoMap[e] && (
                      <span className="fin-fbtn-cnt">{porEstadoMap[e].count}</span>
                    )}
                  </button>
                ))}
              </div>
              <input className="fin-search" placeholder="pesquisar utente, nº fatura…"
                value={fSearch} onChange={e => setFSearch(e.target.value)} />
              <span className="fin-count">{fTotal} fatura{fTotal !== 1 ? 's' : ''}</span>
            </div>

            {fLoading && <div className="fin-loading"><div className="fin-loading-bar" /></div>}

            {!fLoading && faturas.length === 0 && (
              <div className="fin-empty-state">
                <div className="fin-empty-icon">€</div>
                <div className="fin-empty-title">{fEstado === 'todas' ? 'Sem faturas' : `Sem faturas ${ESTADO_LABEL[fEstado].toLowerCase()}s`}</div>
                {fEstado === 'rascunho' && <button className="fin-empty-cta" onClick={() => setTab('nova')}>+ criar fatura</button>}
              </div>
            )}

            {!fLoading && faturas.map((fat, i) => {
              const isOpen = expanded === fat._id
              return (
                <motion.div key={fat._id}
                  className={`fin-row${isOpen ? ' fin-row--open' : ''}${savedId === fat._id ? ' fin-row--saved' : ''}`}
                  initial={{ opacity:0, y:3 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.012 }}>

                  <div className="fin-row-main" onClick={() => setExpanded(isOpen ? null : fat._id)}>
                    <div className="fin-row-l">
                      <div className="fin-row-info">
                        <div className="fin-utente-nome">{fat.utenteNome}</div>
                        <div className="fin-row-meta">
                          <span className="fin-mono">{fat.numeroFatura}</span>
                          <span className="fin-sep">·</span>
                          <span className="fin-mono">{fat.requisicaoNumero}</span>
                          <span className="fin-sep">·</span>
                          <span className="fin-tipo-badge fin-tipo-badge--{fat.tipo}">{TIPO_LABEL[fat.tipo]}</span>
                          {fat.seguradora && <span className="fin-seguradora">{fat.seguradora}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="fin-row-r">
                      <span className="fin-data">{fmtDate(fat.dataEmissao ?? fat.createdAt)}</span>
                      <span className="fin-valor">{fmtEur(fat.valorLiquido)}</span>
                      <span className="fin-estado-badge" style={{ background: ESTADO_COLOR[fat.estado]+'18', color: ESTADO_COLOR[fat.estado] }}>
                        {ESTADO_LABEL[fat.estado]}
                      </span>
                      <span className="fin-chev">{isOpen ? '↑' : '↓'}</span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div className="fin-detail"
                        initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                        exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}>

                        {/* linhas */}
                        <div className="fin-linhas">
                          <div className="fin-linhas-title">Linhas de fatura</div>
                          {fat.linhas.map((l, li) => (
                            <div key={li} className="fin-linha">
                              <span className="fin-mono fin-linha-cod">{l.codigo}</span>
                              <span className="fin-linha-desc">{l.descricao}</span>
                              <span className="fin-linha-preco">{fmtEur(l.preco)}</span>
                            </div>
                          ))}
                        </div>

                        {/* totais */}
                        <div className="fin-totais">
                          <div className="fin-total-row"><span>Subtotal</span><span>{fmtEur(fat.valorBruto)}</span></div>
                          {fat.percentComparticipacao > 0 && (
                            <div className="fin-total-row fin-total-row--comp">
                              <span>Comparticipação ({fat.percentComparticipacao}%)</span>
                              <span>− {fmtEur(fat.valorComparticipado)}</span>
                            </div>
                          )}
                          <div className="fin-total-row fin-total-row--final"><span>Total</span><span>{fmtEur(fat.valorLiquido)}</span></div>
                        </div>

                        {/* info datas */}
                        <div className="fin-datas-grid">
                          {fat.dataEmissao   && <DField l="Data emissão"   v={fmtDate(fat.dataEmissao)} />}
                          {fat.dataPagamento && <DField l="Data pagamento"  v={fmtDate(fat.dataPagamento)} />}
                          {fat.referenciaPagamento && <DField l="Ref. pagamento" v={fat.referenciaPagamento} />}
                          {fat.observacoes   && <DField l="Observações"     v={fat.observacoes} />}
                        </div>

                        {savedId === fat._id && (
                          <div className="fin-success">✓ Atualizado com sucesso</div>
                        )}

                        {/* pagamento inline */}
                        {fat.estado === 'emitida' && (
                          <div className="fin-pag-inline">
                            <input className="fin-input"
                              placeholder="Referência MB / IBAN (opcional)"
                              value={refInput[fat._id] ?? ''}
                              onChange={e => setRefInput(prev => ({ ...prev, [fat._id]: e.target.value }))} />
                            <button className="fin-btn fin-btn--pago" disabled={saving === fat._id}
                              onClick={() => registarPagamento(fat._id)}>
                              {saving === fat._id ? 'a guardar…' : '✓ Registar pagamento'}
                            </button>
                          </div>
                        )}

                        {/* acções */}
                        <div className="fin-acoes">
                          {fat.estado === 'rascunho' && (
                            <button className="fin-btn fin-btn--emitir" disabled={saving === fat._id}
                              onClick={() => emitirFatura(fat._id)}>
                              {saving === fat._id ? 'a emitir…' : '↗ Emitir fatura'}
                            </button>
                          )}
                          {(fat.estado === 'rascunho' || fat.estado === 'emitida') && (
                            <button className="fin-btn fin-btn--anular" disabled={saving === fat._id}
                              onClick={() => anularFatura(fat._id)}>
                              Anular
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}

            {fPages > 1 && (
              <div className="fin-pag">
                <button className="fin-pag-btn" disabled={fPage<=1} onClick={() => setFPage(p=>p-1)}>‹</button>
                <span className="fin-pag-info">{fPage} / {fPages}</span>
                <button className="fin-pag-btn" disabled={fPage>=fPages} onClick={() => setFPage(p=>p+1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* ══ NOVA FATURA ══ */}
        {tab === 'nova' && (
          <div className="fin-two">
            {/* lista requisições livres */}
            <div className="fin-section">
              <div className="fin-sh">
                <span className="fin-stitle">Requisições sem fatura</span>
                <span className="fin-count">{reqs.length} disponíve{reqs.length !== 1 ? 'is' : 'l'}</span>
              </div>
              {reqs.length === 0 ? (
                <div className="fin-empty-state">
                  <div className="fin-empty-icon">✓</div>
                  <div className="fin-empty-title">Todas as requisições têm fatura</div>
                </div>
              ) : (
                <ul className="fin-list">
                  {reqs.map(r => (
                    <li key={r._id} className={`fin-item${selReq?._id===r._id ? ' fin-item--sel' : ''}`}>
                      <button className="fin-req-row" onClick={() => selecReq(r)}>
                        <div>
                          <div className="fin-utente-nome">{r.utenteNome}</div>
                          <div className="fin-row-meta">
                            <span className="fin-mono">{r.numeroRequisicao}</span>
                            <span className="fin-sep">·</span>
                            <span>{r.analises.length} análise{r.analises.length!==1?'s':''}</span>
                          </div>
                          <div className="fin-chips-row">
                            {r.analises.slice(0,3).map(a => <span key={a.codigo} className="fin-chip">{a.nome}</span>)}
                            {r.analises.length > 3 && <span className="fin-chip fin-chip--more">+{r.analises.length-3}</span>}
                          </div>
                        </div>
                        <span className="fin-chev">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* form fatura */}
            <div className="fin-section">
              <div className="fin-sh"><span className="fin-stitle">Dados da fatura</span></div>

              {!selReq ? (
                <div className="fin-empty-state">
                  <div className="fin-empty-icon">←</div>
                  <div className="fin-empty-title">Selecione uma requisição</div>
                  <div className="fin-empty-sub">Clique numa requisição para criar a fatura correspondente</div>
                </div>
              ) : (
                <div className="fin-form">
                  {nfErr && <div className="fin-msg fin-msg--err">{nfErr}</div>}
                  {nfOk  && <div className="fin-msg fin-msg--ok">{nfOk}</div>}

                  {/* utente */}
                  <div className="fin-form-utente">
                    <div className="fin-form-utente-avatar">
                      {selReq.utenteNome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="fin-utente-nome">{selReq.utenteNome}</div>
                      <div className="fin-row-meta fin-mono">{selReq.numeroRequisicao}</div>
                    </div>
                    <button className="fin-form-clear" onClick={() => { setSelReq(null); setNfLinhas([]) }}>×</button>
                  </div>

                  {/* tipo */}
                  <div className="fin-field">
                    <label className="fin-lbl">Tipo de faturação</label>
                    <div className="fin-tipo-btns">
                      {(['particular','sns','seguradora'] as const).map(t => (
                        <button key={t}
                          className={`fin-tipo-btn${nfTipo===t ? ' fin-tipo-btn--on' : ''}`}
                          onClick={() => setNfTipo(t)}>
                          {TIPO_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {nfTipo === 'seguradora' && (
                    <div className="fin-field">
                      <label className="fin-lbl">Nome da seguradora</label>
                      <input className="fin-input" value={nfSegur} onChange={e => setNfSegur(e.target.value)} placeholder="ex: Médis, Multicare, AdvanceCare…" />
                    </div>
                  )}

                  {/* comparticipação */}
                  <div className="fin-field fin-field-row">
                    <div>
                      <label className="fin-lbl">Comparticipação (%)</label>
                      <input className="fin-input" type="number" min="0" max="100" step="5"
                        value={nfComp} onChange={e => setNfComp(Math.min(100, Math.max(0, parseFloat(e.target.value)||0)))} />
                    </div>
                    <div>
                      <label className="fin-lbl">Total a faturar</label>
                      <div className="fin-total-preview">{fmtEur(nfLiquido)}</div>
                    </div>
                  </div>

                  {/* linhas */}
                  <div className="fin-field">
                    <label className="fin-lbl">Linhas ({nfLinhas.length})</label>
                    <div className="fin-linhas fin-linhas--edit">
                      {nfLinhas.map((l, li) => (
                        <div key={li} className="fin-linha">
                          <span className="fin-mono fin-linha-cod">{l.codigo}</span>
                          <span className="fin-linha-desc">{l.descricao}</span>
                          <input className="fin-preco-input" type="number" min="0" step="0.5"
                            value={l.preco}
                            onChange={e => setNfLinhas(prev => prev.map((x,xi) => xi===li ? { ...x, preco: parseFloat(e.target.value)||0 } : x))} />
                          <button className="fin-linha-del" onClick={() => setNfLinhas(prev => prev.filter((_,xi)=>xi!==li))}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className="fin-totais fin-totais--preview">
                      <div className="fin-total-row"><span>Subtotal</span><span>{fmtEur(nfBruto)}</span></div>
                      {nfComp > 0 && <div className="fin-total-row fin-total-row--comp"><span>Comparticipação ({nfComp}%)</span><span>− {fmtEur(nfCompVal)}</span></div>}
                      <div className="fin-total-row fin-total-row--final"><span>Total</span><span>{fmtEur(nfLiquido)}</span></div>
                    </div>
                  </div>

                  <div className="fin-field">
                    <label className="fin-lbl">Observações <span className="fin-opt">(opcional)</span></label>
                    <textarea className="fin-input fin-textarea" rows={2} value={nfObs} onChange={e => setNfObs(e.target.value)} />
                  </div>

                  <label className="fin-emit-wrap">
                    <input type="checkbox" checked={nfEmitir} onChange={e => setNfEmitir(e.target.checked)} />
                    <span>Emitir imediatamente (e notificar o utente)</span>
                  </label>

                  <div className="fin-form-btns">
                    <button className="fin-btn fin-btn--save" disabled={nfSaving} onClick={criarFatura}>
                      {nfSaving ? 'a criar…' : nfEmitir ? '↗ Criar e emitir' : '✓ Guardar rascunho'}
                    </button>
                    <button className="fin-btn" onClick={() => { setSelReq(null); setNfLinhas([]) }}>cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PAGAMENTOS ══ */}
        {tab === 'pagamentos' && (
          <div className="fin-section">
            <div className="fin-toolbar">
              <div>
                <div className="fin-stitle">Faturas por cobrar</div>
                {totalPendente > 0 && <div className="fin-pendente-total">Total pendente: <strong>{fmtEur(totalPendente)}</strong></div>}
              </div>
              <span className="fin-count">{porEstadoMap['emitida']?.count ?? 0} fatura{(porEstadoMap['emitida']?.count ?? 0) !== 1 ? 's' : ''}</span>
            </div>

            <PagamentosTab
              key="pag"
              onPago={async (id, ref) => {
                setSaving(id)
                try {
                  await api.patch(`/faturas/${id}`, { estado: 'paga', referenciaPagamento: ref || undefined })
                  await Promise.all([loadStats(), loadFaturas()])
                } catch { /* */ } finally { setSaving(null) }
              }}
            />
          </div>
        )}

        {/* ══ RELATÓRIO ══ */}
        {tab === 'relatorio' && (
          <div className="fin-section">
            <div className="fin-toolbar">
              <span className="fin-stitle">Mapa financeiro</span>
              <button className="fin-btn fin-btn--export" onClick={exportarCSV}>↓ exportar CSV</button>
            </div>

            <div className="fin-relatorio">
              {/* resumo por estado */}
              <div className="fin-rel-estados">
                {(['rascunho','emitida','paga','anulada'] as const).map(e => (
                  <div key={e} className={`fin-rel-card fin-rel-card--${e}`}>
                    <div className="fin-rel-card-lbl">{ESTADO_LABEL[e]}</div>
                    <div className="fin-rel-card-count">{porEstadoMap[e]?.count ?? 0}</div>
                    <div className="fin-rel-card-val">{fmtEur(porEstadoMap[e]?.valor ?? 0)}</div>
                  </div>
                ))}
              </div>

              {/* barra de proporção */}
              <div className="fin-rel-barra-wrap">
                <div className="fin-rel-barra-lbl">Distribuição por estado</div>
                <div className="fin-rel-barra">
                  {(['rascunho','emitida','paga','anulada'] as const).map(e => {
                    const total = Object.values(porEstadoMap).reduce((s, v) => s + v.count, 0)
                    const pct = total > 0 ? ((porEstadoMap[e]?.count ?? 0) / total) * 100 : 0
                    return pct > 0 ? (
                      <div key={e} className={`fin-rel-barra-seg fin-rel-barra-seg--${e}`}
                        style={{ width: `${pct}%` }}
                        title={`${ESTADO_LABEL[e]}: ${pct.toFixed(0)}%`} />
                    ) : null
                  })}
                </div>
                <div className="fin-rel-barra-legend">
                  {(['rascunho','emitida','paga','anulada'] as const).map(e => (
                    <div key={e} className="fin-rel-legend-item">
                      <span className={`fin-rel-legend-dot fin-rel-legend-dot--${e}`} />
                      <span>{ESTADO_LABEL[e]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* métricas */}
              <div className="fin-rel-metricas">
                <div className="fin-rel-metrica">
                  <div className="fin-rel-metrica-lbl">Faturação este mês</div>
                  <div className="fin-rel-metrica-val">{fmtEur(stats?.faturacaoMes ?? 0)}</div>
                </div>
                <div className="fin-rel-metrica">
                  <div className="fin-rel-metrica-lbl">Recebido este mês</div>
                  <div className="fin-rel-metrica-val fin-rel-metrica-val--ok">{fmtEur(stats?.recebidoMes ?? 0)}</div>
                </div>
                <div className="fin-rel-metrica">
                  <div className="fin-rel-metrica-lbl">Taxa de cobrança</div>
                  <div className="fin-rel-metrica-val">
                    {stats?.faturacaoMes ? `${Math.round((stats.recebidoMes/stats.faturacaoMes)*100)}%` : '—'}
                  </div>
                </div>
                <div className="fin-rel-metrica">
                  <div className="fin-rel-metrica-lbl">Por cobrar</div>
                  <div className="fin-rel-metrica-val fin-rel-metrica-val--warn">{fmtEur(totalPendente)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

/* ── sub-componente Pagamentos (carrega faturas emitidas internamente) ── */
function PagamentosTab({ onPago }: { onPago: (id: string, ref: string) => Promise<void> }) {
  const [faturas, setFaturas] = useState<IFatura[]>([])
  const [loading, setLoading] = useState(true)
  const [refs,    setRefs]    = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState<string | null>(null)

  useEffect(() => {
    api.get('/faturas', { params: { estado: 'emitida', limit: 50 } })
      .then(r => setFaturas(r.data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="fin-loading"><div className="fin-loading-bar" /></div>
  if (faturas.length === 0) return (
    <div className="fin-empty-state">
      <div className="fin-empty-icon fin-empty-icon--ok">✓</div>
      <div className="fin-empty-title fin-empty-title--ok">Sem faturas pendentes de cobrança</div>
    </div>
  )

  return (
    <ul className="fin-list">
      {faturas.map(fat => (
        <li key={fat._id} className="fin-pag-item">
          <div className="fin-pag-info">
            <div className="fin-utente-nome">{fat.utenteNome}</div>
            <div className="fin-row-meta">
              <span className="fin-mono">{fat.numeroFatura}</span>
              <span className="fin-sep">·</span>
              <span>{fmtDate(fat.dataEmissao)}</span>
            </div>
          </div>
          <div className="fin-pag-valor">{fmtEur(fat.valorLiquido)}</div>
          <div className="fin-pag-action">
            <input className="fin-input fin-input--ref"
              placeholder="Ref. MB / IBAN"
              value={refs[fat._id] ?? fat.referenciaPagamento ?? ''}
              onChange={e => setRefs(prev => ({ ...prev, [fat._id]: e.target.value }))} />
            <button className="fin-btn fin-btn--pago"
              disabled={saving === fat._id}
              onClick={async () => {
                setSaving(fat._id)
                await onPago(fat._id, refs[fat._id] ?? '')
                setFaturas(prev => prev.filter(f => f._id !== fat._id))
                setSaving(null)
              }}>
              {saving === fat._id ? '…' : '✓ Paga'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="fin-dfield">
      <div className="fin-lbl">{l}</div>
      <div className="fin-dfield-v">{v}</div>
    </div>
  )
}
