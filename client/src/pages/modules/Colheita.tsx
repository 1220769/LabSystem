import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import './Colheita.css'

/* ── tube guide ── */
type TipoTubo = 'edta' | 'citrato' | 'gel' | 'heparina' | 'urina' | 'outro'

const ANALISE_TUBO: Record<string, TipoTubo> = {
  HEM01: 'edta',  HEM02: 'edta',  MIC02: 'edta',
  COA01: 'citrato', COA02: 'citrato',
  BIO01: 'gel',  BIO02: 'gel',  BIO03: 'gel',  BIO04: 'gel',  BIO05: 'gel',
  BIO06: 'gel',  BIO07: 'gel',  BIO08: 'gel',  BIO09: 'gel',  BIO10: 'gel',
  BIO11: 'gel',  BIO12: 'gel',  BIO13: 'gel',  BIO14: 'gel',
  END01: 'gel',  END02: 'gel',  END03: 'gel',  END04: 'gel',
  IMU01: 'gel',  IMU02: 'gel',  IMU03: 'gel',
  MAR01: 'gel',  MAR02: 'gel',  MAR03: 'gel',  MAR04: 'gel',
  MIC01: 'urina', URI01: 'urina', URI02: 'urina',
}

const TUBO_META: Record<TipoTubo, { label: string; cor: string; desc: string }> = {
  edta:     { label: 'EDTA',     cor: '#9B59B6', desc: 'Hematologia · Hemograma' },
  citrato:  { label: 'Citrato',  cor: '#3498DB', desc: 'Coagulação' },
  gel:      { label: 'Gel/SST',  cor: '#F1C40F', desc: 'Bioquímica · Imunologia · Hormonas' },
  heparina: { label: 'Heparina', cor: '#27AE60', desc: 'Bioquímica especial' },
  urina:    { label: 'Urina',    cor: '#ECF0F1', desc: 'Microbiologia · Urina' },
  outro:    { label: 'Outro',    cor: '#95A5A6', desc: 'Outros' },
}

interface Analise { codigo: string; nome: string }
interface Tubo    { tipo: TipoTubo; analises: string[]; coletado: boolean }

function buildTubos(analises: Analise[]): Tubo[] {
  const groups: Record<string, string[]> = {}
  for (const a of analises) {
    const tipo = ANALISE_TUBO[a.codigo] ?? 'gel'
    if (!groups[tipo]) groups[tipo] = []
    groups[tipo].push(a.nome)
  }
  return Object.entries(groups).map(([tipo, nomes]) => ({
    tipo: tipo as TipoTubo, analises: nomes, coletado: false,
  }))
}

/* ── types ── */
type EstadoAmostra = 'aguarda_colheita' | 'colhida' | 'em_transito' | 'recebida' | 'rejeitada'
type FiltroEstado  = 'todas' | EstadoAmostra

interface Amostra {
  _id: string
  codigoAmostra: string
  requisicaoNumero: string
  utenteNome: string
  utenteProcesso: string
  tubos: Tubo[]
  tipoColheita: 'presencial' | 'domiciliaria'
  moradaColheita?: string
  dataHoraColheita?: string
  tecnico?: string
  temperatura?: number
  estado: EstadoAmostra
  motivoRejeicao?: string
  observacoes?: string
  createdAt: string
}

interface RequisicaoOpt {
  _id: string; numeroRequisicao: string
  utenteNome: string; utenteProcesso: string
  utente: string; analises: Analise[]
}

interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const ESTADO_LABEL: Record<string, string> = {
  aguarda_colheita: 'Aguarda colheita',
  colhida:          'Colhida',
  em_transito:      'Em trânsito',
  recebida:         'Recebida',
  rejeitada:        'Rejeitada',
}

const ESTADO_NEXT: Record<string, EstadoAmostra | null> = {
  aguarda_colheita: 'colhida',
  colhida:          'em_transito',
  em_transito:      'recebida',
  recebida:         null,
  rejeitada:        null,
}

const NEXT_LABEL: Record<string, string> = {
  aguarda_colheita: '→ Marcar como colhida',
  colhida:          '→ Enviar para laboratório',
  em_transito:      '→ Receber no laboratório',
}

