import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import './Requisicoes.css'

/* ── catálogo ── */
interface Analise { codigo: string; nome: string; categoria: string }

const CATALOGO: Analise[] = [
  { codigo: 'HEM01', nome: 'Hemograma Completo',          categoria: 'hematologia'   },
  { codigo: 'HEM02', nome: 'Reticulócitos',               categoria: 'hematologia'   },
  { codigo: 'COA01', nome: 'Coagulação (TP, APTT)',       categoria: 'coagulação'    },
  { codigo: 'COA02', nome: 'D-Dímero',                    categoria: 'coagulação'    },
  { codigo: 'BIO01', nome: 'Glicose',                     categoria: 'bioquímica'    },
  { codigo: 'BIO02', nome: 'Ureia',                       categoria: 'bioquímica'    },
  { codigo: 'BIO03', nome: 'Creatinina',                  categoria: 'bioquímica'    },
  { codigo: 'BIO04', nome: 'Ácido Úrico',                 categoria: 'bioquímica'    },
  { codigo: 'BIO05', nome: 'Ionograma (Na, K, Cl)',       categoria: 'bioquímica'    },
  { codigo: 'BIO06', nome: 'PCR',                         categoria: 'bioquímica'    },
  { codigo: 'BIO07', nome: 'ALT / AST',                   categoria: 'bioquímica'    },
  { codigo: 'BIO08', nome: 'GGT / ALP',                   categoria: 'bioquímica'    },
  { codigo: 'BIO09', nome: 'Bilirrubina Total / Direta',  categoria: 'bioquímica'    },
  { codigo: 'BIO10', nome: 'Proteína Total / Albumina',   categoria: 'bioquímica'    },
  { codigo: 'BIO11', nome: 'LDH',                         categoria: 'bioquímica'    },
  { codigo: 'BIO12', nome: 'CK Total',                    categoria: 'bioquímica'    },
  { codigo: 'BIO13', nome: 'Colesterol Total / LDL / HDL',categoria: 'bioquímica'    },
  { codigo: 'BIO14', nome: 'Triglicéridos',               categoria: 'bioquímica'    },
  { codigo: 'END01', nome: 'TSH',                         categoria: 'endocrinologia'},
  { codigo: 'END02', nome: 'T3 / T4 Livre',               categoria: 'endocrinologia'},
  { codigo: 'END03', nome: 'Cortisol',                    categoria: 'endocrinologia'},
  { codigo: 'END04', nome: 'Insulina',                    categoria: 'endocrinologia'},
  { codigo: 'IMU01', nome: 'IgA / IgG / IgM',            categoria: 'imunologia'    },
  { codigo: 'IMU02', nome: 'Complemento C3 / C4',         categoria: 'imunologia'    },
  { codigo: 'IMU03', nome: 'ANA / Anti-dsDNA',            categoria: 'imunologia'    },
  { codigo: 'MIC01', nome: 'Urocultura',                  categoria: 'microbiologia' },
  { codigo: 'MIC02', nome: 'Hemocultura',                 categoria: 'microbiologia' },
  { codigo: 'URI01', nome: 'Urina Tipo II',               categoria: 'urina'         },
  { codigo: 'URI02', nome: 'Microalbuminúria',            categoria: 'urina'         },
  { codigo: 'MAR01', nome: 'PSA Total / Livre',           categoria: 'marcadores'    },
  { codigo: 'MAR02', nome: 'CA 125',                      categoria: 'marcadores'    },
  { codigo: 'MAR03', nome: 'CA 19-9',                     categoria: 'marcadores'    },
  { codigo: 'MAR04', nome: 'CEA',                         categoria: 'marcadores'    },
]

const PERFIS = [
  { nome: 'Check-up Geral',       codigos: ['HEM01','BIO01','BIO02','BIO03','BIO05','BIO06','BIO07','BIO13','BIO14','END01','URI01'] },
  { nome: 'Hemograma + Bio',      codigos: ['HEM01','BIO01','BIO02','BIO03','BIO06'] },
  { nome: 'Painel Hepático',      codigos: ['BIO07','BIO08','BIO09','BIO10','BIO11'] },
  { nome: 'Painel Cardíaco',      codigos: ['BIO11','BIO12','BIO06','BIO13','BIO14'] },
  { nome: 'Tiroide',              codigos: ['END01','END02'] },
  { nome: 'Coagulação',           codigos: ['COA01','COA02'] },
  { nome: 'Marcadores Tumorais',  codigos: ['MAR01','MAR02','MAR03','MAR04'] },
]

