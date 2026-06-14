import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import './Financeiro.css'

function fmtEur(v: number) { return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) }
function fmtDate(d?: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-PT') }

type EstadoFatura = 'rascunho' | 'emitida' | 'paga' | 'anulada'
type TipoFatura   = 'particular' | 'sns' | 'seguradora'
type FinTab       = 'faturas' | 'nova' | 'pagamentos' | 'relatorio'

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
interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const ESTADO_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', emitida: 'Emitida', paga: 'Paga', anulada: 'Anulada',
}
const TIPO_LABEL: Record<string, string> = {
  particular: 'Particular', sns: 'SNS', seguradora: 'Seguradora',
}
const ESTADO_COLOR: Record<string, string> = {
  rascunho: 'rgba(240,235,225,0.45)',
  emitida:  '#A8C8F0',
  paga:     '#7BCCA0',
  anulada:  '#E09090',
}

const PRECO_ANALISE: Record<string, number> = {
  HEM01:12, HEM02:14, COA01:18, COA02:22, BIO01:8,  BIO02:9,  BIO03:10, BIO04:11,
  BIO05:15, BIO06:10, BIO07:14, BIO08:14, BIO09:16, BIO10:12, BIO11:12, BIO12:14,
  BIO13:20, BIO14:16, END01:22, END02:28, END03:26, END04:24, IMU01:35, IMU02:30,
  IMU03:40, MIC01:25, MIC02:35, URI01:9,  URI02:18, MAR01:45, MAR02:48, MAR03:48, MAR04:40,
}

