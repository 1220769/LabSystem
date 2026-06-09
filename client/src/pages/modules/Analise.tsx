import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import './Analise.css'

/* ── reference ranges & equipment mapping ── */
interface RefRange { unidade: string; min?: number; max?: number; criticoMin?: number; criticoMax?: number; tipo?: 'text' }

const REF: Record<string, RefRange> = {
  HEM01: { unidade: 'ver relatório',     tipo: 'text' },
  HEM02: { unidade: '%',        min: 0.5,  max: 2.5 },
  COA01: { unidade: 's / s',    tipo: 'text' },
  COA02: { unidade: 'µg/mL',   min: 0,    max: 0.5,  criticoMax: 5 },
  BIO01: { unidade: 'mg/dL',   min: 70,   max: 100,  criticoMin: 40,  criticoMax: 500 },
  BIO02: { unidade: 'mg/dL',   min: 10,   max: 50 },
  BIO03: { unidade: 'mg/dL',   min: 0.6,  max: 1.2,  criticoMax: 10 },
  BIO04: { unidade: 'mg/dL',   min: 2.4,  max: 6.0 },
  BIO05: { unidade: 'mEq/L',   min: 136,  max: 145,  criticoMin: 120, criticoMax: 160 },
  BIO06: { unidade: 'mg/L',    min: 0,    max: 5,    criticoMax: 200 },
  BIO07: { unidade: 'U/L',     min: 7,    max: 40 },
  BIO08: { unidade: 'U/L',     min: 8,    max: 61 },
  BIO09: { unidade: 'mg/dL',   min: 0.2,  max: 1.2 },
  BIO10: { unidade: 'g/dL',    min: 6.4,  max: 8.3 },
  BIO11: { unidade: 'U/L',     min: 125,  max: 220 },
  BIO12: { unidade: 'U/L',     min: 30,   max: 170 },
  BIO13: { unidade: 'mg/dL',   min: 0,    max: 200,  criticoMax: 400 },
  BIO14: { unidade: 'mg/dL',   min: 0,    max: 150,  criticoMax: 1000 },
  END01: { unidade: 'mUI/L',   min: 0.5,  max: 4.5,  criticoMin: 0.01, criticoMax: 100 },
  END02: { unidade: 'pmol/L',  min: 9,    max: 23 },
  END03: { unidade: 'µg/dL',   min: 5,    max: 25 },
  END04: { unidade: 'µUI/mL',  min: 2,    max: 25 },
  IMU01: { unidade: 'g/L',     tipo: 'text' },
  IMU02: { unidade: 'mg/dL',   tipo: 'text' },
  IMU03: { unidade: '',        tipo: 'text' },
  MIC01: { unidade: '',        tipo: 'text' },
  MIC02: { unidade: '',        tipo: 'text' },
  URI01: { unidade: '',        tipo: 'text' },
  URI02: { unidade: 'mg/L',    min: 0, max: 30 },
  MAR01: { unidade: 'ng/mL',   min: 0, max: 4,  criticoMax: 20 },
  MAR02: { unidade: 'U/mL',    min: 0, max: 35 },
  MAR03: { unidade: 'U/mL',    min: 0, max: 37 },
  MAR04: { unidade: 'ng/mL',   min: 0, max: 5 },
}

const EQUIP: Record<string, string> = {
  HEM01: 'XN-1000', HEM02: 'XN-1000',
  COA01: 'STA-R Max', COA02: 'STA-R Max',
  BIO01: 'AU5800', BIO02: 'AU5800', BIO03: 'AU5800', BIO04: 'AU5800',
  BIO05: 'AU5800', BIO06: 'AU5800', BIO07: 'AU5800', BIO08: 'AU5800',
  BIO09: 'AU5800', BIO10: 'AU5800', BIO11: 'AU5800', BIO12: 'AU5800',
  BIO13: 'AU5800', BIO14: 'AU5800',
  END01: 'Cobas e801', END02: 'Cobas e801', END03: 'Cobas e801', END04: 'Cobas e801',
  IMU01: 'Cobas e801', IMU02: 'Cobas e801', IMU03: 'Cobas e801',
  MAR01: 'Cobas e801', MAR02: 'Cobas e801', MAR03: 'Cobas e801', MAR04: 'Cobas e801',
  MIC01: 'Manual', MIC02: 'BacT/ALERT',
  URI01: 'Urisys 2400', URI02: 'AU5800',
}

