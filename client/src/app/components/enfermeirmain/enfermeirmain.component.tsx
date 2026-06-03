import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../api/axios'
import { useAuthStore } from '../../../store/authStore'
import '../staffportal/staffportal.css'
import './enfermeirmain.component.css'

/* ── utils ── */
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}

/* ── types ── */
type EstadoAmostra = 'aguarda_colheita' | 'colhida' | 'em_transito' | 'recebida' | 'rejeitada'
type Tab = 'colheitas' | 'agendar' | 'utentes'

interface IAmostra {
  _id: string; codigoAmostra: string; requisicaoNumero: string
  utenteNome: string; utenteProcesso: string
  tubos: { tipo: string; analises: string[] }[]
  tipoColheita: 'presencial' | 'domiciliaria'
  moradaColheita?: string; dataHoraColheita?: string
  tecnico?: string; temperatura?: number
  estado: EstadoAmostra; motivoRejeicao?: string; observacoes?: string; createdAt: string
}
interface IReqOpt {
  _id: string; numeroRequisicao: string
  utenteNome: string; utenteProcesso: string; utente: string
  analises: { codigo: string; nome: string }[]
}
interface IUtente {
  _id: string; processo: string; nome: string; sns: string; nif: string
  dataNascimento: string; contacto: string; email?: string
}

/* ── tube helpers ── */
const ANALISE_TUBO: Record<string, string> = {
  HEM01:'edta', HEM02:'edta', MIC02:'edta',
  COA01:'citrato', COA02:'citrato',
  BIO01:'gel', BIO02:'gel', BIO03:'gel', BIO04:'gel', BIO05:'gel',
  BIO06:'gel', BIO07:'gel', BIO08:'gel', BIO09:'gel', BIO10:'gel',
  BIO11:'gel', BIO12:'gel', BIO13:'gel', BIO14:'gel',
  END01:'gel', END02:'gel', END03:'gel', END04:'gel',
  IMU01:'gel', IMU02:'gel', IMU03:'gel',
  MAR01:'gel', MAR02:'gel', MAR03:'gel', MAR04:'gel',
  MIC01:'urina', URI01:'urina', URI02:'urina',
}
const TUBO_COR: Record<string, string> = {
  edta:'#9B59B6', citrato:'#3498DB', gel:'#F1C40F',
  heparina:'#27AE60', urina:'#CDD6DD', outro:'#95A5A6',
}
const TUBO_LBL: Record<string, string> = {
  edta:'EDTA', citrato:'Citrato', gel:'Gel/SST',
  heparina:'Heparina', urina:'Urina', outro:'Outro',
}
const EST_LBL: Record<string, string> = {
  aguarda_colheita:'Aguarda colheita', colhida:'Colhida',
  em_transito:'Em trânsito', recebida:'Recebida', rejeitada:'Rejeitada',
}

function buildTubos(analises: { codigo: string; nome: string }[]) {
  const g: Record<string, string[]> = {}
  for (const a of analises) {
    const t = ANALISE_TUBO[a.codigo] ?? 'gel'
    if (!g[t]) g[t] = []
    g[t].push(a.nome)
  }
  return Object.entries(g).map(([tipo, nomes]) => ({ tipo, analises: nomes }))
}

