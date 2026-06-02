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

/* ── types ── */
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

  const [resultados, setResultados] = useState<Resultado[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FiltroEstado>('todas')
  const [catFilter, setCatFilter] = useState('todas')
  const [search, setSearch]   = useState('')
  const [debSearch, setDebSearch] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [stats, setStats] = useState({ pendente: 0, em_processamento: 0, disponivel: 0, criticos: 0 })

  /* panel */
  const [panel, setPanel]     = useState<'entry' | 'detail' | 'worklist' | null>(null)
  const [selected, setSelected] = useState<Resultado | null>(null)

  /* entry form */
  const [fValor, setFValor]     = useState('')
  const [fUnidade, setFUnidade] = useState('')
  const [fFlag, setFFlag]       = useState<Flag>('normal')
  const [fEquip, setFEquip]     = useState('')
  const [fObs, setFObs]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  /* worklist amostra search */
  const [wSearch, setWSearch]   = useState('')
  const [wResult, setWResult]   = useState<{_id:string; codigoAmostra:string; utenteNome:string}[]>([])
  const [wLoading, setWLoading] = useState(false)
  const [wGenerating, setWGenerating] = useState(false)
  const [wMsg, setWMsg]         = useState('')

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canWrite = ['administrador','tecnico'].includes(user?.role ?? '')

  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDebSearch(search); setPage(1) }, 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  const fetchResultados = () => {
    setLoading(true)
    api.get('/resultados', {
      params: {
        estado:    filter === 'todas' ? undefined : filter,
        categoria: catFilter === 'todas' ? undefined : catFilter,
        search:    debSearch, page, limit: 50
      }
    }).then(({ data }) => {
      setResultados(data.data); setTotal(data.total); setPages(data.pages)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchResultados() }, [filter, catFilter, debSearch, page])

  useEffect(() => {
    api.get('/resultados/stats').then(({ data }) => setStats(data)).catch(() => {})
    api.get('/resultados/categorias').then(({ data }) => setCategorias(data)).catch(() => {})
  }, [resultados])

  /* group by category */
  const grouped = resultados.reduce<Record<string, Resultado[]>>((acc, r) => {
    const cat = r.analise.categoria
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
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

  const openEntry = (r: Resultado) => {
    const ref = REF[r.analise.codigo]
    setSelected(r)
    setFValor(r.valor ?? '')
    setFUnidade(r.unidade ?? ref?.unidade ?? '')
    setFFlag(r.flag === 'pendente' ? 'normal' : r.flag)
    setFEquip(r.equipamento ?? EQUIP[r.analise.codigo] ?? '')
    setFObs(r.observacoes ?? '')
    setFormErr('')
    setPanel('entry')
    if (r.estado === 'pendente') {
      api.put(`/resultados/${r._id}`, { estado: 'em_processamento' }).catch(() => {})
    }
  }

  const openDetail = (r: Resultado) => { setSelected(r); setPanel('detail') }
  const closePanel = () => { setPanel(null); setSelected(null); setFormErr(''); setWMsg('') }

  const handleValorChange = (v: string) => {
    setFValor(v)
    if (selected) setFFlag(calcFlag(v, selected.analise.codigo))
  }

  const handleSave = async () => {
    if (!fValor.trim()) return setFormErr('Introduza o valor do resultado')
    if (!selected) return
    setSaving(true); setFormErr('')
    try {
      const ref = REF[selected.analise.codigo]
      await api.put(`/resultados/${selected._id}`, {
        valor:       fValor,
        unidade:     fUnidade,
        flag:        fFlag,
        estado:      'resultado_disponivel',
        equipamento: fEquip || undefined,
        observacoes: fObs   || undefined,
        refMin:      ref?.min,
        refMax:      ref?.max,
      })
      closePanel(); fetchResultados()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao guardar resultado')
    } finally { setSaving(false) }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT')

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
          {(['todas','pendente','em_processamento','resultado_disponivel'] as FiltroEstado[]).map(e => (
            <button key={e} className={`an-tab ${filter === e ? 'an-tab--on' : ''}`}
              onClick={() => { setFilter(e); setPage(1) }}>
              {e === 'todas' ? 'Todas' : ESTADO_LABEL[e as EstadoR]}
            </button>
          ))}
        </div>
        <div className="an-toolbar-row2">
          <select className="an-select" value={catFilter}
            onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
            <option value="todas">todas as categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="an-search" placeholder="análise · utente · amostra…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {canWrite && (
            <button className="an-btn-wl" onClick={() => { setWSearch(''); setWMsg(''); setPanel('worklist') }}>
              + worklist
            </button>
          )}
        </div>
      </div>

      {/* list grouped by category */}
      <div className="an-list-area">
        {loading ? (
          <div className="an-msg">a carregar…</div>
        ) : resultados.length === 0 ? (
          <div className="an-msg">sem resultados na worklist</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="an-group">
              <div className="an-group-title">{cat}</div>
              {items.map((r, i) => (
                <motion.div key={r._id} className="an-row"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => r.estado === 'resultado_disponivel' ? openDetail(r) : openEntry(r)}>

                  <div className="an-row-analise">
                    <span className="an-row-cod">{r.analise.codigo}</span>
                    <span className="an-row-nome">{r.analise.nome}</span>
                  </div>

                  <div className="an-row-mid">
                    <span className="an-row-amostra">{r.codigoAmostra}</span>
                    <span className="an-sep">·</span>
                    <span className="an-row-utente">{r.utenteNome}</span>
                  </div>

                  <div className="an-row-right">
                    {r.equipamento && <span className="an-equip">{r.equipamento}</span>}
                    {r.valor && (
                      <span className={`an-valor an-valor--${r.flag}`}>
                        {r.valor} {r.unidade}
                        {FLAG_ICON[r.flag] && <span className="an-flag-icon">{FLAG_ICON[r.flag]}</span>}
                      </span>
                    )}
                    <span className={`an-badge an-badge--${r.estado}`}>{ESTADO_LABEL[r.estado]}</span>
                    <span className="an-arr">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ))
        )}
        {pages > 1 && (
          <div className="an-pag">
            <button className="an-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="an-pag-info">{page} / {pages}</span>
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
                  : panel === 'detail' ? selected?.analise.nome
                  : `Introduzir resultado · ${selected?.analise.nome}`}
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

            {/* ── RESULT DETAIL ── */}
            {panel === 'detail' && selected && (
              <div className="an-detail">
                <div className="an-detail-header">
                  <div className="an-detail-cod">{selected.codigoResultado}</div>
                  <span className={`an-flag-badge an-flag-badge--${selected.flag}`}>
                    {FLAG_ICON[selected.flag]} {selected.flag.replace('_', ' ')}
                  </span>
                </div>

                <div className="an-result-display">
                  <div className="an-result-valor">{selected.valor}</div>
                  <div className="an-result-unidade">{selected.unidade}</div>
                </div>

                {(selected.refMin !== undefined || selected.refMax !== undefined) && (
                  <div className="an-ref-bar-wrap">
                    <div className="an-ref-label">Valores de referência</div>
                    <div className="an-ref-range">
                      {selected.refMin !== undefined && <span>{selected.refMin}</span>}
                      <span className="an-ref-dash">—</span>
                      {selected.refMax !== undefined && <span>{selected.refMax}</span>}
                      <span className="an-ref-unit">{selected.unidade}</span>
                    </div>
                  </div>
                )}

                <div className="an-dfields">
                  <DField l="Análise"    v={`${selected.analise.codigo} · ${selected.analise.nome}`} />
                  <DField l="Amostra"    v={selected.codigoAmostra} />
                  <DField l="Utente"     v={selected.utenteNome} />
                  <DField l="Requisição" v={selected.requisicaoNumero} />
                  {selected.equipamento && <DField l="Equipamento" v={selected.equipamento} />}
                  {selected.observacoes && <DField l="Observações" v={selected.observacoes} />}
                  <DField l="Data"       v={fmt(selected.createdAt)} />
                </div>

                {canWrite && (
                  <button className="an-btn-reedit" onClick={() => openEntry(selected)}>
                    Corrigir resultado
                  </button>
                )}
              </div>
            )}

            {/* ── ENTRY FORM ── */}
            {panel === 'entry' && selected && (
              <div className="an-form">
                {formErr && <div className="an-form-err">{formErr}</div>}

                <div className="an-entry-header">
                  <div className="an-entry-analise">{selected.analise.nome}</div>
                  <div className="an-entry-meta">{selected.codigoAmostra} · {selected.utenteNome}</div>
                  {(() => {
                    const ref = REF[selected.analise.codigo]
                    if (!ref || ref.tipo === 'text') return null
                    return (
                      <div className="an-entry-ref">
                        Ref: {ref.min ?? '–'} – {ref.max ?? '–'} {ref.unidade}
                        {ref.criticoMax && <span className="an-crit-warn"> · crítico &gt;{ref.criticoMax}</span>}
                        {ref.criticoMin && <span className="an-crit-warn"> · crítico &lt;{ref.criticoMin}</span>}
                      </div>
                    )
                  })()}
                </div>

                <div className="an-fsection">
                  <div className="an-row2">
                    <div className="an-ff">
                      <label className="an-ff-label">Valor *</label>
                      <input className="an-input an-input--valor"
                        value={fValor} onChange={e => handleValorChange(e.target.value)}
                        placeholder={REF[selected.analise.codigo]?.tipo === 'text' ? 'ex: Negativo, Ver relatório…' : '0.00'}
                        autoFocus />
                    </div>
                    <div className="an-ff">
                      <label className="an-ff-label">Unidade</label>
                      <input className="an-input" value={fUnidade} onChange={e => setFUnidade(e.target.value)} />
                    </div>
                  </div>

                  {fValor && (
                    <div className={`an-flag-preview an-flag-preview--${fFlag}`}>
                      {fFlag === 'normal' ? '✓ Dentro dos valores de referência'
                        : fFlag === 'alto' ? '↑ Acima do valor máximo'
                        : fFlag === 'baixo' ? '↓ Abaixo do valor mínimo'
                        : fFlag === 'critico_alto' ? '⬆ VALOR CRÍTICO — acima do limite crítico'
                        : fFlag === 'critico_baixo' ? '⬇ VALOR CRÍTICO — abaixo do limite crítico'
                        : ''}
                    </div>
                  )}

                  <div className="an-ff">
                    <label className="an-ff-label">Flag (auto-calculado)</label>
                    <select className="an-input" value={fFlag} onChange={e => setFFlag(e.target.value as Flag)}>
                      <option value="normal">Normal</option>
                      <option value="alto">Alto ↑</option>
                      <option value="baixo">Baixo ↓</option>
                      <option value="critico_alto">Crítico alto ⬆</option>
                      <option value="critico_baixo">Crítico baixo ⬇</option>
                    </select>
                  </div>
                </div>

                <div className="an-fsection">
                  <div className="an-ff">
                    <label className="an-ff-label">Equipamento</label>
                    <input className="an-input" value={fEquip} onChange={e => setFEquip(e.target.value)} />
                  </div>
                  <div className="an-ff">
                    <label className="an-ff-label">Observações</label>
                    <textarea className="an-input" rows={2} value={fObs} onChange={e => setFObs(e.target.value)} />
                  </div>
                </div>

                <div className="an-form-actions">
                  <button className="an-btn-cancel" onClick={closePanel}>Cancelar</button>
                  <button className="an-btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? 'a guardar…' : 'Guardar resultado'}
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

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="an-dfield">
      <div className="an-dfield-l">{l}</div>
      <div className="an-dfield-v">{v}</div>
    </div>
  )
}
