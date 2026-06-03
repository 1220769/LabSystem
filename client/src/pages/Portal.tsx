import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import './Portal.css'

/* ── utils ── */
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

/* ── types ── */
type Flag = 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo' | 'pendente'
type Tab  = 'resultados' | 'requisicoes' | 'faturas' | 'perfil'
type FlagFilter = 'todos' | 'normal' | 'alterado' | 'critico'

interface IPerfil {
  _id: string; nome: string; sns: string; nif: string; dataNascimento: string
  genero: string; contacto: string; email?: string
  morada: { rua: string; codigoPostal: string; localidade: string }
  medico?: string
}
interface IReq {
  _id: string; numeroRequisicao: string; estado: string; urgente: boolean
  analises: { codigo: string; nome: string }[]; observacoes?: string; createdAt: string
}
interface IRes {
  _id: string; codigoResultado: string
  analise: { nome: string; codigo: string; categoria: string }
  valor?: string; unidade?: string; refMin?: number; refMax?: number
  flag: Flag; requisicaoNumero: string; createdAt: string
  relatorioEmitido: boolean
  validacaoMedica?: { nome: string; dataHora: string }
  observacoes?: string
}
interface IFat {
  _id: string; numeroFatura: string; tipo: string; seguradora?: string
  valorBruto: number; percentComparticipacao: number; valorLiquido: number
  estado: string; dataEmissao?: string; dataPagamento?: string
  referenciaPagamento?: string
  linhas: { codigo: string; descricao: string; preco: number }[]
}
interface ISummary { requisicoes: number; resultados: number; faturasPendentes: number; criticos: number }

/* ── flag helpers ── */
const FLAG_LABEL: Record<Flag, string> = {
  normal: 'Normal', alto: 'Alto ↑', baixo: 'Baixo ↓',
  critico_alto: '⬆ Crítico', critico_baixo: '⬇ Crítico', pendente: 'Pendente',
}
const FLAG_DESC: Record<Flag, string> = {
  normal:        'Valor dentro dos valores de referência.',
  alto:          'Valor acima do limite superior de referência.',
  baixo:         'Valor abaixo do limite inferior de referência.',
  critico_alto:  'Valor criticamente elevado. Pode requerer atenção médica imediata.',
  critico_baixo: 'Valor criticamente baixo. Pode requerer atenção médica imediata.',
  pendente:      'Resultado ainda em processamento.',
}

/* ── pipeline ── */
const PIPELINE = ['pendente', 'em_curso', 'concluida'] as const
const PIPELINE_LABEL: Record<string, string> = {
  pendente:  'Registada', em_curso: 'Em processamento', concluida: 'Concluída', cancelada: 'Cancelada',
}