/* ══════════════════════════════════════════ */
export default function EnfermeiromainComponent() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [tab,      setTab]      = useState<Tab>('colheitas')
  const [amostras, setAmostras] = useState<IAmostra[]>([])
  const [reqs,     setReqs]     = useState<IReqOpt[]>([])
  const [utentes,  setUtentes]  = useState<IUtente[]>([])
  const [stats,    setStats]    = useState({ aguardaColheita: 0, emTransito: 0, domiciliarias: 0 })
  const [loading,  setLoading]  = useState(true)
  const [filtro,   setFiltro]   = useState<EstadoAmostra | 'todas'>('todas')
  const [search,   setSearch]   = useState('')
  const [utenteQ,  setUtenteQ]  = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  /* form agendar */
  const [formReq,    setFormReq]    = useState<IReqOpt | null>(null)
  const [formTipo,   setFormTipo]   = useState<'presencial' | 'domiciliaria'>('presencial')
  const [formMorada, setFormMorada] = useState('')
  const [formData,   setFormData]   = useState('')
  const [formObs,    setFormObs]    = useState('')
  const [formErr,    setFormErr]    = useState('')
  const [formOk,     setFormOk]     = useState('')

  /* ── load ── */
  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/amostras/stats'),
      api.get('/amostras?limit=50'),
      api.get('/requisicoes?estado=pendente&limit=50'),
    ]).then(([s, am, rq]) => {
      if (!active) return
      const sd = s.data
      setStats({
        aguardaColheita: sd.aguarda_colheita ?? sd.aguardaColheita ?? 0,
        emTransito:      sd.em_transito      ?? sd.emTransito      ?? 0,
        domiciliarias:   sd.domiciliarias    ?? 0,
      })
      setAmostras(am.data.data ?? am.data ?? [])
      setReqs(rq.data.data ?? rq.data ?? [])
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  /* reload amostras por filtro */
  const reloadAmostras = useCallback((est: EstadoAmostra | 'todas') => {
    const u = est === 'todas' ? '/amostras?limit=50' : `/amostras?estado=${est}&limit=50`
    api.get(u).then(r => setAmostras(r.data.data ?? r.data ?? [])).catch(() => {})
  }, [])

  /* pesquisa utentes */
  useEffect(() => {
    if (!utenteQ.trim()) { setUtentes([]); return }
    const t = setTimeout(() => {
      api.get(`/utentes?search=${encodeURIComponent(utenteQ)}&limit=20`)
        .then(r => setUtentes(r.data.data ?? r.data ?? [])).catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [utenteQ])

  const amostrasFilt = search
    ? amostras.filter(a =>
        a.utenteNome.toLowerCase().includes(search.toLowerCase()) ||
        a.codigoAmostra.toLowerCase().includes(search.toLowerCase()) ||
        a.requisicaoNumero.toLowerCase().includes(search.toLowerCase()))
    : amostras

  /* avançar estado */
  const avancar = async (id: string, estado: EstadoAmostra) => {
    setSaving(true)
    try {
      await api.put(`/amostras/${id}`, { estado })
      setAmostras(prev => prev.map(a => a._id === id ? { ...a, estado } : a))
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  /* criar colheita */
  const criarColheita = async () => {
    if (!formReq) { setFormErr('Seleccione uma requisição.'); return }
    setFormErr(''); setSaving(true)
    try {
      const body: Record<string, unknown> = {
        requisicao: formReq._id, utente: formReq.utente,
        tubos: buildTubos(formReq.analises),
        tipoColheita: formTipo,
        observacoes: formObs || undefined,
        dataHoraColheita: formData || undefined,
      }
      if (formTipo === 'domiciliaria') body.moradaColheita = formMorada
      await api.post('/amostras', body)
      setFormOk('Colheita registada com sucesso.'); setFormReq(null)
      setFormTipo('presencial'); setFormMorada(''); setFormObs(''); setFormData('')
      const [s, am] = await Promise.all([api.get('/amostras/stats'), api.get('/amostras?limit=50')])
      const sd = s.data
      setStats({ aguardaColheita: sd.aguarda_colheita ?? 0, emTransito: sd.em_transito ?? 0, domiciliarias: sd.domiciliarias ?? 0 })
      setAmostras(am.data.data ?? am.data ?? [])
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setFormErr(err.response?.data?.message ?? 'Erro ao registar.')
    } finally { setSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="staff-portal staff-portal--enfermeiro">
      <header className="staff-hd">
        <div className="staff-logo">Lab<strong>System</strong> Pro</div>
        <div className="staff-badge">Portal Enfermagem</div>
        <div className="staff-user">
          <div>
            <div className="staff-user-name">{user?.nome}</div>
            <div className="staff-user-role">enfermeiro · {new Date().toLocaleDateString('pt-PT')}</div>
          </div>
          <button className="staff-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      <section className="staff-hero">
        <div>
          <div className="staff-greeting">Bom dia, <em>{user?.nome?.split(' ')[0] || 'Enfermeiro'}</em></div>
          <div className="staff-actions">
            <button className="staff-btn-primary" onClick={() => setTab('agendar')}>+ agendar colheita</button>
            <button className="staff-btn-ghost" onClick={() => setTab('utentes')}>pesquisar utente</button>
          </div>
        </div>

      {/* KPIs */}
      <div className="staff-kpis enf-kpis">
        <button className="enf-kpi" onClick={() => { setTab('colheitas'); setFiltro('aguarda_colheita'); reloadAmostras('aguarda_colheita') }}>
          <span className="enf-kpi-num">{loading ? '—' : stats.aguardaColheita}</span>
          <span className="enf-kpi-lbl">Aguardam colheita</span>
        </button>
        <button className="enf-kpi" onClick={() => { setTab('colheitas'); setFiltro('em_transito'); reloadAmostras('em_transito') }}>
          <span className="enf-kpi-num">{loading ? '—' : stats.emTransito}</span>
          <span className="enf-kpi-lbl">Em trânsito</span>
        </button>
        <button className="enf-kpi enf-kpi--dest" onClick={() => { setTab('colheitas'); setFiltro('todas'); reloadAmostras('todas') }}>
          <span className="enf-kpi-num">{loading ? '—' : stats.domiciliarias}</span>
          <span className="enf-kpi-lbl">Domiciliárias</span>
        </button>
        <button className="enf-kpi" onClick={() => setTab('agendar')}>
          <span className="enf-kpi-num">{loading ? '—' : reqs.length}</span>
          <span className="enf-kpi-lbl">Requisições pendentes</span>
        </button>
      </div>
      </section>

      {/* Tabs */}
      <nav className="staff-tabs enf-tabs">
        <button className={`enf-tab${tab==='colheitas'?' enf-tab--on':''}`} onClick={() => setTab('colheitas')}>Colheitas &amp; Amostras</button>
        <button className={`enf-tab${tab==='agendar'  ?' enf-tab--on':''}`} onClick={() => setTab('agendar')}>
          Agendar colheita{reqs.length > 0 && <span className="enf-badge">{reqs.length}</span>}
        </button>
        <button className={`enf-tab${tab==='utentes'  ?' enf-tab--on':''}`} onClick={() => setTab('utentes')}>Utentes</button>
      </nav>

      <main className="staff-content">

      {/* ═══ COLHEITAS ═══ */}
      {tab === 'colheitas' && (
        <div className="enf-section">
          <div className="enf-toolbar">
            <div className="enf-filtros">
              {(['todas','aguarda_colheita','colhida','em_transito','recebida','rejeitada'] as const).map(f => (
                <button key={f} className={`enf-fbtn${filtro===f?' enf-fbtn--on':''}`}
                  onClick={() => { setFiltro(f); reloadAmostras(f) }}>
                  {f === 'todas' ? 'Todas' : EST_LBL[f]}
                </button>
              ))}
            </div>
            <input className="enf-search" placeholder="Pesquisar utente, código…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="enf-sh">
            <span className="enf-stitle">Amostras</span>
            <span className="enf-cnt">{amostrasFilt.length} registo{amostrasFilt.length!==1?'s':''}</span>
          </div>
          {amostrasFilt.length === 0
            ? <div className="enf-empty">Nenhuma amostra encontrada.</div>
            : <ul className="enf-list">
                {amostrasFilt.map(am => {
                  const open = expanded === am._id
                  return (
                    <li key={am._id} className={`enf-item${open?' enf-item--open':''}`}>
                      <button className="enf-row" onClick={() => setExpanded(open ? null : am._id)}>
                        <div className="enf-row-l">
                          <div className="enf-dots">{am.tubos.map((t,i) => <span key={i} className="enf-dot" style={{background: TUBO_COR[t.tipo]??'#95A5A6'}} />)}</div>
                          <div>
                            <div className="enf-nome">{am.utenteNome}</div>
                            <div className="enf-meta">
                              <span className="enf-mono">{am.codigoAmostra}</span>·
                              <span className="enf-mono">{am.requisicaoNumero}</span>
                              {am.tipoColheita==='domiciliaria' && <span className="enf-tag-dom">domicílio</span>}
                            </div>
                          </div>
                        </div>
                        <div className="enf-row-r">
                          <span className={`enf-est enf-est--${am.estado.replace('_','-')}`}>{EST_LBL[am.estado]}</span>
                          <span className="enf-data">{fmtDate(am.createdAt)}</span>
                          <span className="enf-chev">{open?'▲':'▼'}</span>
                        </div>
                      </button>
                      {open && (
                        <div className="enf-detail">
                          <div className="enf-dl">
                            <div className="enf-dl-lbl">Guia de tubos</div>
                            {am.tubos.map((t,i) => (
                              <div key={i} className="enf-tubo-row">
                                <span className="enf-tsw" style={{background: TUBO_COR[t.tipo]??'#95A5A6'}} />
                                <div><div className="enf-tnm">{TUBO_LBL[t.tipo]??t.tipo}</div><div className="enf-tan">{t.analises.join(' · ')}</div></div>
                              </div>
                            ))}
                          </div>
                          <div className="enf-dl-grid">
                            <div className="enf-dl"><div className="enf-dl-lbl">Processo</div><div className="enf-mono">{am.utenteProcesso}</div></div>
                            <div className="enf-dl"><div className="enf-dl-lbl">Tipo</div><div>{am.tipoColheita==='domiciliaria'?'Domiciliária':'Presencial'}</div></div>
                            {am.dataHoraColheita && <div className="enf-dl"><div className="enf-dl-lbl">Data / hora</div><div>{fmtDateTime(am.dataHoraColheita)}</div></div>}
                            {am.tecnico && <div className="enf-dl"><div className="enf-dl-lbl">Técnico</div><div>{am.tecnico}</div></div>}
                            {am.temperatura !== undefined && <div className="enf-dl"><div className="enf-dl-lbl">Temperatura</div><div>{am.temperatura} °C</div></div>}
                            {am.moradaColheita && <div className="enf-dl"><div className="enf-dl-lbl">Morada</div><div>{am.moradaColheita}</div></div>}
                          </div>
                          {am.observacoes   && <div className="enf-dl"><div className="enf-dl-lbl">Observações</div><div className="enf-obs">{am.observacoes}</div></div>}
                          {am.motivoRejeicao && <div className="enf-dl"><div className="enf-dl-lbl">Motivo rejeição</div><div className="enf-obs enf-obs--rej">{am.motivoRejeicao}</div></div>}
                          <div className="enf-acoes">
                            {am.estado==='aguarda_colheita' && <button className="enf-btn enf-btn--c" disabled={saving} onClick={()=>avancar(am._id,'colhida')}>Marcar como colhida</button>}
                            {am.estado==='colhida'          && <button className="enf-btn enf-btn--t" disabled={saving} onClick={()=>avancar(am._id,'em_transito')}>Enviar para laboratório</button>}
                            {am.estado==='em_transito'      && <button className="enf-btn enf-btn--r" disabled={saving} onClick={()=>avancar(am._id,'recebida')}>Confirmar recepção</button>}
                            {(am.estado==='aguarda_colheita'||am.estado==='colhida') && <button className="enf-btn enf-btn--rej" disabled={saving} onClick={()=>avancar(am._id,'rejeitada')}>Rejeitar</button>}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
          }
        </div>
      )}

      {/* ═══ AGENDAR ═══ */}
      {tab === 'agendar' && (
        <div className="enf-two">
          <div className="enf-section">
            <div className="enf-sh"><span className="enf-stitle">Requisições sem colheita</span><span className="enf-cnt">{reqs.length}</span></div>
            {reqs.length === 0
              ? <div className="enf-empty">Sem requisições pendentes.</div>
              : <ul className="enf-list">
                  {reqs.map(r => (
                    <li key={r._id} className={`enf-item${formReq?._id===r._id?' enf-item--sel':''}`}>
                      <button className="enf-row" onClick={() => { setFormReq(r); setFormOk('') }}>
                        <div>
                          <div className="enf-nome">{r.utenteNome}</div>
                          <div className="enf-meta"><span className="enf-mono">{r.numeroRequisicao}</span>· {r.analises.length} análise{r.analises.length!==1?'s':''}</div>
                          <div className="enf-chips">{r.analises.slice(0,4).map(a=><span key={a.codigo} className="enf-chip">{a.nome}</span>)}{r.analises.length>4&&<span className="enf-chip enf-chip--m">+{r.analises.length-4}</span>}</div>
                        </div>
                        <span className="enf-chev">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
            }
          </div>
          <div className="enf-section">
            <div className="enf-sh"><span className="enf-stitle">Registar colheita</span></div>
            {!formReq
              ? <div className="enf-empty">Seleccione uma requisição da lista.</div>
              : <div className="enf-form">
                  <div className="enf-form-info">
                    <div className="enf-nome">{formReq.utenteNome}</div>
                    <div className="enf-mono" style={{fontSize:11}}>{formReq.numeroRequisicao} · {formReq.utenteProcesso}</div>
                    <div className="enf-prev">
                      {buildTubos(formReq.analises).map((t,i)=>(
                        <div key={i} className="enf-prev-row">
                          <span className="enf-tsw" style={{background:TUBO_COR[t.tipo]??'#95A5A6'}} />
                          <span className="enf-tnm">{TUBO_LBL[t.tipo]??t.tipo}</span>
                          <span className="enf-tan">{t.analises.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="enf-field">
                    <label className="enf-lbl">Tipo de colheita</label>
                    <div className="enf-radios">
                      <label className="enf-radio"><input type="radio" checked={formTipo==='presencial'} onChange={()=>setFormTipo('presencial')} /> Presencial</label>
                      <label className="enf-radio"><input type="radio" checked={formTipo==='domiciliaria'} onChange={()=>setFormTipo('domiciliaria')} /> Domiciliária</label>
                    </div>
                  </div>
                  {formTipo==='domiciliaria' && <div className="enf-field"><label className="enf-lbl">Morada de colheita</label><input className="enf-input" value={formMorada} onChange={e=>setFormMorada(e.target.value)} placeholder="Rua, nº, localidade" /></div>}
                  <div className="enf-field"><label className="enf-lbl">Data / hora <span style={{textTransform:'none',letterSpacing:0,opacity:.6}}>(opcional)</span></label><input className="enf-input" type="datetime-local" value={formData} onChange={e=>setFormData(e.target.value)} /></div>
                  <div className="enf-field"><label className="enf-lbl">Observações <span style={{textTransform:'none',letterSpacing:0,opacity:.6}}>(opcional)</span></label><textarea className="enf-textarea" value={formObs} onChange={e=>setFormObs(e.target.value)} rows={3} /></div>
                  {formErr && <div className="enf-msg enf-msg--err">{formErr}</div>}
                  {formOk  && <div className="enf-msg enf-msg--ok">{formOk}</div>}
                  <div className="enf-form-btns">
                    <button className="enf-btn enf-btn--save" disabled={saving} onClick={criarColheita}>{saving?'A guardar…':'Registar colheita'}</button>
                    <button className="enf-btn enf-btn--cancel" onClick={()=>{setFormReq(null);setFormErr('');setFormOk('')}}>Cancelar</button>
                  </div>
                </div>
            }
          </div>
        </div>
      )}

      {/* ═══ UTENTES ═══ */}
      {tab === 'utentes' && (
        <div className="enf-section">
          <div className="enf-toolbar">
            <input className="enf-search enf-search--wide" placeholder="Pesquisar por nome, NIF ou SNS…" value={utenteQ} onChange={e=>setUtenteQ(e.target.value)} autoFocus />
          </div>
          <div className="enf-sh"><span className="enf-stitle">Utentes</span>{utentes.length>0&&<span className="enf-cnt">{utentes.length} resultado{utentes.length!==1?'s':''}</span>}</div>
          {utenteQ.trim().length===0
            ? <div className="enf-empty">Introduza um nome, NIF ou SNS para pesquisar.</div>
            : utentes.length===0
              ? <div className="enf-empty">Nenhum utente encontrado.</div>
              : <ul className="enf-list">
                  {utentes.map(u=>(
                    <li key={u._id} className="enf-item">
                      <div className="enf-row enf-row--s">
                        <div className="enf-avatar-sm">{u.nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}</div>
                        <div>
                          <div className="enf-nome">{u.nome}</div>
                          <div className="enf-meta"><span className="enf-mono">Proc. {u.processo}</span>· SNS {u.sns} · NIF {u.nif}</div>
                          <div className="enf-meta" style={{marginTop:2}}>Nasc. {fmtDate(u.dataNascimento)}{u.contacto&&<> · {u.contacto}</>}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
          }
        </div>
      )}

      </main>
    </div>
  )
}