const byCode = (codes: string[]) => CATALOGO.filter(a => codes.includes(a.codigo))

/* ── types ── */
type Estado = 'todas' | 'pendente' | 'em_curso' | 'concluida' | 'cancelada'
type Prioridade = 'normal' | 'urgente' | 'stat'

interface Requisicao {
  _id: string
  numeroRequisicao: string
  utente: string
  utenteNome: string
  utenteProcesso: string
  medicoSolicitante: string
  analises: Analise[]
  urgente: boolean
  prioridade: Prioridade
  estado: Exclude<Estado, 'todas'>
  prescricaoRef?: string
  observacoes?: string
  createdAt: string
}

interface UtenteOpt { _id: string; nome: string; numeroProcesso: string; sns: string }

interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const ESTADO_LABEL: Record<string, string> = {
  pendente:  'Pendente',
  em_curso:  'Em curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const ESTADO_NEXT: Record<string, string | null> = {
  pendente:  'em_curso',
  em_curso:  'concluida',
  concluida: null,
  cancelada: null,
}

/* ── component ── */
export default function Requisicoes({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [reqs, setReqs]   = useState<Requisicao[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState<Estado>('todas')
  const [search, setSearch] = useState('')
  const [debSearch, setDebSearch] = useState('')

  const [stats, setStats] = useState({ pendente: 0, em_curso: 0, urgentes: 0 })

  const [panel, setPanel] = useState<'detail' | 'create' | null>(null)
  const [selected, setSelected] = useState<Requisicao | null>(null)

  /* form state */
  const [fUtente, setFUtente]   = useState<UtenteOpt | null>(null)
  const [uSearch, setUSearch]   = useState('')
  const [uResults, setUResults] = useState<UtenteOpt[]>([])
  const [uLoading, setULoading] = useState(false)
  const [fAnalises, setFAnalises] = useState<Analise[]>([])
  const [catSearch, setCatSearch] = useState('')
  const [fMedico, setFMedico]     = useState('')
  const [fUrgente, setFUrgente]   = useState(false)
  const [fPrio, setFPrio]         = useState<Prioridade>('normal')
  const [fPrescricao, setFPrescricao] = useState('')
  const [fObs, setFObs]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState('')

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canCreate = ['administrador','tecnico','medico','enfermeiro'].includes(user?.role ?? '')
  const canUpdate = ['administrador','tecnico','medico'].includes(user?.role ?? '')
  const canCancel = ['administrador','medico'].includes(user?.role ?? '')

  /* debounce search */
  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDebSearch(search); setPage(1) }, 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  const fetchReqs = () => {
    setLoading(true)
    api.get('/requisicoes', {
      params: { estado: filter === 'todas' ? undefined : filter, search: debSearch, page, limit: 20 }
    }).then(({ data }) => {
      setReqs(data.data); setTotal(data.total); setPages(data.pages)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchReqs() }, [filter, debSearch, page])

  useEffect(() => {
    api.get('/requisicoes/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [reqs])

  /* utente typeahead */
  useEffect(() => {
    if (uTimer.current) clearTimeout(uTimer.current)
    if (uSearch.length < 2) { setUResults([]); return }
    uTimer.current = setTimeout(() => {
      setULoading(true)
      api.get('/utentes', { params: { search: uSearch, limit: 6 } })
        .then(({ data }) => setUResults(data.data))
        .finally(() => setULoading(false))
    }, 250)
    return () => { if (uTimer.current) clearTimeout(uTimer.current) }
  }, [uSearch])

  const openCreate = () => {
    setFUtente(null); setUSearch(''); setUResults([])
    setFAnalises([]); setCatSearch('')
    setFMedico(user?.nome ?? ''); setFUrgente(false); setFPrio('normal')
    setFPrescricao(''); setFObs(''); setFormErr('')
    setPanel('create')
  }

  const openDetail = (r: Requisicao) => { setSelected(r); setPanel('detail') }
  const closePanel = () => { setPanel(null); setSelected(null); setFormErr('') }

  const toggleAnalise = (a: Analise) => {
    setFAnalises(prev =>
      prev.find(x => x.codigo === a.codigo)
        ? prev.filter(x => x.codigo !== a.codigo)
        : [...prev, a]
    )
  }

  const addPerfil = (codigos: string[]) => {
    const toAdd = byCode(codigos).filter(a => !fAnalises.find(x => x.codigo === a.codigo))
    setFAnalises(prev => [...prev, ...toAdd])
  }

  const handleSave = async () => {
    if (!fUtente)           return setFormErr('Selecione um utente')
    if (fAnalises.length === 0) return setFormErr('Adicione pelo menos uma análise')
    if (!fMedico.trim())    return setFormErr('Indique o médico solicitante')
    setSaving(true); setFormErr('')
    try {
      await api.post('/requisicoes', {
        utente:            fUtente._id,
        utenteNome:        fUtente.nome,
        utenteProcesso:    fUtente.numeroProcesso,
        medicoSolicitante: fMedico,
        analises:          fAnalises,
        urgente:           fUrgente,
        prioridade:        fPrio,
        prescricaoRef:     fPrescricao || undefined,
        observacoes:       fObs || undefined,
      })
      closePanel(); fetchReqs()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao criar requisição')
    } finally { setSaving(false) }
  }

  const handleAdvanceEstado = async (r: Requisicao) => {
    const next = ESTADO_NEXT[r.estado]
    if (!next) return
    try {
      await api.put(`/requisicoes/${r._id}`, { estado: next })
      setSelected(prev => prev ? { ...prev, estado: next as any } : prev)
      fetchReqs()
    } catch {}
  }

  const handleCancel = async (r: Requisicao) => {
    if (!window.confirm(`Cancelar requisição ${r.numeroRequisicao}?`)) return
    try { await api.delete(`/requisicoes/${r._id}`); closePanel(); fetchReqs() } catch {}
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT')

  const catFiltered = CATALOGO.filter(a =>
    !catSearch || a.nome.toLowerCase().includes(catSearch.toLowerCase()) || a.codigo.toLowerCase().includes(catSearch.toLowerCase())
  )

  const catGroups = catFiltered.reduce<Record<string, Analise[]>>((acc, a) => {
    if (!acc[a.categoria]) acc[a.categoria] = []
    acc[a.categoria].push(a)
    return acc
  }, {})

  return (
    <motion.div
      className="rq-page"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.45 }}
    >
      {/* top */}
      <div className="rq-top">
        <button className="rq-back" onClick={() => navigate('/')}>← voltar</button>

        <div className="rq-identity">
          <span className="rq-num">02</span>
          <h1 className="rq-title">Requisições</h1>
          <p className="rq-sub">{seg.sub}</p>
        </div>

        <div className="rq-kpis">
          <div className="rq-kpi">
            <span className="rq-kpi-val">{stats.pendente}</span>
            <span className="rq-kpi-lbl">pendentes</span>
          </div>
          <div className="rq-kpi">
            <span className="rq-kpi-val">{stats.em_curso}</span>
            <span className="rq-kpi-lbl">em curso</span>
          </div>
          {stats.urgentes > 0 && (
            <div className="rq-kpi rq-kpi--urg">
              <span className="rq-kpi-val">{stats.urgentes}</span>
              <span className="rq-kpi-lbl">urgentes</span>
            </div>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="rq-toolbar">
        <div className="rq-tabs">
          {(['todas','pendente','em_curso','concluida','cancelada'] as Estado[]).map(e => (
            <button
              key={e}
              className={`rq-tab ${filter === e ? 'rq-tab--on' : ''}`}
              onClick={() => { setFilter(e); setPage(1) }}
            >
              {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
        <input
          className="rq-search"
          placeholder="pesquisar nº · utente · médico…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {canCreate && (
          <button className="rq-btn-new" onClick={openCreate}>+ nova</button>
        )}
      </div>

      {/* list */}
      <div className="rq-list-area">
        {loading ? (
          <div className="rq-msg">a carregar…</div>
        ) : reqs.length === 0 ? (
          <div className="rq-msg">sem resultados</div>
        ) : (
          <>
            <div className="rq-list">
              {reqs.map((r, i) => (
                <motion.div
                  key={r._id}
                  className="rq-row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => openDetail(r)}
                >
                  <div className="rq-row-left">
                    {r.urgente && <span className="rq-urg-dot" title="Urgente" />}
                    <div>
                      <div className="rq-row-num">{r.numeroRequisicao}</div>
                      <div className="rq-row-utente">{r.utenteNome}</div>
                    </div>
                  </div>
                  <div className="rq-row-mid">
                    <div className="rq-row-analises">
                      {r.analises.slice(0, 2).map(a => a.nome).join(' · ')}
                      {r.analises.length > 2 && <span className="rq-more"> +{r.analises.length - 2}</span>}
                    </div>
                    <div className="rq-row-meta">
                      {r.medicoSolicitante} · {fmt(r.createdAt)}
                    </div>
                  </div>
                  <div className="rq-row-right">
                    <span className={`rq-badge rq-badge--${r.estado}`}>{ESTADO_LABEL[r.estado]}</span>
                    <span className="rq-arr">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
            {pages > 1 && (
              <div className="rq-pag">
                <button className="rq-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <span className="rq-pag-info">{page} / {pages}</span>
                <button className="rq-pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* panel */}
      <AnimatePresence>
        {panel && (
          <motion.aside
            className="rq-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            <div className="rq-panel-hd">
              <button className="rq-back rq-back--panel" onClick={closePanel}>← fechar</button>
              <div className="rq-panel-label">
                {panel === 'detail' ? selected?.numeroRequisicao : 'Nova Requisição'}
              </div>
              {panel === 'detail' && selected?.urgente && (
                <span className="rq-panel-urg">URGENTE</span>
              )}
            </div>

            {/* ── DETAIL ── */}
            {panel === 'detail' && selected && (
              <div className="rq-detail">
                <div className="rq-detail-top">
                  <span className={`rq-badge rq-badge--${selected.estado} rq-badge--lg`}>
                    {ESTADO_LABEL[selected.estado]}
                  </span>
                  {selected.prioridade !== 'normal' && (
                    <span className="rq-prio-badge">{selected.prioridade.toUpperCase()}</span>
                  )}
                </div>

                <div className="rq-detail-section">
                  <div className="rq-detail-lbl">Utente</div>
                  <div className="rq-detail-val">{selected.utenteNome}</div>
                  <div className="rq-detail-sub">{selected.utenteProcesso}</div>
                </div>

                <div className="rq-detail-section">
                  <div className="rq-detail-lbl">Médico solicitante</div>
                  <div className="rq-detail-val">{selected.medicoSolicitante}</div>
                </div>

                <div className="rq-detail-section">
                  <div className="rq-detail-lbl">Análises solicitadas ({selected.analises.length})</div>
                  {Object.entries(
                    selected.analises.reduce<Record<string, Analise[]>>((acc, a) => {
                      if (!acc[a.categoria]) acc[a.categoria] = []
                      acc[a.categoria].push(a)
                      return acc
                    }, {})
                  ).map(([cat, items]) => (
                    <div key={cat} className="rq-detail-cat">
                      <div className="rq-detail-cat-title">{cat}</div>
                      {items.map(a => (
                        <div key={a.codigo} className="rq-detail-analise">
                          <span className="rq-detail-cod">{a.codigo}</span>
                          <span>{a.nome}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {selected.prescricaoRef && (
                  <div className="rq-detail-section">
                    <div className="rq-detail-lbl">Ref. prescrição eletrónica</div>
                    <div className="rq-detail-val">{selected.prescricaoRef}</div>
                  </div>
                )}
                {selected.observacoes && (
                  <div className="rq-detail-section">
                    <div className="rq-detail-lbl">Observações</div>
                    <div className="rq-detail-val">{selected.observacoes}</div>
                  </div>
                )}
                <div className="rq-detail-section">
                  <div className="rq-detail-lbl">Data</div>
                  <div className="rq-detail-val">{fmt(selected.createdAt)}</div>
                </div>

                <div className="rq-detail-actions">
                  {canUpdate && ESTADO_NEXT[selected.estado] && (
                    <button className="rq-btn-advance" onClick={() => handleAdvanceEstado(selected)}>
                      → {ESTADO_LABEL[ESTADO_NEXT[selected.estado]!]}
                    </button>
                  )}
                  {canCancel && selected.estado !== 'cancelada' && selected.estado !== 'concluida' && (
                    <button className="rq-btn-cancel-req" onClick={() => handleCancel(selected)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── CREATE ── */}
            {panel === 'create' && (
              <div className="rq-form">
                {formErr && <div className="rq-form-err">{formErr}</div>}

                {/* utente selector */}
                <div className="rq-fsection">
                  <div className="rq-fsection-title">Utente</div>
                  {fUtente ? (
                    <div className="rq-utente-selected">
                      <div className="rq-utente-nome">{fUtente.nome}</div>
                      <div className="rq-utente-meta">{fUtente.numeroProcesso} · SNS {fUtente.sns}</div>
                      <button className="rq-utente-clear" onClick={() => { setFUtente(null); setUSearch('') }}>× alterar</button>
                    </div>
                  ) : (
                    <div className="rq-utente-search-wrap">
                      <input
                        className="rq-input"
                        placeholder="pesquisar utente…"
                        value={uSearch}
                        onChange={e => setUSearch(e.target.value)}
                        autoComplete="off"
                      />
                      {(uResults.length > 0 || uLoading) && (
                        <div className="rq-utente-dropdown">
                          {uLoading ? (
                            <div className="rq-utente-loading">a pesquisar…</div>
                          ) : (
                            uResults.map(u => (
                              <div key={u._id} className="rq-utente-opt"
                                onClick={() => { setFUtente(u); setUSearch(''); setUResults([]) }}>
                                <span className="rq-utente-opt-nome">{u.nome}</span>
                                <span className="rq-utente-opt-meta">{u.numeroProcesso}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* médico */}
                <div className="rq-fsection">
                  <div className="rq-fsection-title">Médico solicitante</div>
                  <input className="rq-input" value={fMedico} onChange={e => setFMedico(e.target.value)} />
                </div>

                {/* perfis predefinidos */}
                <div className="rq-fsection">
                  <div className="rq-fsection-title">Perfis predefinidos</div>
                  <div className="rq-perfis">
                    {PERFIS.map(p => (
                      <button key={p.nome} className="rq-perfil-btn" onClick={() => addPerfil(p.codigos)}>
                        {p.nome}
                      </button>
                    ))}
                  </div>
                </div>

                {/* catálogo */}
                <div className="rq-fsection">
                  <div className="rq-fsection-title">
                    Análises
                    {fAnalises.length > 0 && <span className="rq-count"> ({fAnalises.length} selecionadas)</span>}
                  </div>

                  {fAnalises.length > 0 && (
                    <div className="rq-selected-chips">
                      {fAnalises.map(a => (
                        <span key={a.codigo} className="rq-chip" onClick={() => toggleAnalise(a)}>
                          {a.nome} ×
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    className="rq-input rq-input--sm"
                    placeholder="filtrar catálogo…"
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                  />

                  <div className="rq-catalog">
                    {Object.entries(catGroups).map(([cat, items]) => (
                      <div key={cat} className="rq-cat-group">
                        <div className="rq-cat-title">{cat}</div>
                        {items.map(a => (
                          <div
                            key={a.codigo}
                            className={`rq-cat-item ${fAnalises.find(x => x.codigo === a.codigo) ? 'rq-cat-item--on' : ''}`}
                            onClick={() => toggleAnalise(a)}
                          >
                            <span className="rq-cat-cod">{a.codigo}</span>
                            <span className="rq-cat-nome">{a.nome}</span>
                            <span className="rq-cat-check">{fAnalises.find(x => x.codigo === a.codigo) ? '✓' : ''}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* opções */}
                <div className="rq-fsection">
                  <div className="rq-fsection-title">Opções</div>
                  <div className="rq-opts-row">
                    <label className="rq-toggle-wrap">
                      <span className="rq-toggle-label">Urgente</span>
                      <button
                        className={`rq-toggle ${fUrgente ? 'rq-toggle--on' : ''}`}
                        onClick={() => { setFUrgente(v => !v); if (!fUrgente) setFPrio('urgente') }}
                      >
                        <span className="rq-toggle-knob" />
                      </button>
                    </label>
                    <div className="rq-ff rq-ff--inline">
                      <label className="rq-ff-label">Prioridade</label>
                      <select className="rq-input rq-input--sm" value={fPrio} onChange={e => setFPrio(e.target.value as Prioridade)}>
                        <option value="normal">Normal</option>
                        <option value="urgente">Urgente</option>
                        <option value="stat">STAT</option>
                      </select>
                    </div>
                  </div>
                  <div className="rq-ff">
                    <label className="rq-ff-label">Ref. prescrição eletrónica</label>
                    <input className="rq-input" value={fPrescricao} onChange={e => setFPrescricao(e.target.value)} placeholder="opcional" />
                  </div>
                  <div className="rq-ff">
                    <label className="rq-ff-label">Observações</label>
                    <textarea className="rq-input" rows={2} value={fObs} onChange={e => setFObs(e.target.value)} />
                  </div>
                </div>

                <div className="rq-form-actions">
                  <button className="rq-btn-cancel-form" onClick={closePanel}>Cancelar</button>
                  <button className="rq-btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? 'a guardar…' : 'Criar requisição'}
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
