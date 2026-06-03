import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import './Financeiro.css'

// ── preços catálogo ──
const PRECOS: Record<string, { nome: string; preco: number }> = {
  HEM:  { nome: 'Hemograma Completo',           preco: 8.50  },
  GLU:  { nome: 'Glicose',                       preco: 3.20  },
  CHOL: { nome: 'Colesterol Total',              preco: 3.80  },
  TG:   { nome: 'Triglicéridos',                 preco: 4.20  },
  HDL:  { nome: 'HDL Colesterol',                preco: 4.50  },
  LDL:  { nome: 'LDL Colesterol',                preco: 4.50  },
  CREA: { nome: 'Creatinina',                    preco: 3.50  },
  UREIA:{ nome: 'Ureia',                         preco: 3.50  },
  UA:   { nome: 'Ácido Úrico',                   preco: 3.80  },
  AST:  { nome: 'AST (GOT)',                     preco: 3.80  },
  ALT:  { nome: 'ALT (GPT)',                     preco: 3.80  },
  GGT:  { nome: 'Gama-GT',                       preco: 4.20  },
  FA:   { nome: 'Fosfatase Alcalina',            preco: 4.20  },
  BIL:  { nome: 'Bilirrubina Total',             preco: 4.50  },
  ALB:  { nome: 'Albumina',                      preco: 4.20  },
  PT:   { nome: 'Proteínas Totais',              preco: 3.80  },
  NA:   { nome: 'Sódio',                         preco: 3.50  },
  K:    { nome: 'Potássio',                      preco: 3.50  },
  CL:   { nome: 'Cloro',                         preco: 3.50  },
  CA:   { nome: 'Cálcio',                        preco: 3.80  },
  FE:   { nome: 'Ferro',                         preco: 4.50  },
  FERR: { nome: 'Ferritina',                     preco: 7.50  },
  TSH:  { nome: 'TSH',                           preco: 9.50  },
  T4L:  { nome: 'T4 Livre',                      preco: 9.50  },
  HBA1C:{ nome: 'HbA1c',                         preco: 11.00 },
  PCR:  { nome: 'PCR',                           preco: 6.80  },
  VSG:  { nome: 'Velocidade de Sedimentação',    preco: 3.20  },
  INR:  { nome: 'INR / Tempo de Protrombina',    preco: 5.50  },
  APTT: { nome: 'APTT',                          preco: 5.50  },
  PSA:  { nome: 'PSA Total',                     preco: 12.00 },
  CEA:  { nome: 'CEA',                           preco: 14.00 },
  B12:  { nome: 'Vitamina B12',                  preco: 10.50 },
  VITD: { nome: 'Vitamina D (25-OH)',            preco: 15.00 },
}

const SEGURADORAS = [
  { nome: 'Médis',       pct: 80 },
  { nome: 'AdvanceCare', pct: 75 },
  { nome: 'Multicare',   pct: 70 },
  { nome: 'Fidelidade',  pct: 65 },
  { nome: 'GNB Saúde',   pct: 72 },
]

const COMPART: Record<string, number> = { particular: 0, sns: 75, seguradora: 0 }

function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—'
  return new Date(d as string).toLocaleDateString('pt-PT')
}

type TabFin = 'todas' | 'rascunho' | 'emitida' | 'paga' | 'anulada'

interface IFatura {
  _id: string
  numeroFatura: string
  requisicaoNumero: string
  utenteNome: string
  tipo: string
  seguradora?: string
  linhas: { codigo: string; descricao: string; preco: number }[]
  valorBruto: number
  percentComparticipacao: number
  valorComparticipado: number
  valorLiquido: number
  estado: string
  referenciaPagamento?: string
  observacoes?: string
  dataEmissao?: string
  dataPagamento?: string
  createdAt: string
}

interface IReq {
  _id: string
  numeroRequisicao: string
  utenteNome: string
  analises: { codigo: string; nome: string }[]
}

interface IStats {
  faturacaoMes: number
  recebidoMes: number
  porEstado: { _id: string; count: number; valor: number }[]
}