/* ── component ── */
export default function Colheita({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FiltroEstado>('todas')
  const [search, setSearch]   = useState('')
  const [debSearch, setDebSearch] = useState('')
  const [stats, setStats] = useState({ aguarda: 0, em_transito: 0, domiciliarias: 0 })

  const [panel, setPanel]         = useState<'detail' | 'create' | null>(null)
  const [selected, setSelected]   = useState<Amostra | null>(null)
  const [reqEstado, setReqEstado] = useState<string | null>(null)

  /* create form */
  const [fReq, setFReq]       = useState<RequisicaoOpt | null>(null)
  const [reqSearch, setReqSearch] = useState('')
  const [reqResults, setReqResults] = useState<RequisicaoOpt[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [fTubos, setFTubos]   = useState<Tubo[]>([])
  const [fTipoCol, setFTipoCol] = useState<'presencial' | 'domiciliaria'>('presencial')
  const [fMorada, setFMorada] = useState('')
  const [fTecnico, setFTecnico] = useState('')
  const [fObs, setFObs]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')

  /* reject modal */
  const [rejecting, setRejecting] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canWrite = ['administrador','tecnico','enfermeiro'].includes(user?.role ?? '')

  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDebSearch(search); setPage(1) }, 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  const fetchAmostras = () => {
    setLoading(true)
    api.get('/amostras', {
      params: { estado: filter === 'todas' ? undefined : filter, search: debSearch, page, limit: 20 }
    }).then(({ data }) => {
      setAmostras(data.data); setTotal(data.total); setPages(data.pages)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAmostras() }, [filter, debSearch, page])

  useEffect(() => {
    api.get('/amostras/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [amostras])

  /* requisição typeahead */
  useEffect(() => {
    if (rTimer.current) clearTimeout(rTimer.current)
    if (reqSearch.length < 2) { setReqResults([]); return }
    rTimer.current = setTimeout(() => {
      setReqLoading(true)
      api.get('/requisicoes', { params: { search: reqSearch, estado: 'pendente', limit: 6 } })
        .then(({ data }) => setReqResults(data.data))
        .finally(() => setReqLoading(false))
    }, 250)
    return () => { if (rTimer.current) clearTimeout(rTimer.current) }
  }, [reqSearch])

  const selectReq = (r: RequisicaoOpt) => {
    setFReq(r)
    setFTubos(buildTubos(r.analises))
    setReqSearch(''); setReqResults([])
  }

  const openCreate = () => {
    setFReq(null); setReqSearch(''); setReqResults([])
    setFTubos([]); setFTipoCol('presencial'); setFMorada('')
    setFTecnico(user?.nome ?? ''); setFObs(''); setFormErr('')
    setPanel('create')
  }

  const openDetail = (a: Amostra) => {
    setSelected(a); setPanel('detail'); setRejecting(false); setReqEstado(null)
    api.get(`/requisicoes/${(a as unknown as Record<string,string>).requisicao}`)
      .then(r => setReqEstado(r.data.estado))
      .catch(() => {})
  }
  const closePanel = () => { setPanel(null); setSelected(null); setFormErr(''); setRejecting(false); setReqEstado(null) }

  const toggleTubo = (i: number) =>
    setFTubos(prev => prev.map((t, idx) => idx === i ? { ...t, coletado: !t.coletado } : t))

  const handleSave = async () => {
    if (!fReq) return setFormErr('Selecione uma requisição')
    if (fTubos.length === 0) return setFormErr('Nenhum tubo gerado')
    if (fTipoCol === 'domiciliaria' && !fMorada.trim()) return setFormErr('Indique a morada para colheita domiciliária')
    setSaving(true); setFormErr('')
    try {
      await api.post('/amostras', {
        requisicao:       fReq._id,
        requisicaoNumero: fReq.numeroRequisicao,
        utente:           fReq.utente,
        utenteNome:       fReq.utenteNome,
        utenteProcesso:   fReq.utenteProcesso,
        tubos:            fTubos,
        tipoColheita:     fTipoCol,
        moradaColheita:   fMorada || undefined,
        tecnico:          fTecnico || undefined,
        observacoes:      fObs || undefined,
      })
      closePanel(); fetchAmostras()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao criar amostra')
    } finally { setSaving(false) }
  }

  const handleAdvance = async (a: Amostra) => {
    const next = ESTADO_NEXT[a.estado]
    if (!next) return
    const update: any = { estado: next }
    if (next === 'colhida') update.dataHoraColheita = new Date().toISOString()
    try {
      await api.put(`/amostras/${a._id}`, update)
      setSelected(prev => prev ? { ...prev, estado: next, ...(next === 'colhida' ? { dataHoraColheita: update.dataHoraColheita } : {}) } : prev)
      fetchAmostras()
    } catch {}
  }

  const handleReject = async (a: Amostra) => {
    if (!rejectMotivo.trim()) return
    try {
      await api.put(`/amostras/${a._id}`, { estado: 'rejeitada', motivoRejeicao: rejectMotivo })
      closePanel(); fetchAmostras()
    } catch {}
  }

  const fmt     = (d: string) => new Date(d).toLocaleDateString('pt-PT')
  const fmtHour = (d: string) => new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <motion.div
      className="col-page"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.45 }}
    >
      {/* top */}
      <div className="col-top">
        <button className="col-back" onClick={() => navigate('/')}>← voltar</button>

        <div className="col-identity">
          <span className="col-num">03</span>
          <h1 className="col-title">Colheita</h1>
          <p className="col-sub">{seg.sub}</p>
        </div>

        <div className="col-kpis">
          <div className="col-kpi">
            <span className="col-kpi-val">{stats.aguarda}</span>
            <span className="col-kpi-lbl">por colher</span>
          </div>
          <div className="col-kpi">
            <span className="col-kpi-val">{stats.em_transito}</span>
            <span className="col-kpi-lbl">em trânsito</span>
          </div>
          {stats.domiciliarias > 0 && (
            <div className="col-kpi col-kpi--dom">
              <span className="col-kpi-val">{stats.domiciliarias}</span>
              <span className="col-kpi-lbl">domiciliárias</span>
            </div>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="col-toolbar">
        <div className="col-tabs">
          {(['todas','aguarda_colheita','colhida','em_transito','recebida','rejeitada'] as FiltroEstado[]).map(e => (
            <button key={e} className={`col-tab ${filter === e ? 'col-tab--on' : ''}`}
              onClick={() => { setFilter(e); setPage(1) }}>
              {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
        <input className="col-search"
          placeholder="pesquisar código · utente · requisição…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {canWrite && <button className="col-btn-new" onClick={openCreate}>+ nova</button>}
      </div>

      {/* list */}
      <div className="col-list-area">
        {loading ? (
          <div className="col-msg">a carregar…</div>
        ) : amostras.length === 0 ? (
          <div className="col-msg">sem resultados</div>
        ) : (
          <>
            <div className="col-list">
              {amostras.map((a, i) => (
                <motion.div key={a._id} className="col-row"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => openDetail(a)}>

                  <div className="col-row-left">
                    <div className="col-row-cod">{a.codigoAmostra}</div>
                    <div className="col-row-utente">{a.utenteNome}</div>
                    <div className="col-row-req">{a.requisicaoNumero}</div>
                  </div>

                  <div className="col-row-mid">
                    <div className="col-tubes-row">
                      {a.tubos.map((t, idx) => (
                        <span key={idx} className="col-tube-dot"
                          style={{ background: TUBO_META[t.tipo].cor }}
                          title={TUBO_META[t.tipo].label} />
                      ))}
                    </div>
                    {a.tipoColheita === 'domiciliaria' && (
                      <span className="col-dom-badge">domiciliária</span>
                    )}
                  </div>

                  <div className="col-row-right">
                    <span className={`col-badge col-badge--${a.estado}`}>{ESTADO_LABEL[a.estado]}</span>
                    <span className="col-arr">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
            {pages > 1 && (
              <div className="col-pag">
                <button className="col-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <span className="col-pag-info">{page} / {pages}</span>
                <button className="col-pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* panel */}
      <AnimatePresence>
        {panel && (
          <motion.aside className="col-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className="col-panel-hd">
              <button className="col-back col-back--panel" onClick={closePanel}>← fechar</button>
              <div className="col-panel-label">
                {panel === 'detail' ? selected?.codigoAmostra : 'Nova Colheita'}
              </div>
            </div>

            {/* ── DETAIL ── */}
            {panel === 'detail' && selected && (
              <div className="col-detail">

                {/* etiqueta */}
                <div className="col-etiqueta">
                  <div className="col-etiqueta-code">{selected.codigoAmostra}</div>
                  <div className="col-barcode">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div key={i} className="col-bar"
                        style={{ height: `${12 + Math.sin(i * 1.7) * 6}px`, opacity: i % 3 === 0 ? 0.9 : 0.4 }} />
                    ))}
                  </div>
                  <div className="col-etiqueta-utente">{selected.utenteNome}</div>
                  <div className="col-etiqueta-meta">{selected.utenteProcesso} · {fmt(selected.createdAt)}</div>
                </div>

                <div className="col-detail-row">
                  <span className={`col-badge col-badge--${selected.estado} col-badge--lg`}>{ESTADO_LABEL[selected.estado]}</span>
                  {selected.tipoColheita === 'domiciliaria' && <span className="col-dom-badge col-dom-badge--lg">domiciliária</span>}
                  {reqEstado && (
                    <span className={`col-req-estado col-req-estado--${reqEstado}`}>
                      REQ {reqEstado.replace('_',' ')}
                    </span>
                  )}
                </div>

                {/* tubes */}
                <div className="col-dsection">
                  <div className="col-dsection-title">Guia de tubos</div>
                  {selected.tubos.map((t, i) => (
                    <div key={i} className="col-tube-row">
                      <span className="col-tube-cap" style={{ background: TUBO_META[t.tipo].cor }} />
                      <div className="col-tube-info">
                        <div className="col-tube-label">{TUBO_META[t.tipo].label}</div>
                        <div className="col-tube-analises">{t.analises.join(' · ')}</div>
                      </div>
                      {t.coletado && <span className="col-tube-ok">✓</span>}
                    </div>
                  ))}
                </div>

                {selected.tecnico && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Técnico</div>
                    <div className="col-dval">{selected.tecnico}</div>
                  </div>
                )}
                {selected.dataHoraColheita && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Data / hora colheita</div>
                    <div className="col-dval">{fmtHour(selected.dataHoraColheita)}</div>
                  </div>
                )}
                {selected.temperatura !== undefined && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Temperatura</div>
                    <div className="col-dval">{selected.temperatura} °C</div>
                  </div>
                )}
                {selected.moradaColheita && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Morada de colheita</div>
                    <div className="col-dval">{selected.moradaColheita}</div>
                  </div>
                )}
                {selected.observacoes && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Observações</div>
                    <div className="col-dval">{selected.observacoes}</div>
                  </div>
                )}
                {selected.motivoRejeicao && (
                  <div className="col-dsection">
                    <div className="col-dsection-title">Motivo de rejeição</div>
                    <div className="col-dval col-dval--reject">{selected.motivoRejeicao}</div>
                  </div>
                )}

                {canWrite && (
                  <div className="col-detail-actions">
                    {ESTADO_NEXT[selected.estado] && (
                      <button className="col-btn-advance" onClick={() => handleAdvance(selected)}>
                        {NEXT_LABEL[selected.estado]}
                      </button>
                    )}
                    {selected.estado !== 'rejeitada' && selected.estado !== 'recebida' && !rejecting && (
                      <button className="col-btn-reject" onClick={() => setRejecting(true)}>
                        Rejeitar
                      </button>
                    )}
                  </div>
                )}

                {rejecting && (
                  <div className="col-reject-form">
                    <div className="col-ff-label">Motivo de rejeição *</div>
                    <input className="col-input"
                      value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)}
                      placeholder="ex: amostra hemolisada, tubo incorreto…" />
                    <div className="col-reject-actions">
                      <button className="col-btn-cancel-form" onClick={() => setRejecting(false)}>Cancelar</button>
                      <button className="col-btn-save col-btn-save--reject"
                        onClick={() => handleReject(selected)}
                        disabled={!rejectMotivo.trim()}>
                        Confirmar rejeição
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE ── */}
            {panel === 'create' && (
              <div className="col-form">
                {formErr && <div className="col-form-err">{formErr}</div>}

                {/* requisição */}
                <div className="col-fsection">
                  <div className="col-fsection-title">Requisição</div>
                  {fReq ? (
                    <div className="col-req-selected">
                      <div className="col-req-num">{fReq.numeroRequisicao}</div>
                      <div className="col-req-utente">{fReq.utenteNome} · {fReq.utenteProcesso}</div>
                      <button className="col-req-clear" onClick={() => { setFReq(null); setFTubos([]) }}>× alterar</button>
                    </div>
                  ) : (
                    <div className="col-req-search-wrap">
                      <input className="col-input"
                        placeholder="pesquisar requisição pendente…"
                        value={reqSearch} onChange={e => setReqSearch(e.target.value)} />
                      {(reqResults.length > 0 || reqLoading) && (
                        <div className="col-req-dropdown">
                          {reqLoading ? (
                            <div className="col-req-loading">a pesquisar…</div>
                          ) : reqResults.map(r => (
                            <div key={r._id} className="col-req-opt" onClick={() => selectReq(r)}>
                              <span className="col-req-opt-num">{r.numeroRequisicao}</span>
                              <span className="col-req-opt-utente">{r.utenteNome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* tube guide preview */}
                {fTubos.length > 0 && (
                  <div className="col-fsection">
                    <div className="col-fsection-title">Guia de tubos gerado automaticamente</div>
                    <div className="col-tube-guide">
                      {fTubos.map((t, i) => (
                        <div key={i} className={`col-tube-guide-row ${t.coletado ? 'col-tube-guide-row--ok' : ''}`}
                          onClick={() => toggleTubo(i)}>
                          <span className="col-tube-cap" style={{ background: TUBO_META[t.tipo].cor }} />
                          <div className="col-tube-info">
                            <div className="col-tube-label">{TUBO_META[t.tipo].label}</div>
                            <div className="col-tube-desc">{TUBO_META[t.tipo].desc}</div>
                            <div className="col-tube-analises">{t.analises.join(' · ')}</div>
                          </div>
                          <div className={`col-tube-check ${t.coletado ? 'col-tube-check--on' : ''}`}>
                            {t.coletado ? '✓' : '○'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* tipo colheita */}
                <div className="col-fsection">
                  <div className="col-fsection-title">Tipo de colheita</div>
                  <div className="col-tipo-row">
                    {(['presencial','domiciliaria'] as const).map(t => (
                      <button key={t}
                        className={`col-tipo-btn ${fTipoCol === t ? 'col-tipo-btn--on' : ''}`}
                        onClick={() => setFTipoCol(t)}>
                        {t === 'presencial' ? '🏥 Presencial' : '🏠 Domiciliária'}
                      </button>
                    ))}
                  </div>
                  {fTipoCol === 'domiciliaria' && (
                    <div className="col-ff">
                      <label className="col-ff-label">Morada *</label>
                      <input className="col-input" value={fMorada}
                        onChange={e => setFMorada(e.target.value)}
                        placeholder="Rua, nº, código postal, localidade" />
                    </div>
                  )}
                </div>

                {/* técnico + obs */}
                <div className="col-fsection">
                  <div className="col-fsection-title">Detalhes</div>
                  <div className="col-ff">
                    <label className="col-ff-label">Técnico responsável</label>
                    <input className="col-input" value={fTecnico}
                      onChange={e => setFTecnico(e.target.value)} />
                  </div>
                  <div className="col-ff">
                    <label className="col-ff-label">Observações</label>
                    <textarea className="col-input" rows={2} value={fObs}
                      onChange={e => setFObs(e.target.value)} />
                  </div>
                </div>

                <div className="col-form-actions">
                  <button className="col-btn-cancel-form" onClick={closePanel}>Cancelar</button>
                  <button className="col-btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? 'a guardar…' : 'Criar colheita'}
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