/* ── PDF ── */
function printRelatorioSimples(r: IRes) {
  const flagColor: Record<string, string> = {
    normal: '#2E7A50', alto: '#C87830', baixo: '#3A7AB0',
    critico_alto: '#C8001A', critico_baixo: '#C8001A', pendente: '#888',
  }
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Resultado ${r.codigoResultado}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'GFS Didot',Georgia,serif;color:#1A1208;background:#fff;padding:40px 60px;max-width:700px;margin:0 auto}
  .logo{font-size:18px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
  .sub{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:28px}
  hr{border:none;border-top:1px solid #e8e4dc;margin:20px 0}
  .sec{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#999;margin-bottom:8px}
  .box{background:#F8F5EF;border-radius:6px;padding:20px 24px;margin:20px 0}
  .analise{font-size:16px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}
  .val{font-size:36px;font-style:italic;color:${flagColor[r.flag]}}
  .unit{font-size:16px;color:#666}
  .flag{font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:3px 10px;border-radius:3px;background:rgba(200,0,26,.08);color:${flagColor[r.flag]}}
  .ref{font-size:11px;color:#888;margin-top:6px}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e4dc;font-size:9px;color:#bbb;letter-spacing:.1em}
  @media print{body{padding:20px 30px}}
</style></head><body>
<div class="logo">LabSystem Pro</div>
<div class="sub">Resultado Clínico</div>
<hr/>
<div class="box">
  <div class="analise">${r.analise.nome} <span style="font-size:12px;color:#999">${r.analise.codigo}</span></div>
  ${r.valor ? `<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px"><span class="val">${r.valor}</span><span class="unit">${r.unidade ?? ''}</span><span class="flag">${r.flag.replace(/_/g,' ')}</span></div>` : '<p style="color:#aaa;font-style:italic">Sem valor registado</p>'}
  ${(r.refMin !== undefined || r.refMax !== undefined) ? `<div class="ref">Referência: ${r.refMin ?? '–'} – ${r.refMax ?? '–'} ${r.unidade ?? ''}</div>` : ''}
</div>
${r.observacoes ? `<p style="font-style:italic;color:#888;margin:8px 0">${r.observacoes}</p>` : ''}
${r.validacaoMedica ? `<div class="sec">Validado por</div><p>${r.validacaoMedica.nome} · ${fmtDateTime(r.validacaoMedica.dataHora)}</p>` : ''}
<div class="footer">${r.codigoResultado} · ${r.requisicaoNumero} · ${fmtDate(r.createdAt)}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
  const w = window.open('', '_blank', 'width=760,height=900')
  if (w) { w.document.write(html); w.document.close() }
}

async function printRelatorioCompleto(reqNumero: string, utenteNome: string, setMsg: (m: string) => void) {
  setMsg('A gerar relatório…')
  try {
    const r = await api.get(`/portal/resultados/req/${reqNumero}`)
    const resultados: IRes[] = r.data.data
    if (!resultados.length) { setMsg('Sem resultados validados para esta requisição.'); return }
    setMsg('')

  const flagColor: Record<string, string> = {
    normal: '#2E7A50', alto: '#C87830', baixo: '#3A7AB0',
    critico_alto: '#C8001A', critico_baixo: '#C8001A', pendente: '#888',
  }
  const rows = resultados.map(res => `
    <tr>
      <td>${res.analise.nome}</td>
      <td style="color:${flagColor[res.flag] ?? '#1A1208'};font-style:italic">${res.valor ?? '—'} ${res.unidade ?? ''}</td>
      <td>${res.refMin !== undefined ? `${res.refMin} – ${res.refMax}` : '—'}</td>
      <td style="color:${flagColor[res.flag] ?? '#888'}">${res.flag.replace(/_/g, ' ')}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Relatório ${reqNumero}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'GFS Didot',Georgia,serif;color:#1A1208;background:#fff;padding:40px 60px;max-width:760px;margin:0 auto}
  .logo{font-size:18px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
  .sub{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:24px}
  hr{border:none;border-top:1px solid #e8e4dc;margin:16px 0}
  h2{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#444;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#999;text-align:left;padding:6px 8px;border-bottom:1px solid #e8e4dc}
  td{font-size:13px;padding:10px 8px;border-bottom:1px solid #f0ede8}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e4dc;font-size:9px;color:#bbb;letter-spacing:.1em}
  @media print{body{padding:20px 30px}}
</style></head><body>
<div class="logo">LabSystem Pro</div>
<div class="sub">Relatório de Análises Clínicas</div>
<hr/>
<h2>${utenteNome}</h2>
<p style="font-size:11px;color:#888;letter-spacing:.06em">${reqNumero} · ${fmtDate(resultados[0]?.createdAt)}</p>
<table>
  <thead><tr><th>Análise</th><th>Resultado</th><th>Referência</th><th>Flag</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Relatório gerado em ${new Date().toLocaleString('pt-PT')} · LabSystem Pro</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
  const w = window.open('', '_blank', 'width=800,height=900')
  if (w) { w.document.write(html); w.document.close() }
  } catch { setMsg('Erro ao gerar relatório. Tente de novo.') }
}

/* ══════════════════════════════════════════ */
export default function Portal() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab,        setTab]        = useState<Tab>('resultados')
  const [summary,    setSummary]    = useState<ISummary | null>(null)
  const [perfil,     setPerfil]     = useState<IPerfil | null>(null)
  const [noLink,     setNoLink]     = useState(false)
  const [reqs,       setReqs]       = useState<IReq[]>([])
  const [resultados, setResultados] = useState<IRes[]>([])
  const [faturas,    setFaturas]    = useState<IFat[]>([])
  const [reqTotal,   setReqTotal]   = useState(0)
  const [resTotal,   setResTotal]   = useState(0)
  const [reqPage,    setReqPage]    = useState(1)
  const [resPage,    setResPage]    = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [resLoading, setResLoading] = useState(false)

  /* resultado estado */
  const [flagFilter,   setFlagFilter]   = useState<FlagFilter>('todos')
  const [resSearch,    setResSearch]    = useState('')
  const [expandedRes,  setExpandedRes]  = useState<string | null>(null)
  const [novosCount,   setNovosCount]   = useState(0)

  /* requisição estado */
  const [expandedReq,    setExpandedReq]    = useState<string | null>(null)
  const [relMsg,         setRelMsg]         = useState<Record<string, string>>({})

  /* fatura estado */
  const [expandedFat,  setExpandedFat]  = useState<string | null>(null)

  /* perfil edit */
  const [editingPerfil, setEditingPerfil] = useState(false)
  const [perfilForm,    setPerfilForm]    = useState({ contacto: '', email: '', morada_rua: '', morada_cp: '', morada_loc: '', medico: '' })
  const [savingPerfil,  setSavingPerfil]  = useState(false)
  const [perfilErr,     setPerfilErr]     = useState('')

  /* self-link */
  const [linkNif,  setLinkNif]  = useState('')
  const [linkSns,  setLinkSns]  = useState('')
  const [linkErr,  setLinkErr]  = useState('')
  const [linkOk,   setLinkOk]   = useState('')
  const [linking,  setLinking]  = useState(false)

  /* chave localStorage para última visita */
  const lastVisitKey = `portal_last_visit_${user?._id}`

  useEffect(() => {
    Promise.all([
      api.get('/portal/summary'),
      api.get('/portal/perfil').catch(() => null),
      api.get('/portal/resultados'),
      api.get('/portal/requisicoes'),
      api.get('/portal/faturas'),
    ]).then(([s, p, res, req, fat]) => {
      setSummary(s.data)
      if (p) {
        setPerfil(p.data)
        setPerfilForm({ contacto: p.data.contacto, email: p.data.email ?? '', morada_rua: p.data.morada.rua, morada_cp: p.data.morada.codigoPostal, morada_loc: p.data.morada.localidade, medico: p.data.medico ?? '' })
      } else { setNoLink(true) }

      // #4 — contar resultados novos desde a última visita
      const lastVisit = localStorage.getItem(lastVisitKey)
      if (lastVisit) {
        const since = new Date(lastVisit).getTime()
        const novos = (res.data.data as IRes[]).filter(r => new Date(r.createdAt).getTime() > since).length
        setNovosCount(novos)
      }

      setResultados(res.data.data); setResTotal(res.data.total)
      setReqs(req.data.data);       setReqTotal(req.data.total)
      setFaturas(fat.data.data)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* #2 — load resultados server-side por flagFilter */
  const loadRes = useCallback((p: number, filter: FlagFilter = flagFilter) => {
    setResLoading(true)
    const params: Record<string, string | number> = { page: p }
    if (filter !== 'todos') params.flagFilter = filter
    api.get('/portal/resultados', { params }).then(r => {
      setResultados(r.data.data); setResTotal(r.data.total); setResPage(p)
    }).finally(() => setResLoading(false))
  }, [flagFilter])

  const loadReqs = (p: number) => {
    api.get('/portal/requisicoes', { params: { page: p } }).then(r => {
      setReqs(r.data.data); setReqTotal(r.data.total); setReqPage(p)
    })
  }

  /* mudar filtro → fetch server */
  const handleFlagFilter = (f: FlagFilter) => {
    setFlagFilter(f); setResPage(1); setExpandedRes(null)
    loadRes(1, f)
  }

  /* pesquisa local (sobre resultados carregados) */
  const filteredRes = resSearch
    ? resultados.filter(r => r.analise.nome.toLowerCase().includes(resSearch.toLowerCase()) || r.requisicaoNumero.toLowerCase().includes(resSearch.toLowerCase()))
    : resultados

  /* marcar visita quando abre tab resultados */
  const handleTabResultados = () => {
    setTab('resultados')
    setNovosCount(0)
    localStorage.setItem(lastVisitKey, new Date().toISOString())
  }

  const totalPendente = faturas.filter(f => f.estado === 'emitida').reduce((s, f) => s + f.valorLiquido, 0)

  async function savePerfil() {
    setSavingPerfil(true); setPerfilErr('')
    try {
      const body = {
        contacto: perfilForm.contacto,
        email:    perfilForm.email || undefined,
        morada:   { rua: perfilForm.morada_rua, codigoPostal: perfilForm.morada_cp, localidade: perfilForm.morada_loc },
        medico:   perfilForm.medico || undefined,
      }
      const r = await api.put('/portal/perfil', body)
      setPerfil(r.data); setEditingPerfil(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setPerfilErr(err.response?.data?.message ?? 'Erro ao guardar')
    } finally { setSavingPerfil(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) return <div className="portal"><div className="portal-loading">a carregar…</div></div>

  /* ── sem link ── */
  if (noLink) return (
    <div className="portal">
      <header className="portal-hd">
        <div className="portal-logo">Lab<strong>System</strong> Pro</div>
        <div className="portal-user">
          <div><div className="portal-user-name">{user?.nome}</div><div className="portal-user-role">portal de utente</div></div>
          <button className="portal-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>
      <div className="portal-no-link">
        <div className="portal-no-link-title">Associar ao registo clínico</div>
        <div className="portal-no-link-sub">Introduza o seu NIF ou Nº SNS para ligar a conta ao seu processo.</div>
        <div className="portal-link-form">
          {linkErr && <div className="portal-link-err">{linkErr}</div>}
          {linkOk  && <div className="portal-link-ok">{linkOk}</div>}
          <div className="portal-link-row">
            <div className="portal-ff"><label className="portal-ff-lbl">NIF</label><input className="portal-input" placeholder="268332436" value={linkNif} onChange={e => setLinkNif(e.target.value)} /></div>
            <span className="portal-link-ou">ou</span>
            <div className="portal-ff"><label className="portal-ff-lbl">Nº SNS</label><input className="portal-input" placeholder="123456789" value={linkSns} onChange={e => setLinkSns(e.target.value)} /></div>
          </div>
          <button className="portal-btn-primary" disabled={linking || (!linkNif.trim() && !linkSns.trim())} onClick={async () => {
            setLinkErr(''); setLinkOk(''); setLinking(true)
            try {
              const r = await api.post('/portal/link', { nif: linkNif || undefined, sns: linkSns || undefined })
              setLinkOk(`Ligado a ${r.data.utente.nome}. A recarregar…`)
              setTimeout(() => window.location.reload(), 1500)
            } catch (e: unknown) {
              const err = e as { response?: { data?: { message?: string } } }
              setLinkErr(err.response?.data?.message ?? 'Erro ao ligar')
            } finally { setLinking(false) }
          }}>{linking ? 'a verificar…' : 'associar conta'}</button>
        </div>
      </div>
    </div>
  )

  /* ── portal principal ── */
  return (
    <div className="portal">
      <header className="portal-hd">
        <div className="portal-logo">Lab<strong>System</strong> Pro</div>
        <div className="portal-user">
          <div><div className="portal-user-name">{user?.nome}</div><div className="portal-user-role">portal de utente</div></div>
          <button className="portal-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      <div className="portal-hero">
        <div className="portal-greeting">Bom dia, <em>{perfil?.nome.split(' ')[0]}</em></div>
        {perfil && <div className="portal-sns">SNS {perfil.sns} · NIF {perfil.nif}</div>}
      </div>

      <div className="portal-kpis">
        <div className="portal-kpi" onClick={handleTabResultados}>
          <div className="portal-kpi-val">
            {summary?.resultados ?? 0}
            {novosCount > 0 && <span className="portal-kpi-novos">{novosCount} novo{novosCount !== 1 ? 's' : ''}</span>}
          </div>
          <div className="portal-kpi-lbl">resultados disponíveis</div>
        </div>
        <div className="portal-kpi" onClick={() => setTab('requisicoes')}>
          <div className="portal-kpi-val">{summary?.requisicoes ?? 0}</div>
          <div className="portal-kpi-lbl">requisições</div>
        </div>
        <div className={`portal-kpi${(summary?.criticos ?? 0) > 0 ? ' portal-kpi--alert' : ''}`}
          onClick={() => { handleTabResultados(); handleFlagFilter('critico') }}>
          <div className="portal-kpi-val">{summary?.criticos ?? 0}</div>
          <div className="portal-kpi-lbl">resultados críticos</div>
        </div>
        <div className="portal-kpi" onClick={() => setTab('faturas')}>
          <div className="portal-kpi-val">{summary?.faturasPendentes ?? 0}</div>
          <div className="portal-kpi-lbl">faturas por pagar</div>
          {totalPendente > 0 && <div className="portal-kpi-sub">{fmtEur(totalPendente)}</div>}
        </div>
      </div>

      <div className="portal-tabs">
        {(['resultados','requisicoes','faturas','perfil'] as Tab[]).map(t => (
          <button key={t} className={`portal-tab${tab === t ? ' portal-tab--on' : ''}`}
            onClick={() => t === 'resultados' ? handleTabResultados() : setTab(t)}>
            {t}
            {t === 'resultados' && novosCount > 0 && tab !== 'resultados' && (
              <span className="portal-tab-badge">{novosCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="portal-content">

        {/* ── RESULTADOS ── */}
        {tab === 'resultados' && (
          <div className="portal-section">
            <div className="portal-section-toolbar">
              <div className="portal-flag-filters">
                {(['todos','normal','alterado','critico'] as FlagFilter[]).map(f => (
                  <button key={f} className={`portal-flag-btn portal-flag-btn--${f}${flagFilter === f ? ' portal-flag-btn--on' : ''}`}
                    onClick={() => handleFlagFilter(f)}>{f}</button>
                ))}
              </div>
              <input className="portal-search" placeholder="pesquisar análise…" value={resSearch} onChange={e => setResSearch(e.target.value)} />
              <span className="portal-count">{resLoading ? '…' : `${resTotal} resultado${resTotal !== 1 ? 's' : ''}`}</span>
            </div>

            {resLoading
              ? <div className="portal-empty">a carregar…</div>
              : filteredRes.length === 0
              ? <div className="portal-empty">Sem resultados{flagFilter !== 'todos' ? ' neste filtro' : ''}</div>
              : filteredRes.map(r => (
                <div key={r._id} className={`portal-res-card portal-res-card--${r.flag}`}>
                  <div className="portal-res-card-main" onClick={() => setExpandedRes(expandedRes === r._id ? null : r._id)}>
                    <div className="portal-res-card-left">
                      <div className="portal-res-card-nome">{r.analise.nome}</div>
                      <div className="portal-res-card-meta">{r.requisicaoNumero} · {fmtDate(r.createdAt)}</div>
                    </div>
                    <div className="portal-res-card-right">
                      <span className="portal-res-card-valor">{r.valor ?? '—'} {r.unidade ?? ''}</span>
                      <span className={`portal-res-flag portal-res-flag--${r.flag}`}>{FLAG_LABEL[r.flag]}</span>
                      <span className="portal-res-chevron">{expandedRes === r._id ? '↑' : '↓'}</span>
                    </div>
                  </div>

                  {expandedRes === r._id && (
                    <div className="portal-res-card-detail">
                      <div className="portal-res-detail-grid">
                        {(r.refMin !== undefined || r.refMax !== undefined) && (
                          <div className="portal-res-detail-item">
                            <span className="portal-res-detail-lbl">Referência</span>
                            <span className="portal-res-detail-val">{r.refMin ?? '—'} – {r.refMax ?? '—'} {r.unidade ?? ''}</span>
                          </div>
                        )}
                        <div className="portal-res-detail-item">
                          <span className="portal-res-detail-lbl">Categoria</span>
                          <span className="portal-res-detail-val">{r.analise.categoria}</span>
                        </div>
                        {r.validacaoMedica && (
                          <div className="portal-res-detail-item">
                            <span className="portal-res-detail-lbl">Validado por</span>
                            <span className="portal-res-detail-val">{r.validacaoMedica.nome} · {fmtDateTime(r.validacaoMedica.dataHora)}</span>
                          </div>
                        )}
                      </div>
                      <div className="portal-res-flag-desc">{FLAG_DESC[r.flag]}</div>
                      {r.observacoes && <div className="portal-res-obs">{r.observacoes}</div>}
                      {r.relatorioEmitido && (
                        <button className="portal-btn-outline" onClick={() => printRelatorioSimples(r)}>↓ Descarregar resultado em PDF</button>
                      )}
                    </div>
                  )}
                </div>
              ))
            }

            {Math.ceil(resTotal / 20) > 1 && (
              <div className="portal-pag">
                <button className="portal-pag-btn" disabled={resPage <= 1} onClick={() => loadRes(resPage - 1)}>‹</button>
                <span className="portal-pag-info">{resPage} / {Math.ceil(resTotal / 20)}</span>
                <button className="portal-pag-btn" disabled={resPage >= Math.ceil(resTotal / 20)} onClick={() => loadRes(resPage + 1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* ── REQUISIÇÕES ── */}
        {tab === 'requisicoes' && (
          <div className="portal-section">
            <div className="portal-section-header">
              <span className="portal-section-title">As minhas requisições</span>
              <span className="portal-count">{reqTotal} requisiç{reqTotal !== 1 ? 'ões' : 'ão'}</span>
            </div>

            {reqs.length === 0
              ? <div className="portal-empty">Sem requisições</div>
              : reqs.map(req => (
                <div key={req._id} className="portal-req-card">
                  <div className="portal-req-card-main" onClick={() => setExpandedReq(expandedReq === req._id ? null : req._id)}>
                    <div className="portal-req-card-left">
                      <div className="portal-req-card-num">
                        {req.numeroRequisicao}
                        {req.urgente && <span className="portal-req-urgente">urgente</span>}
                      </div>
                      <div className="portal-req-card-analises">{req.analises.map(a => a.nome).join(' · ')}</div>
                      <div className="portal-req-card-date">{fmtDate(req.createdAt)}</div>
                    </div>
                    <div className="portal-req-card-right">
                      <span className={`portal-req-badge portal-req-badge--${req.estado}`}>{PIPELINE_LABEL[req.estado] ?? req.estado}</span>
                      <span className="portal-res-chevron">{expandedReq === req._id ? '↑' : '↓'}</span>
                    </div>
                  </div>

                  {expandedReq === req._id && (
                    <div className="portal-req-card-detail">
                      {/* pipeline visual */}
                      <div className="portal-pipeline">
                        {PIPELINE.map((step, i) => {
                          const steps = ['pendente','em_curso','concluida']
                          const cur   = steps.indexOf(req.estado)
                          const done  = i <= cur && req.estado !== 'cancelada'
                          const active= i === cur && req.estado !== 'cancelada'
                          return (
                            <div key={step} className="portal-pipeline-step">
                              <div className={`portal-pipeline-dot${done ? ' portal-pipeline-dot--done' : ''}${active ? ' portal-pipeline-dot--active' : ''}`} />
                              {i < PIPELINE.length - 1 && <div className={`portal-pipeline-line${done && i < cur ? ' portal-pipeline-line--done' : ''}`} />}
                              <span className={`portal-pipeline-lbl${active ? ' portal-pipeline-lbl--active' : ''}`}>{PIPELINE_LABEL[step]}</span>
                            </div>
                          )
                        })}
                        {req.estado === 'cancelada' && <span className="portal-req-badge portal-req-badge--cancelada" style={{ marginLeft: 12 }}>cancelada</span>}
                      </div>

                      <div className="portal-req-analises-chips">
                        {req.analises.map(a => <span key={a.codigo} className="portal-chip">{a.nome}</span>)}
                      </div>

                      {req.observacoes && <div className="portal-res-obs">{req.observacoes}</div>}

                      {req.estado === 'concluida' && (
                        <div>
                          <button className="portal-btn-outline" onClick={() => {
                            const msg = (m: string) => setRelMsg(prev => ({ ...prev, [req._id]: m }))
                            printRelatorioCompleto(req.numeroRequisicao, perfil?.nome ?? '', msg)
                          }}>
                            ↓ Relatório completo em PDF
                          </button>
                          {relMsg[req._id] && (
                            <div className={`portal-rel-msg${relMsg[req._id].startsWith('Erro') || relMsg[req._id].startsWith('Sem') ? ' portal-rel-msg--err' : ''}`}>
                              {relMsg[req._id]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            }

            {Math.ceil(reqTotal / 10) > 1 && (
              <div className="portal-pag">
                <button className="portal-pag-btn" disabled={reqPage <= 1} onClick={() => loadReqs(reqPage - 1)}>‹</button>
                <span className="portal-pag-info">{reqPage} / {Math.ceil(reqTotal / 10)}</span>
                <button className="portal-pag-btn" disabled={reqPage >= Math.ceil(reqTotal / 10)} onClick={() => loadReqs(reqPage + 1)}>›</button>
              </div>
            )}
          </div>
        )}

        {/* ── FATURAS ── */}
        {tab === 'faturas' && (
          <div className="portal-section">
            <div className="portal-section-header">
              <span className="portal-section-title">As minhas faturas</span>
              {totalPendente > 0 && (
                <span className="portal-fat-total-pend">Por pagar: {fmtEur(totalPendente)}</span>
              )}
            </div>

            {faturas.length === 0
              ? <div className="portal-empty">Sem faturas</div>
              : faturas.map(f => (
                <div key={f._id} className={`portal-fat-card${f.estado === 'emitida' ? ' portal-fat-card--pend' : ''}`}>
                  <div className="portal-fat-card-main" onClick={() => setExpandedFat(expandedFat === f._id ? null : f._id)}>
                    <div>
                      <div className="portal-fat-num">{f.numeroFatura}</div>
                      <div className="portal-fat-meta">{f.tipo}{f.seguradora ? ` · ${f.seguradora}` : ''} · {fmtDate(f.dataEmissao)}</div>
                    </div>
                    <div className="portal-fat-right">
                      <span className="portal-fat-valor">{fmtEur(f.valorLiquido)}</span>
                      <span className={`portal-fat-badge portal-fat-badge--${f.estado}`}>{f.estado}</span>
                      <span className="portal-res-chevron">{expandedFat === f._id ? '↑' : '↓'}</span>
                    </div>
                  </div>

                  {expandedFat === f._id && (
                    <div className="portal-fat-detail">
                      <div className="portal-fat-linhas">
                        {f.linhas.map((l, i) => (
                          <div key={i} className="portal-fat-linha">
                            <span className="portal-fat-linha-cod">{l.codigo}</span>
                            <span className="portal-fat-linha-desc">{l.descricao}</span>
                            <span className="portal-fat-linha-preco">{fmtEur(l.preco)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="portal-fat-totais">
                        <div className="portal-fat-total-row"><span>Subtotal</span><span>{fmtEur(f.valorBruto)}</span></div>
                        {f.percentComparticipacao > 0 && (
                          <div className="portal-fat-total-row portal-fat-total-row--comp">
                            <span>Comparticipação ({f.percentComparticipacao}%)</span>
                            <span>− {fmtEur(f.valorBruto * f.percentComparticipacao / 100)}</span>
                          </div>
                        )}
                        <div className="portal-fat-total-row portal-fat-total-row--final">
                          <span>Total</span><span>{fmtEur(f.valorLiquido)}</span>
                        </div>
                      </div>
                      {f.dataPagamento && (
                        <div className="portal-fat-meta" style={{ marginTop: 8 }}>Pago em {fmtDate(f.dataPagamento)}</div>
                      )}
                      {f.estado === 'emitida' && (
                        <div className="portal-fat-pagamento">
                          {f.referenciaPagamento
                            ? <><span className="portal-fat-pagamento-lbl">Referência MB</span><span className="portal-fat-pagamento-val">{f.referenciaPagamento}</span></>
                            : <span className="portal-fat-pagamento-sem">Referência de pagamento não disponível — contacte o laboratório</span>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ── PERFIL ── */}
        {tab === 'perfil' && perfil && (
          <div className="portal-section">
            <div className="portal-section-header">
              <span className="portal-section-title">O meu perfil</span>
              {!editingPerfil && (
                <button className="portal-btn-outline" onClick={() => setEditingPerfil(true)}>editar contactos</button>
              )}
            </div>

            {!editingPerfil ? (
              <div className="portal-perfil">
                <div className="portal-perfil-nome">{perfil.nome}</div>
                <div className="portal-perfil-grid">
                  {[
                    ['Data de nascimento', fmtDate(perfil.dataNascimento)],
                    ['Género',             perfil.genero],
                    ['NIF',                perfil.nif],
                    ['Nº SNS',             perfil.sns],
                    ['Telemóvel',          perfil.contacto],
                    ['Email',              perfil.email || '—'],
                    ['Morada',             `${perfil.morada.rua}, ${perfil.morada.codigoPostal} ${perfil.morada.localidade}`],
                    ['Médico de família',  perfil.medico || '—'],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="portal-perfil-lbl">{l}</div>
                      <div className="portal-perfil-val">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="portal-perfil-edit">
                {perfilErr && <div className="portal-link-err">{perfilErr}</div>}
                <div className="portal-perfil-note">Pode actualizar os seus dados de contacto. NIF, SNS e data de nascimento só podem ser alterados pelo laboratório.</div>
                <div className="portal-perfil-edit-grid">
                  {[
                    ['Telemóvel', 'contacto', perfilForm.contacto],
                    ['Email',     'email',    perfilForm.email],
                    ['Rua',       'morada_rua', perfilForm.morada_rua],
                    ['Código Postal', 'morada_cp', perfilForm.morada_cp],
                    ['Localidade', 'morada_loc', perfilForm.morada_loc],
                    ['Médico de família', 'medico', perfilForm.medico],
                  ].map(([label, key, val]) => (
                    <div key={key} className="portal-ff">
                      <label className="portal-ff-lbl">{label}</label>
                      <input
                        className="portal-input"
                        value={val}
                        onChange={e => setPerfilForm(f => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="portal-edit-actions">
                  <button className="portal-btn-outline" onClick={() => setEditingPerfil(false)}>cancelar</button>
                  <button className="portal-btn-primary" disabled={savingPerfil} onClick={savePerfil}>
                    {savingPerfil ? 'a guardar…' : 'guardar alterações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
