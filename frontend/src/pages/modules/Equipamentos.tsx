import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import './Equipamentos.css'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}

type Tab = 'equipamentos' | 'reagentes' | 'manutencao'

interface IEquipamento {
  _id: string; nome: string; tipo: string; numeroSerie: string
  fabricante?: string; localizacao?: string
  estado: 'operacional' | 'manutencao' | 'avariado' | 'calibracao'
  dataUltimaCalibração?: string; proximaCalibração?: string
}
interface IReagente {
  _id: string; nome: string; codigo: string; lote: string
  validade: string; quantidadeAtual: number; quantidadeMinima: number
  unidade: string; fabricante?: string; localizacao?: string
}
interface IManutencao {
  _id: string; equipamentoNome: string; tipo: 'preventiva' | 'corretiva'
  descricao: string; tecnico: string; data: string
  duracaoHoras?: number; resolvido: boolean
}
interface IStats {
  operacionais: number; emManutencao: number
  calibracoesBreve: number; reagentesAlerta: number; manutencoesPendentes: number
}
interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const ESTADO_LABEL: Record<string, string> = {
  operacional: 'Operacional', manutencao: 'Em manutenção',
  avariado: 'Avariado', calibracao: 'Em calibração',
}

export default function Equipamentos({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const [tab,       setTab]       = useState<Tab>('equipamentos')
  const [eqs,       setEqs]       = useState<IEquipamento[]>([])
  const [reagentes, setReagentes] = useState<IReagente[]>([])
  const [manut,     setManut]     = useState<IManutencao[]>([])
  const [stats,     setStats]     = useState<IStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  /* form nova manutenção */
  const [showForm,    setShowForm]    = useState(false)
  const [fEqId,       setFEqId]       = useState('')
  const [fEqNome,     setFEqNome]     = useState('')
  const [fTipo,       setFTipo]       = useState<'preventiva' | 'corretiva'>('preventiva')
  const [fDesc,       setFDesc]       = useState('')
  const [fTecnico,    setFTecnico]    = useState('')
  const [fData,       setFData]       = useState('')
  const [fHoras,      setFHoras]      = useState('')
  const [fErr,        setFErr]        = useState('')

  /* form novo reagente */
  const [showRForm,  setShowRForm]   = useState(false)
  const [rNome,      setRNome]       = useState('')
  const [rCodigo,    setRCodigo]     = useState('')
  const [rLote,      setRLote]       = useState('')
  const [rValidade,  setRValidade]   = useState('')
  const [rQtdAtual,  setRQtdAtual]   = useState('')
  const [rQtdMin,    setRQtdMin]     = useState('')
  const [rUnidade,   setRUnidade]    = useState('un')
  const [rFab,       setRFab]        = useState('')
  const [rErr,       setRErr]        = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/equipamentos/stats'),
      api.get('/equipamentos/equipamentos'),
      api.get('/equipamentos/reagentes'),
      api.get('/equipamentos/manutencoes'),
    ]).then(([s, e, r, m]) => {
      setStats(s.data)
      setEqs(e.data.data ?? [])
      setReagentes(r.data.data ?? [])
      setManut(m.data.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const registarManutencao = async () => {
    if (!fEqId || !fDesc || !fTecnico) { setFErr('Preencha todos os campos obrigatórios.'); return }
    setSaving(true); setFErr('')
    try {
      await api.post('/equipamentos/manutencoes', {
        equipamento: fEqId, equipamentoNome: fEqNome,
        tipo: fTipo, descricao: fDesc, tecnico: fTecnico,
        data: fData || new Date().toISOString(),
        duracaoHoras: fHoras ? parseFloat(fHoras) : undefined,
      })
      const [s, e, m] = await Promise.all([
        api.get('/equipamentos/stats'),
        api.get('/equipamentos/equipamentos'),
        api.get('/equipamentos/manutencoes'),
      ])
      setStats(s.data); setEqs(e.data.data ?? []); setManut(m.data.data ?? [])
      setShowForm(false); setFEqId(''); setFEqNome(''); setFDesc(''); setFTecnico(''); setFData(''); setFHoras('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setFErr(err.response?.data?.message ?? 'Erro ao registar.')
    } finally { setSaving(false) }
  }

  const registarReagente = async () => {
    if (!rNome || !rCodigo || !rLote || !rValidade || !rQtdAtual || !rQtdMin) { setRErr('Preencha todos os campos obrigatórios.'); return }
    setSaving(true); setRErr('')
    try {
      await api.post('/equipamentos/reagentes', {
        nome: rNome, codigo: rCodigo, lote: rLote, validade: rValidade,
        quantidadeAtual: parseFloat(rQtdAtual), quantidadeMinima: parseFloat(rQtdMin),
        unidade: rUnidade, fabricante: rFab || undefined,
      })
      const r = await api.get('/equipamentos/reagentes')
      setReagentes(r.data.data ?? [])
      const s = await api.get('/equipamentos/stats'); setStats(s.data)
      setShowRForm(false); setRNome(''); setRCodigo(''); setRLote(''); setRValidade(''); setRQtdAtual(''); setRQtdMin(''); setRUnidade('un'); setRFab('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setRErr(err.response?.data?.message ?? 'Erro ao registar.')
    } finally { setSaving(false) }
  }

  const resolver = async (id: string) => {
    setSaving(true)
    try {
      await api.patch(`/equipamentos/manutencoes/${id}/resolver`)
      setManut(prev => prev.map(m => m._id === id ? { ...m, resolvido: true } : m))
      const s = await api.get('/equipamentos/stats'); setStats(s.data)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <motion.div className="eq-page" style={{ background: seg.color }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>

      <button className="eq-back" onClick={() => navigate('/')}>← voltar</button>

      <div className="eq-top">
        <div className="eq-num">0{seg.id}</div>
        <div className="eq-title">{seg.name}</div>
        <div className="eq-sub">{seg.sub}</div>
      </div>

      {/* KPIs */}
      <div className="eq-kpis">
        <div className="eq-kpi"><span className="eq-kpi-val">{loading ? '—' : stats?.operacionais ?? 0}</span><span className="eq-kpi-lbl">Operacionais</span></div>
        <div className="eq-kpi eq-kpi--warn"><span className="eq-kpi-val">{loading ? '—' : stats?.emManutencao ?? 0}</span><span className="eq-kpi-lbl">Em manutenção</span></div>
        <div className="eq-kpi eq-kpi--alert"><span className="eq-kpi-val">{loading ? '—' : stats?.reagentesAlerta ?? 0}</span><span className="eq-kpi-lbl">Reagentes em alerta</span></div>
        <div className="eq-kpi"><span className="eq-kpi-val">{loading ? '—' : stats?.calibracoesBreve ?? 0}</span><span className="eq-kpi-lbl">Calibrações esta semana</span></div>
      </div>

      {/* Tabs */}
      <div className="eq-tabs">
        <button className={`eq-tab${tab === 'equipamentos' ? ' eq-tab--on' : ''}`} onClick={() => setTab('equipamentos')}>Equipamentos</button>
        <button className={`eq-tab${tab === 'reagentes'    ? ' eq-tab--on' : ''}`} onClick={() => setTab('reagentes')}>
          Reagentes &amp; Stock
          {(stats?.reagentesAlerta ?? 0) > 0 && <span className="eq-badge">{stats!.reagentesAlerta}</span>}
        </button>
        <button className={`eq-tab${tab === 'manutencao'   ? ' eq-tab--on' : ''}`} onClick={() => setTab('manutencao')}>
          Manutenção
          {(stats?.manutencoesPendentes ?? 0) > 0 && <span className="eq-badge">{stats!.manutencoesPendentes}</span>}
        </button>
      </div>

      <div className="eq-content">

        {/* ═══ EQUIPAMENTOS ═══ */}
        {tab === 'equipamentos' && (
          <div className="eq-section">
            <div className="eq-sh"><span className="eq-stitle">Equipamentos de laboratório</span><span className="eq-cnt">{eqs.length}</span></div>
            {eqs.length === 0 && !loading && <div className="eq-empty">Sem equipamentos registados.</div>}
            <ul className="eq-list">
              {eqs.map(eq => {
                const open = expanded === eq._id
                return (
                  <li key={eq._id} className={`eq-item${open ? ' eq-item--open' : ''}`}>
                    <button className="eq-row" onClick={() => setExpanded(open ? null : eq._id)}>
                      <div className="eq-row-l">
                        <span className={`eq-estado-dot eq-estado-dot--${eq.estado}`} />
                        <div>
                          <div className="eq-nome">{eq.nome}</div>
                          <div className="eq-meta"><span className="eq-mono">{eq.tipo}</span>· S/N {eq.numeroSerie}</div>
                        </div>
                      </div>
                      <div className="eq-row-r">
                        <span className={`eq-estado eq-estado--${eq.estado}`}>{ESTADO_LABEL[eq.estado]}</span>
                        {eq.proximaCalibração && <span className="eq-cal">Cal. {fmtDate(eq.proximaCalibração)}</span>}
                        <span className="eq-chev">{open ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="eq-detail">
                        <div className="eq-detail-grid">
                          {eq.fabricante  && <div><div className="eq-dl-lbl">Fabricante</div><div>{eq.fabricante}</div></div>}
                          {eq.localizacao && <div><div className="eq-dl-lbl">Localização</div><div>{eq.localizacao}</div></div>}
                          {eq.dataUltimaCalibração && <div><div className="eq-dl-lbl">Última calibração</div><div>{fmtDate(eq.dataUltimaCalibração)}</div></div>}
                          {eq.proximaCalibração    && <div><div className="eq-dl-lbl">Próxima calibração</div><div>{fmtDate(eq.proximaCalibração)}</div></div>}
                        </div>
                        <div className="eq-acoes">
                          <button className="eq-btn eq-btn--manut" onClick={() => { setFEqId(eq._id); setFEqNome(eq.nome); setTab('manutencao'); setShowForm(true) }}>
                            Registar ocorrência
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* ═══ REAGENTES ═══ */}
        {tab === 'reagentes' && (
          <div className="eq-section">
            <div className="eq-sh">
              <span className="eq-stitle">Reagentes &amp; consumíveis</span>
              <button className="eq-btn-new" onClick={() => setShowRForm(v => !v)}>+ Novo reagente</button>
            </div>

            <AnimatePresence>
              {showRForm && (
                <motion.div className="eq-form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="eq-form-grid">
                    <div className="eq-field"><label className="eq-lbl">Nome *</label><input className="eq-input" value={rNome} onChange={e => setRNome(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Código *</label><input className="eq-input" value={rCodigo} onChange={e => setRCodigo(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Lote *</label><input className="eq-input" value={rLote} onChange={e => setRLote(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Validade *</label><input className="eq-input" type="date" value={rValidade} onChange={e => setRValidade(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Qtd. actual *</label><input className="eq-input" type="number" value={rQtdAtual} onChange={e => setRQtdAtual(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Qtd. mínima *</label><input className="eq-input" type="number" value={rQtdMin} onChange={e => setRQtdMin(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Unidade</label><input className="eq-input" value={rUnidade} onChange={e => setRUnidade(e.target.value)} placeholder="un" /></div>
                    <div className="eq-field"><label className="eq-lbl">Fabricante</label><input className="eq-input" value={rFab} onChange={e => setRFab(e.target.value)} /></div>
                  </div>
                  {rErr && <div className="eq-err">{rErr}</div>}
                  <div className="eq-form-btns"><button className="eq-btn eq-btn--save" disabled={saving} onClick={registarReagente}>{saving ? 'A guardar…' : 'Guardar reagente'}</button><button className="eq-btn eq-btn--cancel" onClick={() => setShowRForm(false)}>Cancelar</button></div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="eq-reagentes-table">
              <div className="eq-rt-header">
                <span>Reagente</span><span>Lote</span><span>Validade</span><span>Stock</span><span>Estado</span>
              </div>
              {reagentes.length === 0 && !loading && <div className="eq-empty">Sem reagentes registados.</div>}
              {reagentes.map(r => {
                const emAlerta = r.quantidadeAtual <= r.quantidadeMinima
                const pct = Math.min(100, Math.round((r.quantidadeAtual / Math.max(r.quantidadeMinima * 2, 1)) * 100))
                return (
                  <div key={r._id} className={`eq-rt-row${emAlerta ? ' eq-rt-row--alert' : ''}`}>
                    <div><div className="eq-nome">{r.nome}</div><div className="eq-mono" style={{ fontSize: 10 }}>{r.codigo}</div></div>
                    <div className="eq-mono" style={{ fontSize: 11 }}>{r.lote}</div>
                    <div style={{ fontSize: 12 }}>{fmtDate(r.validade)}</div>
                    <div>
                      <div className="eq-stock-bar-wrap"><div className="eq-stock-bar" style={{ width: `${pct}%`, background: emAlerta ? '#C8001A' : seg.color }} /></div>
                      <div style={{ fontSize: 10, marginTop: 3 }}>{r.quantidadeAtual} / {r.quantidadeMinima} {r.unidade}</div>
                    </div>
                    <div>{emAlerta ? <span className="eq-alerta">Abaixo do mínimo</span> : <span className="eq-ok">OK</span>}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ MANUTENÇÃO ═══ */}
        {tab === 'manutencao' && (
          <div className="eq-section">
            <div className="eq-sh">
              <span className="eq-stitle">Registos de manutenção</span>
              <button className="eq-btn-new" onClick={() => setShowForm(v => !v)}>+ Nova ocorrência</button>
            </div>

            <AnimatePresence>
              {showForm && (
                <motion.div className="eq-form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="eq-form-grid">
                    <div className="eq-field" style={{ gridColumn: '1/-1' }}>
                      <label className="eq-lbl">Equipamento *</label>
                      <select className="eq-input" value={fEqId} onChange={e => { const eq = eqs.find(x => x._id === e.target.value); setFEqId(e.target.value); setFEqNome(eq?.nome ?? '') }}>
                        <option value="">— Seleccionar —</option>
                        {eqs.map(eq => <option key={eq._id} value={eq._id}>{eq.nome}</option>)}
                      </select>
                    </div>
                    <div className="eq-field">
                      <label className="eq-lbl">Tipo *</label>
                      <div className="eq-radios">
                        <label className="eq-radio"><input type="radio" checked={fTipo === 'preventiva'} onChange={() => setFTipo('preventiva')} /> Preventiva</label>
                        <label className="eq-radio"><input type="radio" checked={fTipo === 'corretiva'} onChange={() => setFTipo('corretiva')} /> Corretiva</label>
                      </div>
                    </div>
                    <div className="eq-field"><label className="eq-lbl">Técnico responsável *</label><input className="eq-input" value={fTecnico} onChange={e => setFTecnico(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Data</label><input className="eq-input" type="datetime-local" value={fData} onChange={e => setFData(e.target.value)} /></div>
                    <div className="eq-field"><label className="eq-lbl">Duração (horas)</label><input className="eq-input" type="number" step="0.5" value={fHoras} onChange={e => setFHoras(e.target.value)} /></div>
                    <div className="eq-field" style={{ gridColumn: '1/-1' }}><label className="eq-lbl">Descrição *</label><textarea className="eq-textarea" rows={3} value={fDesc} onChange={e => setFDesc(e.target.value)} /></div>
                  </div>
                  {fErr && <div className="eq-err">{fErr}</div>}
                  <div className="eq-form-btns"><button className="eq-btn eq-btn--save" disabled={saving} onClick={registarManutencao}>{saving ? 'A guardar…' : 'Registar ocorrência'}</button><button className="eq-btn eq-btn--cancel" onClick={() => setShowForm(false)}>Cancelar</button></div>
                </motion.div>
              )}
            </AnimatePresence>

            {manut.length === 0 && !loading && !showForm && <div className="eq-empty">Sem registos de manutenção.</div>}
            <ul className="eq-list">
              {manut.map(m => (
                <li key={m._id} className={`eq-item${m.resolvido ? ' eq-item--resolved' : ''}`}>
                  <div className="eq-row eq-row--static">
                    <div className="eq-row-l">
                      <span className={`eq-tipo-badge eq-tipo-badge--${m.tipo}`}>{m.tipo}</span>
                      <div>
                        <div className="eq-nome">{m.equipamentoNome}</div>
                        <div className="eq-meta">{m.tecnico} · {fmtDate(m.data)}{m.duracaoHoras && ` · ${m.duracaoHoras}h`}</div>
                        <div style={{ fontSize: 12, color: 'rgba(26,18,8,0.6)', marginTop: 3 }}>{m.descricao}</div>
                      </div>
                    </div>
                    <div className="eq-row-r">
                      {m.resolvido
                        ? <span className="eq-ok">Resolvido</span>
                        : <button className="eq-btn eq-btn--resolver" disabled={saving} onClick={() => resolver(m._id)}>Marcar resolvido</button>
                      }
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  )
}