type Flag = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
type EstadoR = 'pendente' | 'em_processamento' | 'resultado_disponivel'
type FiltroEstado = 'todas' | EstadoR

function calcFlag(valor: string, codigo: string): Flag {
  const ref = REF[codigo]
  if (!ref || ref.tipo === 'text') return 'normal'
  const v = parseFloat(valor.replace(',', '.'))
  if (isNaN(v)) return 'normal'
  if (ref.criticoMin !== undefined && v < ref.criticoMin) return 'critico_baixo'
  if (ref.criticoMax !== undefined && v > ref.criticoMax) return 'critico_alto'
  if (ref.min        !== undefined && v < ref.min)        return 'baixo'
  if (ref.max        !== undefined && v > ref.max)        return 'alto'
  return 'normal'
}

interface Resultado {
  _id: string
  codigoResultado: string
  codigoAmostra: string
  requisicaoNumero: string
  utenteNome: string
  analise: { codigo: string; nome: string; categoria: string }
  equipamento?: string
  valor?: string
  unidade?: string
  refMin?: number
  refMax?: number
  flag: Flag
  estado: EstadoR
  observacoes?: string
  createdAt: string
}

interface EntryState { valor: string; unidade: string; flag: Flag; equip: string; obs: string }
interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const FLAG_ICON: Record<Flag, string> = {
  pendente: '', normal: '', alto: '↑', baixo: '↓', critico_alto: '⬆', critico_baixo: '⬇',
}

const ESTADO_LABEL: Record<EstadoR, string> = {
  pendente:             'Pendente',
  em_processamento:     'Em processamento',
  resultado_disponivel: 'Disponível',
}