export default function Financeiro({ seg }: { seg: Seg }) {
  const navigate = useNavigate()

  const [tab,      setTab]      = useState<FinTab>('faturas')
  const [stats,    setStats]    = useState<IStats | null>(null)
  const [loading,  setLoading]  = useState(true)

  const [faturas,  setFaturas]  = useState<IFatura[]>([])
  const [fTotal,   setFTotal]   = useState(0)
  const [fPage,    setFPage]    = useState(1)
  const [fLoading, setFLoad]    = useState(false)
  const [fEstado,  setFEstado]  = useState<EstadoFatura | 'todas'>('todas')
  const [fSearch,  setFSearch]  = useState('')
  const [fDebSearch, setFDeb]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})

  const [reqs,     setReqs]     = useState<IReqLivre[]>([])
  const [selReq,   setSelReq]   = useState<IReqLivre | null>(null)
  const [nfTipo,   setNfTipo]   = useState<TipoFatura>('particular')
  const [nfSegur,  setNfSegur]  = useState('')
  const [nfComp,   setNfComp]   = useState(0)
  const [nfLinhas, setNfLinhas] = useState<ILinha[]>([])
  const [nfObs,    setNfObs]    = useState('')
  const [nfEmitir, setNfEmitir] = useState(false)
  const [nfSaving, setNfSaving] = useState(false)
  const [nfErr,    setNfErr]    = useState('')
  const [nfOk,     setNfOk]     = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const porEstadoMap: Record<string, { count: number; valor: number }> = {}
  stats?.porEstado.forEach(e => { porEstadoMap[e._id] = { count: e.count, valor: e.valor } })
  const totalPendente = porEstadoMap['emitida']?.valor ?? 0

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
    try { const r = await api.get('/faturas/requisicoes-livres'); setReqs(r.data.data ?? []) } catch { /* */ }
  }, [])

  useEffect(() => {
    Promise.all([loadStats(), loadFaturas(), loadReqs()]).finally(() => setLoading(false))
  }, [loadStats, loadFaturas, loadReqs])

  useEffect(() => { if (!loading) loadFaturas() }, [fEstado, fPage, fDebSearch]) // eslint-disable-line

  function handleSearch(v: string) {
    setFSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setFDeb(v); setFPage(1) }, 400)
  }

  async function handlePago(id: string, ref: string) {
    setSaving(id)
    try {
      await api.patch(`/faturas/${id}`, { estado: 'paga', referenciaPagamento: ref })
      await Promise.all([loadStats(), loadFaturas()])
    } catch { /* */ }
    setSaving(null)
  }

  async function handleAnular(id: string) {
    if (!confirm('Anular esta fatura?')) return
    setSaving(id)
    try {
      await api.patch(`/faturas/${id}`, { estado: 'anulada' })
      await Promise.all([loadStats(), loadFaturas()])
    } catch { /* */ }
    setSaving(null)
  }

  async function handleEmitir(id: string) {
    setSaving(id)
    try {
      await api.patch(`/faturas/${id}`, { estado: 'emitida', dataEmissao: new Date().toISOString() })
      await Promise.all([loadStats(), loadFaturas()])
    } catch { /* */ }
    setSaving(null)
  }

  function handleSelReq(req: IReqLivre) {
    setSelReq(req)
    setNfLinhas(req.analises.map(a => ({ codigo: a.codigo, descricao: a.nome, preco: PRECO_ANALISE[a.codigo] ?? 20 })))
  }

  async function handleNovaFatura(e: React.FormEvent) {
    e.preventDefault()
    if (!selReq) { setNfErr('Selecione uma requisição'); return }
    setNfSaving(true); setNfErr(''); setNfOk('')
    try {
      const valorBruto = nfLinhas.reduce((s, l) => s + l.preco, 0)
      const valorComparticipado = valorBruto * nfComp / 100
      await api.post('/faturas', {
        requisicao: selReq._id, utente: selReq.utente, tipo: nfTipo,
        seguradora: nfTipo === 'seguradora' ? nfSegur : undefined,
        linhas: nfLinhas, valorBruto, percentComparticipacao: nfComp,
        valorComparticipado, valorLiquido: valorBruto - valorComparticipado,
        observacoes: nfObs, estado: nfEmitir ? 'emitida' : 'rascunho',
        ...(nfEmitir ? { dataEmissao: new Date().toISOString() } : {}),
      })
      setNfOk('Fatura criada com sucesso!')
      setSelReq(null); setNfLinhas([]); setNfObs(''); setNfTipo('particular'); setNfComp(0); setNfEmitir(false)
      await Promise.all([loadStats(), loadFaturas(), loadReqs()])
    } catch { setNfErr('Erro ao criar fatura') }
    setNfSaving(false)
  }

  const pendentes = faturas.filter(f => f.estado === 'emitida')
  const fPages    = Math.ceil(fTotal / 20)

  return (
    <motion.div className="fn-page" style={{ background: seg.color }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>

      <button className="fn-back" onClick={() => navigate('/')}>← voltar</button>

      {/* ── HEADER ── */}
      <div className="fn-top">
        <div className="fn-identity">
          <span className="fn-num">{String(seg.id).padStart(2, '0')}</span>
          <h1 className="fn-title">FINANCEIRO</h1>
          <p className="fn-sub">{seg.sub}</p>
        </div>
        <div className="fn-kpis">
          <div className="fn-kpi">
            <span className="fn-kpi-val">{stats ? fmtEur(stats.faturacaoMes) : '—'}</span>
            <span className="fn-kpi-lbl">faturação mês</span>
          </div>
          <div className="fn-kpi">
            <span className="fn-kpi-val">{stats ? fmtEur(stats.recebidoMes) : '—'}</span>
            <span className="fn-kpi-lbl">recebido</span>
          </div>
          {totalPendente > 0 && (
            <div className="fn-kpi fn-kpi--warn">
              <span className="fn-kpi-val">{fmtEur(totalPendente)}</span>
              <span className="fn-kpi-lbl">por cobrar</span>
            </div>
          )}
          {(porEstadoMap['rascunho']?.count ?? 0) > 0 && (
            <div className="fn-kpi fn-kpi--draft">
              <span className="fn-kpi-val">{porEstadoMap['rascunho'].count}</span>
              <span className="fn-kpi-lbl">rascunhos</span>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="fn-tabbar">
        {(['faturas', 'nova', 'pagamentos', 'relatorio'] as FinTab[]).map(t => (
          <button key={t} className={`fn-tab ${tab === t ? 'fn-tab--on' : ''}`}
            onClick={() => setTab(t)}>
            {t === 'faturas' ? 'Faturas' : t === 'nova' ? 'Nova Fatura' : t === 'pagamentos' ? 'Pagamentos' : 'Relatório'}
            {t === 'pagamentos' && pendentes.length > 0 && (
              <span className="fn-tab-badge">{pendentes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="fn-content">

        {/* FATURAS */}
        {tab === 'faturas' && (
          <div className="fn-section">
            <div className="fn-toolbar">
              {(['todas', 'rascunho', 'emitida', 'paga', 'anulada'] as (EstadoFatura | 'todas')[]).map(e => (
                <button key={e} className={`fn-tbtn ${fEstado === e ? 'fn-tbtn--on' : ''}`}
                  onClick={() => { setFEstado(e); setFPage(1) }}>
                  {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]}
                  {e !== 'todas' && porEstadoMap[e]?.count ? ` · ${porEstadoMap[e].count}` : ''}
                </button>
              ))}
              <input className="fn-search" placeholder="pesquisar utente, nº fatura…"
                value={fSearch} onChange={ev => handleSearch(ev.target.value)} />
              <span className="fn-count">{fTotal} fatura{fTotal !== 1 ? 's' : ''}</span>
            </div>

            {fLoading ? (
              <div className="fn-loading"><div className="fn-loading-bar" /></div>
            ) : faturas.length === 0 ? (
              <div className="fn-empty-state">Nenhuma fatura encontrada</div>
            ) : (
              <ul className="fn-list">
                {faturas.map(f => (
                  <li key={f._id} className={`fn-item ${expanded === f._id ? 'fn-item--open' : ''}`}>
                    <button className="fn-row" onClick={() => setExpanded(expanded === f._id ? null : f._id)}>
                      <div className="fn-row-l">
                        <div className="fn-utente-nome">{f.utenteNome}</div>
                        <div className="fn-row-meta">
                          <span className="fn-mono">{f.numeroFatura}</span>
                          <span className="fn-sep">·</span>
                          <span className="fn-mono">{f.requisicaoNumero}</span>
                          <span className="fn-sep">·</span>
                          <span className="fn-tipo-badge">{TIPO_LABEL[f.tipo]}</span>
                          <span className="fn-sep">·</span>
                          <span className="fn-data">{fmtDate(f.dataEmissao || f.createdAt)}</span>
                        </div>
                      </div>
                      <div className="fn-row-r">
                        <span className="fn-valor">{fmtEur(f.valorLiquido)}</span>
                        <span className="fn-estado-badge" style={{ color: ESTADO_COLOR[f.estado] }}>
                          {ESTADO_LABEL[f.estado]}
                        </span>
                        <span className="fn-chev">{expanded === f._id ? '↑' : '↓'}</span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expanded === f._id && (
                        <motion.div className="fn-detail"
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <div className="fn-linhas-title">Linhas de faturação</div>
                          {f.linhas.map((l, i) => (
                            <div key={i} className="fn-linha">
                              <span className="fn-linha-cod">{l.codigo}</span>
                              <span className="fn-linha-desc">{l.descricao}</span>
                              <span className="fn-linha-preco">{fmtEur(l.preco)}</span>
                            </div>
                          ))}
                          <div className="fn-total-row">
                            <span>Total</span>
                            <span className="fn-total-val">{fmtEur(f.valorLiquido)}</span>
                          </div>
                          <div className="fn-acoes">
                            {f.estado === 'rascunho' && (
                              <button className="fn-btn fn-btn--emitir"
                                disabled={saving === f._id} onClick={() => handleEmitir(f._id)}>
                                Emitir
                              </button>
                            )}
                            {f.estado === 'emitida' && (
                              <>
                                <input className="fn-ref-input" placeholder="ref. pagamento"
                                  value={refInput[f._id] ?? ''}
                                  onChange={ev => setRefInput(r => ({ ...r, [f._id]: ev.target.value }))} />
                                <button className="fn-btn fn-btn--pago"
                                  disabled={saving === f._id}
                                  onClick={() => handlePago(f._id, refInput[f._id] ?? '')}>
                                  Registar Pago
                                </button>
                              </>
                            )}
                            {f.estado !== 'anulada' && f.estado !== 'paga' && (
                              <button className="fn-btn fn-btn--anular"
                                disabled={saving === f._id} onClick={() => handleAnular(f._id)}>
                                Anular
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>
            )}

            {fPages > 1 && (
              <div className="fn-pag">
                <button className="fn-pag-btn" disabled={fPage === 1} onClick={() => setFPage(p => p - 1)}>‹</button>
                <span className="fn-pag-info">{fPage} / {fPages}</span>
                <button className="fn-pag-btn" disabled={fPage >= fPages} onClick={() => setFPage(p => p + 1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* NOVA FATURA */}
        {tab === 'nova' && (
          <div className="fn-section">
            <form className="fn-form" onSubmit={handleNovaFatura}>
              <div className="fn-field">
                <label className="fn-lbl">Requisição</label>
                {selReq ? (
                  <div className="fn-sel-req">
                    <span className="fn-utente-nome">{selReq.utenteNome}</span>
                    <span className="fn-mono">{selReq.numeroRequisicao}</span>
                    <button type="button" className="fn-clear" onClick={() => { setSelReq(null); setNfLinhas([]) }}>✕</button>
                  </div>
                ) : reqs.length === 0 ? (
                  <div className="fn-empty-state">Sem requisições disponíveis para faturar</div>
                ) : (
                  <ul className="fn-req-list">
                    {reqs.map(r => (
                      <li key={r._id}>
                        <button type="button" className="fn-req-btn" onClick={() => handleSelReq(r)}>
                          <span className="fn-utente-nome">{r.utenteNome}</span>
                          <span className="fn-mono">{r.numeroRequisicao}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selReq && (
                <>
                  <div className="fn-field">
                    <label className="fn-lbl">Tipo</label>
                    <div className="fn-tipo-btns">
                      {(['particular', 'sns', 'seguradora'] as TipoFatura[]).map(t => (
                        <button key={t} type="button"
                          className={`fn-tipo-btn ${nfTipo === t ? 'fn-tipo-btn--on' : ''}`}
                          onClick={() => setNfTipo(t)}>
                          {TIPO_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {nfTipo === 'seguradora' && (
                    <div className="fn-field">
                      <label className="fn-lbl">Seguradora</label>
                      <input className="fn-input" value={nfSegur}
                        onChange={e => setNfSegur(e.target.value)} placeholder="nome da seguradora" />
                    </div>
                  )}

                  {nfTipo !== 'particular' && (
                    <div className="fn-field">
                      <label className="fn-lbl">Comparticipação %</label>
                      <input className="fn-input" type="number" min={0} max={100}
                        value={nfComp} onChange={e => setNfComp(Number(e.target.value))} />
                    </div>
                  )}

                  <div className="fn-field">
                    <label className="fn-lbl">Linhas de faturação</label>
                    {nfLinhas.map((l, i) => (
                      <div key={i} className="fn-linha">
                        <span className="fn-linha-cod">{l.codigo}</span>
                        <span className="fn-linha-desc">{l.descricao}</span>
                        <span className="fn-linha-preco">{fmtEur(l.preco)}</span>
                      </div>
                    ))}
                    <div className="fn-total-row">
                      <span>Total</span>
                      <span className="fn-total-val">{fmtEur(nfLinhas.reduce((s, l) => s + l.preco, 0))}</span>
                    </div>
                  </div>

                  <div className="fn-field">
                    <label className="fn-lbl">Observações</label>
                    <textarea className="fn-input fn-textarea" value={nfObs}
                      onChange={e => setNfObs(e.target.value)} rows={3} />
                  </div>

                  <label className="fn-emit-wrap">
                    <input type="checkbox" checked={nfEmitir} onChange={e => setNfEmitir(e.target.checked)} />
                    Emitir imediatamente
                  </label>

                  {nfErr && <div className="fn-msg fn-msg--err">{nfErr}</div>}
                  {nfOk  && <div className="fn-msg fn-msg--ok">{nfOk}</div>}

                  <button type="submit" className="fn-btn fn-btn--save" disabled={nfSaving}>
                    {nfSaving ? 'A guardar…' : 'Criar Fatura'}
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* PAGAMENTOS */}
        {tab === 'pagamentos' && (
          <div className="fn-section">
            {pendentes.length === 0 ? (
              <div className="fn-empty-state fn-empty-state--ok">Sem pagamentos pendentes</div>
            ) : pendentes.map(f => (
              <div key={f._id} className="fn-pag-item">
                <div className="fn-row-l">
                  <div className="fn-utente-nome">{f.utenteNome}</div>
                  <div className="fn-row-meta">
                    <span className="fn-mono">{f.numeroFatura}</span>
                    <span className="fn-sep">·</span>
                    <span className="fn-data">{fmtDate(f.dataEmissao)}</span>
                  </div>
                </div>
                <span className="fn-pag-valor">{fmtEur(f.valorLiquido)}</span>
                <div className="fn-pag-action">
                  <input className="fn-ref-input" placeholder="ref. pagamento"
                    value={refInput[f._id] ?? ''}
                    onChange={ev => setRefInput(r => ({ ...r, [f._id]: ev.target.value }))} />
                  <button className="fn-btn fn-btn--pago"
                    disabled={saving === f._id}
                    onClick={() => handlePago(f._id, refInput[f._id] ?? '')}>
                    Pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RELATÓRIO */}
        {tab === 'relatorio' && (
          <div className="fn-section fn-relatorio">
            <div className="fn-rel-grid">
              {(['rascunho', 'emitida', 'paga', 'anulada'] as EstadoFatura[]).map(e => (
                <div key={e} className={`fn-rel-card fn-rel-card--${e}`}>
                  <div className="fn-rel-card-val">{porEstadoMap[e]?.count ?? 0}</div>
                  <div className="fn-rel-card-lbl">{ESTADO_LABEL[e]}</div>
                  <div className="fn-rel-card-eur">{fmtEur(porEstadoMap[e]?.valor ?? 0)}</div>
                </div>
              ))}
            </div>
            <div className="fn-rel-metricas">
              <div className="fn-rel-metrica">
                <div className="fn-rel-metrica-val">{fmtEur(stats?.faturacaoMes ?? 0)}</div>
                <div className="fn-rel-metrica-lbl">Faturação este mês</div>
              </div>
              <div className="fn-rel-metrica fn-rel-metrica--ok">
                <div className="fn-rel-metrica-val">{fmtEur(stats?.recebidoMes ?? 0)}</div>
                <div className="fn-rel-metrica-lbl">Recebido este mês</div>
              </div>
              <div className="fn-rel-metrica fn-rel-metrica--warn">
                <div className="fn-rel-metrica-val">{fmtEur(totalPendente)}</div>
                <div className="fn-rel-metrica-lbl">Por cobrar</div>
              </div>
              <div className="fn-rel-metrica">
                <div className="fn-rel-metrica-val">
                  {fmtEur((porEstadoMap['paga']?.valor ?? 0) + (porEstadoMap['emitida']?.valor ?? 0))}
                </div>
                <div className="fn-rel-metrica-lbl">Volume activo</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