export default function Financeiro({ seg }: { seg: { color: string; name: string } }) {
  const navigate = useNavigate()
  const [tab,      setTab]      = useState<TabFin>('todas')
  const [search,   setSearch]   = useState('')
  const [faturas,  setFaturas]  = useState<IFatura[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [stats,    setStats]    = useState<IStats | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<IFatura | null>(null)
  const [creating, setCreating] = useState(false)

  // form
  const [reqSearch,    setReqSearch]    = useState('')
  const [reqOptions,   setReqOptions]   = useState<IReq[]>([])
  const [reqLoading,   setReqLoading]   = useState(false)
  const [chosenReq,    setChosenReq]    = useState<IReq | null>(null)
  const [tipo,         setTipo]         = useState<'particular'|'sns'|'seguradora'>('particular')
  const [seguradora,   setSeguradora]   = useState('')
  const [linhas,       setLinhas]       = useState<{codigo:string;descricao:string;preco:number}[]>([])
  const [obs,          setObs]          = useState('')
  const [saving,       setSaving]       = useState(false)
  const [formErr,      setFormErr]      = useState('')
  const [showReqDrop,  setShowReqDrop]  = useState(false)
  const reqRef = useRef<HTMLDivElement>(null)

  const PAGES = Math.max(1, Math.ceil(total / 20))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (tab !== 'todas') params.estado = tab
      if (search) params.search = search
      const r = await api.get('/faturas', { params })
      setFaturas(r.data.data)
      setTotal(r.data.total)
    } catch { /* silêncio */ } finally { setLoading(false) }
  }, [tab, search, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/faturas/stats').then(r => setStats(r.data)).catch(() => {})
  }, [faturas])

  // req typeahead
  useEffect(() => {
    if (reqSearch.length < 2) { setReqOptions([]); return }
    setReqLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/faturas/requisicoes-livres')
        const q = reqSearch.toLowerCase()
        setReqOptions((r.data.data as IReq[]).filter(x =>
          x.numeroRequisicao.toLowerCase().includes(q) || x.utenteNome.toLowerCase().includes(q)
        ).slice(0, 8))
        setShowReqDrop(true)
      } catch { /* */ } finally { setReqLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [reqSearch])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reqRef.current && !reqRef.current.contains(e.target as Node)) setShowReqDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pickReq(r: IReq) {
    setChosenReq(r)
    setShowReqDrop(false)
    setReqSearch('')
    const ls = r.analises.map(a => ({
      codigo:    a.codigo,
      descricao: PRECOS[a.codigo]?.nome ?? a.nome,
      preco:     PRECOS[a.codigo]?.preco ?? 0,
    }))
    setLinhas(ls)
  }

  function calcTotais() {
    const bruto = linhas.reduce((s, l) => s + l.preco, 0)
    const pct   = tipo === 'seguradora'
      ? (SEGURADORAS.find(s => s.nome === seguradora)?.pct ?? 0)
      : COMPART[tipo]
    const comp   = bruto * pct / 100
    const liquid = bruto - comp
    return { bruto, pct, comp, liquid }
  }

  async function handleCreate() {
    if (!chosenReq) { setFormErr('Selecione uma requisição'); return }
    const { bruto, pct, comp, liquid } = calcTotais()
    setSaving(true); setFormErr('')
    try {
      const body = {
        requisicao:             chosenReq._id,
        requisicaoNumero:       chosenReq.numeroRequisicao,
        utente:                 chosenReq._id,
        utenteNome:             chosenReq.utenteNome,
        tipo,
        seguradora:             tipo === 'seguradora' ? seguradora : undefined,
        linhas,
        valorBruto:             bruto,
        percentComparticipacao: pct,
        valorComparticipado:    comp,
        valorLiquido:           liquid,
        observacoes:            obs,
      }
      await api.post('/faturas', body)
      setCreating(false); resetForm(); load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setFormErr(err.response?.data?.message ?? 'Erro ao criar fatura')
    } finally { setSaving(false) }
  }

  async function handleAction(action: 'emitir' | 'pagar' | 'anular') {
    if (!selected) return
    const map = { emitir: 'emitida', pagar: 'paga', anular: 'anulada' }
    try {
      const r = await api.patch(`/faturas/${selected._id}`, { estado: map[action] })
      setSelected(r.data)
      load()
    } catch { /* */ }
  }

  function resetForm() {
    setChosenReq(null); setReqSearch(''); setTipo('particular')
    setSeguradora(''); setLinhas([]); setObs(''); setFormErr('')
  }

  function openCreate() { resetForm(); setCreating(true); setSelected(null) }
  function openDetail(f: IFatura) { setSelected(f); setCreating(false) }

  const { bruto: prevBruto, pct: prevPct, comp: prevComp, liquid: prevLiquid } = calcTotais()

  const pendentes = (stats?.porEstado.find(s => s._id === 'emitida')?.valor ?? 0)

  return (
    <div className="fin-page" style={{ background: '#5A6478' }}>
      <button className="fin-back" onClick={() => navigate('/')}>← voltar</button>

      <div className="fin-top">
        <div className="fin-identity">
          <span className="fin-num">06</span>
          <h1 className="fin-title">Financeiro</h1>
          <p className="fin-sub">gestão de faturação e pagamentos</p>
        </div>
        <div className="fin-kpis">
          <div className="fin-kpi">
            <span className="fin-kpi-val">{fmtEur(stats?.faturacaoMes ?? 0)}</span>
            <span className="fin-kpi-lbl">faturado mês</span>
          </div>
          <div className="fin-kpi fin-kpi--rec">
            <span className="fin-kpi-val">{fmtEur(stats?.recebidoMes ?? 0)}</span>
            <span className="fin-kpi-lbl">recebido mês</span>
          </div>
          <div className="fin-kpi fin-kpi--pend">
            <span className="fin-kpi-val">{fmtEur(pendentes)}</span>
            <span className="fin-kpi-lbl">pendente</span>
          </div>
        </div>
      </div>

      <div className="fin-toolbar">
        <div className="fin-tabs">
          {(['todas','rascunho','emitida','paga','anulada'] as TabFin[]).map(t => (
            <button key={t} className={`fin-tab${tab === t ? ' fin-tab--on' : ''}`} onClick={() => { setTab(t); setPage(1) }}>
              {t}
            </button>
          ))}
        </div>
        <input
          className="fin-search"
          placeholder="pesquisar fatura / utente / requisição…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <button className="fin-btn-new" onClick={openCreate}>+ nova fatura</button>
      </div>

      <div className="fin-list-area">
        {loading && <div className="fin-msg">a carregar…</div>}
        {!loading && faturas.length === 0 && <div className="fin-msg">nenhuma fatura encontrada</div>}
        {!loading && faturas.length > 0 && (
          <div className="fin-list">
            {faturas.map(f => (
              <div key={f._id} className="fin-row" onClick={() => openDetail(f)}>
                <div className="fin-row-left">
                  <div className="fin-row-num">{f.numeroFatura}</div>
                  <div className="fin-row-utente">{f.utenteNome}</div>
                  <div className="fin-row-req">{f.requisicaoNumero}</div>
                </div>
                <div className="fin-row-mid">
                  <span className={`fin-tipo fin-tipo--${f.tipo}`}>{f.tipo}</span>
                  {f.seguradora && <span className="fin-seg">{f.seguradora}</span>}
                </div>
                <div className="fin-row-right">
                  <span className="fin-valor">{fmtEur(f.valorLiquido)}</span>
                  <span className={`fin-badge fin-badge--${f.estado}`}>{f.estado}</span>
                  <span className="fin-arr">›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {PAGES > 1 && (
          <div className="fin-pag">
            <button className="fin-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="fin-pag-info">{page} / {PAGES}</span>
            <button className="fin-pag-btn" disabled={page >= PAGES} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* ── panel ── */}
      <AnimatePresence>
        {(selected || creating) && (
          <motion.div
            className="fin-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="fin-panel-hd">
              <button className="fin-back fin-back--panel" onClick={() => { setSelected(null); setCreating(false) }}>← fechar</button>
              <div className="fin-panel-label">
                {creating ? 'Nova Fatura' : selected?.numeroFatura}
              </div>
            </div>

            {creating && (
              <div className="fin-form">
                {formErr && <div className="fin-form-err">{formErr}</div>}

                <div className="fin-fsection">
                  <div className="fin-fsection-title">Requisição</div>
                  {!chosenReq ? (
                    <div className="fin-req-wrap" ref={reqRef}>
                      <input
                        className="fin-input"
                        placeholder="pesquisar requisição ou utente…"
                        value={reqSearch}
                        onChange={e => setReqSearch(e.target.value)}
                        onFocus={() => reqSearch.length >= 2 && setShowReqDrop(true)}
                      />
                      {showReqDrop && (
                        <div className="fin-req-dropdown">
                          {reqLoading && <div className="fin-req-loading">a procurar…</div>}
                          {!reqLoading && reqOptions.length === 0 && (
                            <div className="fin-req-loading">sem resultados</div>
                          )}
                          {reqOptions.map(r => (
                            <div key={r._id} className="fin-req-opt" onClick={() => pickReq(r)}>
                              <span className="fin-req-opt-num">{r.numeroRequisicao}</span>
                              <span className="fin-req-opt-nome">{r.utenteNome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="fin-req-selected">
                      <div className="fin-req-num">{chosenReq.numeroRequisicao}</div>
                      <div className="fin-req-utente">{chosenReq.utenteNome}</div>
                      <button className="fin-req-clear" onClick={() => { setChosenReq(null); setLinhas([]) }}>× limpar</button>
                    </div>
                  )}
                </div>

                {chosenReq && (
                  <>
                    <div className="fin-fsection">
                      <div className="fin-fsection-title">Tipo de Faturação</div>
                      <div className="fin-tipo-row">
                        {(['particular','sns','seguradora'] as const).map(t => (
                          <button key={t} className={`fin-tipo-btn${tipo === t ? ' fin-tipo-btn--on' : ''}`} onClick={() => setTipo(t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                      {tipo === 'sns' && (
                        <div className="fin-compart-info">Comparticipação SNS: 75%</div>
                      )}
                      {tipo === 'seguradora' && (
                        <div className="fin-ff">
                          <label className="fin-ff-label">Seguradora</label>
                          <select className="fin-input" value={seguradora} onChange={e => setSeguradora(e.target.value)}>
                            <option value="">— escolher —</option>
                            {SEGURADORAS.map(s => (
                              <option key={s.nome} value={s.nome}>{s.nome} ({s.pct}%)</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="fin-fsection">
                      <div className="fin-fsection-title">Linhas ({linhas.length})</div>
                      <div className="fin-linhas-preview">
                        {linhas.map((l, i) => (
                          <div key={i} className="fin-linha-preview">
                            <span className="fin-linha-cod">{l.codigo}</span>
                            <span className="fin-linha-desc">{l.descricao}</span>
                            <input
                              className="fin-input fin-input--preco"
                              type="number" step="0.01" value={l.preco}
                              onChange={e => {
                                const updated = [...linhas]
                                updated[i] = { ...updated[i], preco: parseFloat(e.target.value) || 0 }
                                setLinhas(updated)
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="fin-totais fin-totais--preview">
                        <div className="fin-total-row">
                          <span>Bruto</span><span>{fmtEur(prevBruto)}</span>
                        </div>
                        {prevPct > 0 && (
                          <div className="fin-total-row fin-total-row--comp">
                            <span>Comparticipação ({prevPct}%)</span>
                            <span>− {fmtEur(prevComp)}</span>
                          </div>
                        )}
                        <div className="fin-total-row fin-total-row--final">
                          <span>Total a pagar</span><span>{fmtEur(prevLiquid)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="fin-fsection">
                      <div className="fin-ff">
                        <label className="fin-ff-label">Observações</label>
                        <textarea className="fin-input" rows={3} value={obs} onChange={e => setObs(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="fin-form-actions">
                  <button className="fin-btn-cancel" onClick={() => setCreating(false)}>cancelar</button>
                  <button className="fin-btn-save" disabled={saving || !chosenReq} onClick={handleCreate}>
                    {saving ? 'a guardar…' : 'criar rascunho'}
                  </button>
                </div>
              </div>
            )}

            {selected && !creating && (
              <div className="fin-detail">
                <div className="fin-detail-header">
                  <span className={`fin-badge fin-badge--${selected.estado} fin-badge--lg`}>{selected.estado}</span>
                  <span className={`fin-tipo fin-tipo--${selected.tipo}`}>{selected.tipo}</span>
                  {selected.seguradora && <span className="fin-seg">{selected.seguradora}</span>}
                </div>

                <div className="fin-invoice">
                  <div className="fin-invoice-utente">{selected.utenteNome}</div>
                  <div className="fin-invoice-meta">{selected.requisicaoNumero}</div>
                  <div className="fin-invoice-date">
                    {selected.dataEmissao ? `Emitida: ${fmtDate(selected.dataEmissao)}` : `Criada: ${fmtDate(selected.createdAt)}`}
                    {selected.dataPagamento ? ` · Paga: ${fmtDate(selected.dataPagamento)}` : ''}
                  </div>
                </div>

                <div className="fin-linhas">
                  <div className="fin-linhas-header">
                    <span>Descrição</span><span>Valor</span>
                  </div>
                  {selected.linhas.map((l, i) => (
                    <div key={i} className="fin-linha">
                      <span className="fin-linha-cod">{l.codigo}</span>
                      <span className="fin-linha-desc">{l.descricao}</span>
                      <span className="fin-linha-preco">{fmtEur(l.preco)}</span>
                    </div>
                  ))}
                </div>

                <div className="fin-totais">
                  <div className="fin-total-row">
                    <span>Subtotal</span><span>{fmtEur(selected.valorBruto)}</span>
                  </div>
                  {selected.percentComparticipacao > 0 && (
                    <div className="fin-total-row fin-total-row--comp">
                      <span>Comparticipação ({selected.percentComparticipacao}%)</span>
                      <span>− {fmtEur(selected.valorComparticipado)}</span>
                    </div>
                  )}
                  <div className="fin-total-row fin-total-row--final">
                    <span>Total</span><span>{fmtEur(selected.valorLiquido)}</span>
                  </div>
                </div>

                {selected.observacoes && (
                  <div className="fin-obs"><span>obs: </span>{selected.observacoes}</div>
                )}

                <div className="fin-detail-actions">
                  {selected.estado === 'rascunho' && (
                    <button className="fin-btn-action" onClick={() => handleAction('emitir')}>emitir fatura</button>
                  )}
                  {selected.estado === 'emitida' && (
                    <button className="fin-btn-action fin-btn-action--pay" onClick={() => handleAction('pagar')}>marcar paga</button>
                  )}
                  {(selected.estado === 'rascunho' || selected.estado === 'emitida') && (
                    <button className="fin-btn-action fin-btn-action--anular" onClick={() => handleAction('anular')}>anular</button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