/* ── component ── */
export default function Analise({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [resultados,  setResultados]  = useState<Resultado[]>([])
  const [total,       setTotal]       = useState(0)
  const [pages,       setPages]       = useState(1)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<FiltroEstado>('todas')
  const [search,      setSearch]      = useState('')
  const [debSearch,   setDebSearch]   = useState('')
  const [stats,       setStats]       = useState({ pendente: 0, em_processamento: 0, disponivel: 0, criticos: 0 })

  /* panel */
  const [panel,      setPanel]      = useState<'req' | 'worklist' | null>(null)
  const [reqItems,   setReqItems]   = useState<Resultado[]>([])
  const [reqEntries, setReqEntries] = useState<Record<string, EntryState>>({})
  const [savingAll,  setSavingAll]  = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')
  const [formErr,    setFormErr]    = useState('')

  /* worklist amostra search */
  const [wSearch,     setWSearch]     = useState('')
  const [wResult,     setWResult]     = useState<{ _id: string; codigoAmostra: string; utenteNome: string }[]>([])
  const [wLoading,    setWLoading]    = useState(false)
  const [wGenerating, setWGenerating] = useState(false)
  const [wMsg,        setWMsg]        = useState('')

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canWrite = ['administrador', 'tecnico'].includes(user?.role ?? '')

  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDebSearch(search); setPage(1) }, 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  const fetchResultados = () => {
    setLoading(true)
    api.get('/resultados', {
      params: { estado: filter === 'todas' ? undefined : filter, search: debSearch, page, limit: 100 }
    }).then(({ data }) => {
      setResultados(data.data); setTotal(data.total); setPages(data.pages)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchResultados() }, [filter, debSearch, page])

  useEffect(() => {
    api.get('/resultados/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [resultados])

  /* group by requisição */
  const byReq = resultados.reduce<Record<string, Resultado[]>>((acc, r) => {
    if (!acc[r.requisicaoNumero]) acc[r.requisicaoNumero] = []
    acc[r.requisicaoNumero].push(r)
    return acc
  }, {})

  /* worklist search */
  useEffect(() => {
    if (wTimer.current) clearTimeout(wTimer.current)
    if (wSearch.length < 2) { setWResult([]); return }
    wTimer.current = setTimeout(() => {
      setWLoading(true)
      api.get('/amostras', { params: { search: wSearch, estado: 'recebida', limit: 6 } })
        .then(({ data }) => setWResult(data.data))
        .finally(() => setWLoading(false))
    }, 250)
    return () => { if (wTimer.current) clearTimeout(wTimer.current) }
  }, [wSearch])

  const handleGerarWorklist = async (amostraId: string) => {
    setWGenerating(true); setWMsg('')
    try {
      const { data } = await api.post(`/resultados/worklist/${amostraId}`)
      setWMsg(`✓ ${data.created} resultado(s) gerado(s)`)
      setWSearch(''); setWResult([])
      fetchResultados()
    } catch (err: any) {
      setWMsg(err.response?.data?.message ?? 'Erro ao gerar worklist')
    } finally { setWGenerating(false) }
  }

  const openReq = (reqNumero: string) => {
    const items = byReq[reqNumero] ?? []
    setReqItems(items)
    const entries: Record<string, EntryState> = {}
    items.forEach(r => {
      const ref = REF[r.analise.codigo]
      entries[r._id] = {
        valor:    r.valor      ?? '',
        unidade:  r.unidade    ?? ref?.unidade ?? '',
        flag:     r.flag === 'pendente' ? 'normal' : r.flag,
        equip:    r.equipamento ?? EQUIP[r.analise.codigo] ?? '',
        obs:      r.observacoes ?? '',
      }
    })
    setReqEntries(entries)
    setSaveMsg(''); setFormErr('')
    setPanel('req')
    /* marcar os pendentes como em_processamento */
    items.filter(r => r.estado === 'pendente').forEach(r => {
      api.put(`/resultados/${r._id}`, { estado: 'em_processamento' }).catch(() => {})
    })
  }

  const updateEntry = (id: string, patch: Partial<EntryState>) =>
    setReqEntries(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const handleSaveAll = async () => {
    const missing = reqItems.filter(r => !reqEntries[r._id]?.valor.trim())
    if (missing.length > 0) {
      setFormErr(`Faltam valores em: ${missing.map(r => r.analise.nome).join(', ')}`)
      return
    }
    setSavingAll(true); setFormErr(''); setSaveMsg('')
    try {
      await Promise.all(reqItems.map(r => {
        const e   = reqEntries[r._id]
        const ref = REF[r.analise.codigo]
        return api.put(`/resultados/${r._id}`, {
          valor:       e.valor,
          unidade:     e.unidade,
          flag:        e.flag,
          estado:      'resultado_disponivel',
          equipamento: e.equip  || undefined,
          observacoes: e.obs    || undefined,
          refMin:      ref?.min,
          refMax:      ref?.max,
        })
      }))
      setSaveMsg('✓ Todos os resultados guardados com sucesso')
      fetchResultados()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao guardar resultados')
    } finally { setSavingAll(false) }
  }

  const closePanel = () => { setPanel(null); setReqItems([]); setReqEntries({}); setSaveMsg(''); setFormErr(''); setWMsg('') }

  return (
    <motion.div
      className="an-page"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.45 }}
    >
      {/* top */}
      <div className="an-top">
        <button className="an-back" onClick={() => navigate('/')}>← voltar</button>
        <div className="an-identity">
          <span className="an-num">04</span>
          <h1 className="an-title">Análise</h1>
          <p className="an-sub">{seg.sub}</p>
        </div>
        <div className="an-kpis">
          <div className="an-kpi">
            <span className="an-kpi-val">{stats.pendente + stats.em_processamento}</span>
            <span className="an-kpi-lbl">em worklist</span>
          </div>
          <div className="an-kpi">
            <span className="an-kpi-val">{stats.disponivel}</span>
            <span className="an-kpi-lbl">disponíveis</span>
          </div>
          {stats.criticos > 0 && (
            <div className="an-kpi an-kpi--crit">
              <span className="an-kpi-val">{stats.criticos}</span>
              <span className="an-kpi-lbl">críticos</span>
            </div>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="an-toolbar">
        <div className="an-tabs">
          {(['todas', 'pendente', 'em_processamento', 'resultado_disponivel'] as FiltroEstado[]).map(e => (
            <button key={e} className={`an-tab ${filter === e ? 'an-tab--on' : ''}`}
              onClick={() => { setFilter(e); setPage(1) }}>
              {e === 'todas' ? 'Todas' : ESTADO_LABEL[e as EstadoR]}
            </button>
          ))}
        </div>
        <div className="an-toolbar-row2">
          <input className="an-search" placeholder="requisição · utente · amostra…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {canWrite && (
            <button className="an-btn-wl" onClick={() => { setWSearch(''); setWMsg(''); setPanel('worklist') }}>
              + worklist
            </button>
          )}
        </div>
      </div>

      {/* list grouped by requisição */}
      <div className="an-list-area">
        {loading ? (
          <div className="an-msg">a carregar…</div>
        ) : Object.keys(byReq).length === 0 ? (
          <div className="an-msg">sem resultados na worklist</div>
        ) : (
          Object.entries(byReq).map(([reqNum, items]) => {
            const allDone  = items.every(r => r.estado === 'resultado_disponivel')
            const pending  = items.filter(r => r.estado !== 'resultado_disponivel').length
            const hasCrit  = items.some(r => r.flag === 'critico_alto' || r.flag === 'critico_baixo')
            const utente   = items[0]?.utenteNome ?? ''
            const amostra  = items[0]?.codigoAmostra ?? ''

            return (
              <motion.div key={reqNum} className={`an-req-group ${hasCrit ? 'an-req-group--crit' : ''}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => openReq(reqNum)}>

                <div className="an-req-group-hd">
                  <span className="an-req-num">{reqNum}</span>
                  <span className="an-req-utente">{utente}</span>
                  <span className="an-req-amostra">{amostra}</span>
                  <div className="an-req-badges">
                    {hasCrit && <span className="an-req-crit-badge">⬆ crítico</span>}
                    <span className={`an-req-status ${allDone ? 'an-req-status--done' : 'an-req-status--pend'}`}>
                      {allDone ? '✓ Completo' : `${pending} pendente${pending !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <span className="an-arr">→</span>
                </div>

                <div className="an-req-tags">
                  {items.map(r => (
                    <span key={r._id} className={`an-req-tag an-req-tag--${r.estado} ${(r.flag === 'critico_alto' || r.flag === 'critico_baixo') ? 'an-req-tag--crit' : ''}`}>
                      {r.analise.codigo}
                      {FLAG_ICON[r.flag] && <span className="an-req-tag-flag">{FLAG_ICON[r.flag]}</span>}
                    </span>
                  ))}
                </div>
              </motion.div>
            )
          })
        )}
        {pages > 1 && (
          <div className="an-pag">
            <button className="an-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="an-pag-info">{page} / {pages} · {total} resultados</span>
            <button className="an-pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* panel */}
      <AnimatePresence>
        {panel && (
          <motion.aside className="an-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className="an-panel-hd">
              <button className="an-back an-back--panel" onClick={closePanel}>← fechar</button>
              <div className="an-panel-label">
                {panel === 'worklist' ? 'Gerar Worklist'
                  : `Introduzir resultados · ${reqItems[0]?.requisicaoNumero ?? ''}`}
              </div>
            </div>

            {/* ── WORKLIST GENERATOR ── */}
            {panel === 'worklist' && (
              <div className="an-form">
                <p className="an-wl-desc">
                  Pesquise uma amostra com estado <strong>Recebida</strong> para gerar automaticamente os registos de resultado na worklist.
                </p>
                <div className="an-ff">
                  <label className="an-ff-label">Amostra recebida</label>
                  <div className="an-wl-wrap">
                    <input className="an-input" placeholder="código ou nome do utente…"
                      value={wSearch} onChange={e => setWSearch(e.target.value)} />
                    {(wResult.length > 0 || wLoading) && (
                      <div className="an-wl-dropdown">
                        {wLoading ? (
                          <div className="an-wl-loading">a pesquisar…</div>
                        ) : wResult.map(a => (
                          <div key={a._id} className="an-wl-opt"
                            onClick={() => handleGerarWorklist(a._id)}>
                            <span className="an-wl-cod">{a.codigoAmostra}</span>
                            <span className="an-wl-utente">{a.utenteNome}</span>
                            {wGenerating ? <span className="an-wl-gen">a gerar…</span> : <span className="an-wl-gen">→ gerar</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {wMsg && <div className={`an-wl-msg ${wMsg.startsWith('✓') ? 'an-wl-msg--ok' : 'an-wl-msg--err'}`}>{wMsg}</div>}
              </div>
            )}

            {/* ── REQUISIÇÃO PANEL — introduzir todos os valores ── */}
            {panel === 'req' && (
              <div className="an-req-form">
                <div className="an-req-form-info">
                  <span className="an-req-form-num">{reqItems[0]?.requisicaoNumero}</span>
                  <span className="an-req-form-utente">{reqItems[0]?.utenteNome}</span>
                  <span className="an-req-form-count">{reqItems.length} análise{reqItems.length !== 1 ? 's' : ''}</span>
                </div>

                {formErr && <div className="an-form-err">{formErr}</div>}
                {saveMsg && <div className="an-form-ok">{saveMsg}</div>}

                <div className="an-req-rows">
                  {reqItems.map(r => {
                    const entry = reqEntries[r._id] ?? { valor: '', unidade: '', flag: 'normal' as Flag, equip: '', obs: '' }
                    const ref   = REF[r.analise.codigo]
                    const isCrit = entry.flag === 'critico_alto' || entry.flag === 'critico_baixo'

                    return (
                      <div key={r._id} className={`an-rr ${isCrit ? 'an-rr--crit' : ''}`}>
                        <div className="an-rr-hd">
                          <span className="an-rr-cod">{r.analise.codigo}</span>
                          <span className="an-rr-nome">{r.analise.nome}</span>
                          {ref && ref.tipo !== 'text' && (
                            <span className="an-rr-ref">
                              ref: {ref.min ?? '–'} – {ref.max ?? '–'} {ref.unidade}
                            </span>
                          )}
                          {r.estado === 'resultado_disponivel' && (
                            <span className="an-rr-done">✓</span>
                          )}
                        </div>

                        <div className="an-rr-inputs">
                          <input className="an-input an-input--sm"
                            placeholder={ref?.tipo === 'text' ? 'ex: Negativo, Ver relatório…' : '0.00'}
                            value={entry.valor}
                            onChange={e => {
                              const val  = e.target.value
                              const flag = calcFlag(val, r.analise.codigo)
                              updateEntry(r._id, { valor: val, flag })
                            }} />
                          <input className="an-input an-input--sm an-input--unit"
                            placeholder="unidade"
                            value={entry.unidade}
                            onChange={e => updateEntry(r._id, { unidade: e.target.value })} />
                          {entry.flag !== 'normal' && entry.flag !== 'pendente' && (
                            <span className={`an-rr-flag an-rr-flag--${entry.flag}`}>
                              {FLAG_ICON[entry.flag]} {entry.flag.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        <div className="an-rr-extra">
                          <input className="an-input an-input--sm" placeholder={EQUIP[r.analise.codigo] ?? 'equipamento'}
                            value={entry.equip}
                            onChange={e => updateEntry(r._id, { equip: e.target.value })} />
                          <input className="an-input an-input--sm" placeholder="observações (opcional)"
                            value={entry.obs}
                            onChange={e => updateEntry(r._id, { obs: e.target.value })} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="an-form-actions">
                  <button className="an-btn-cancel" onClick={closePanel}>Cancelar</button>
                  <button className="an-btn-save" onClick={handleSaveAll} disabled={savingAll}>
                    {savingAll ? 'a guardar…' : `Guardar ${reqItems.length} resultado${reqItems.length !== 1 ? 's' : ''}`}
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
