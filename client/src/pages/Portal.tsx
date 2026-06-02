import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import './Portal.css'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT')
}

function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

type Flag = 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo' | 'pendente'

interface IPerfil {
  nome: string; sns: string; nif: string; dataNascimento: string
  genero: string; contacto: string; email?: string
  morada: { rua: string; codigoPostal: string; localidade: string }
  medico?: string
}
interface IReq {
  _id: string; numeroRequisicao: string; estado: string
  analises: { nome: string }[]; createdAt: string
}
interface IRes {
  _id: string; codigoResultado: string; analise: { nome: string; codigo: string }
  valor?: string; unidade?: string; flag: Flag; requisicaoNumero: string; createdAt: string
  relatorioEmitido: boolean; validacaoMedica?: { nome: string; dataHora: string }
}
interface IFat {
  _id: string; numeroFatura: string; tipo: string
  valorLiquido: number; estado: string; dataEmissao?: string
}
interface ISummary { requisicoes: number; resultados: number; faturasPendentes: number; criticos: number }

type Tab = 'resultados' | 'requisicoes' | 'faturas' | 'perfil'

function printRelatorio(r: IRes) {
  const flagColor: Record<string, string> = {
    normal: '#2E7A50', alto: '#C87830', baixo: '#3A7AB0',
    critico_alto: '#C8001A', critico_baixo: '#C8001A', pendente: '#888',
  }
  const html = `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"/>
<title>Relatório ${r.codigoResultado}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'GFS Didot','Didot',Georgia,serif;color:#1A1208;background:#fff;padding:40px 60px;max-width:700px;margin:0 auto}
  .logo{font-size:18px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px}
  .logo-sub{font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin-bottom:28px}
  hr{border:none;border-top:1px solid #e8e4dc;margin:20px 0}
  .sec{font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#999;margin-bottom:8px}
  .patient{font-size:18px;color:#1A1208;margin-bottom:2px}
  .meta{font-size:10px;color:#888;margin-bottom:16px;letter-spacing:0.06em}
  .analise-box{background:#F8F5EF;border-radius:6px;padding:20px 24px;margin:20px 0}
  .analise-name{font-size:16px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px}
  .result-row{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
  .result-val{font-size:36px;font-style:italic}
  .result-unit{font-size:16px;color:#666}
  .result-flag{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;padding:3px 10px;border-radius:3px;background:rgba(200,0,26,0.08);color:${flagColor[r.flag] ?? '#888'}}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e4dc;font-size:9px;color:#bbb;letter-spacing:0.1em}
  @media print{body{padding:20px 30px}}
</style></head><body>
<div class="logo">LabSystem Pro</div>
<div class="logo-sub">Resultado Clínico</div>
<hr/>
<div class="analise-box">
  <div class="analise-name">${r.analise.nome}</div>
  ${r.valor ? `<div class="result-row"><span class="result-val" style="color:${flagColor[r.flag] ?? '#1A1208'}">${r.valor}</span><span class="result-unit">${r.unidade ?? ''}</span><span class="result-flag">${r.flag.replace(/_/g,' ')}</span></div>` : '<div style="color:#aaa;font-style:italic">Valor não disponível</div>'}
</div>
${r.validacaoMedica ? `<div class="sec">Validado por</div><p>${r.validacaoMedica.nome} · ${new Date(r.validacaoMedica.dataHora).toLocaleString('pt-PT')}</p>` : ''}
<div class="footer">${r.codigoResultado} · ${r.requisicaoNumero} · ${new Date(r.createdAt).toLocaleDateString('pt-PT')}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
  const w = window.open('', '_blank', 'width=760,height=900')
  if (w) { w.document.write(html); w.document.close() }
}

export default function Portal() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [tab,       setTab]       = useState<Tab>('resultados')
  const [summary,   setSummary]   = useState<ISummary | null>(null)
  const [perfil,    setPerfil]    = useState<IPerfil | null>(null)
  const [noLink,    setNoLink]    = useState(false)
  const [linkNif,   setLinkNif]   = useState('')
  const [linkSns,   setLinkSns]   = useState('')
  const [linkErr,   setLinkErr]   = useState('')
  const [linkOk,    setLinkOk]    = useState('')
  const [linking,   setLinking]   = useState(false)
  const [reqs,      setReqs]      = useState<IReq[]>([])
  const [resultados,setResultados]= useState<IRes[]>([])
  const [faturas,   setFaturas]   = useState<IFat[]>([])
  const [reqTotal,  setReqTotal]  = useState(0)
  const [resTotal,  setResTotal]  = useState(0)
  const [reqPage,   setReqPage]   = useState(1)
  const [resPage,   setResPage]   = useState(1)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/portal/summary'),
      api.get('/portal/perfil').catch(() => null),
      api.get('/portal/resultados'),
      api.get('/portal/requisicoes'),
      api.get('/portal/faturas'),
    ]).then(([s, p, res, req, fat]) => {
      setSummary(s.data)
      if (p) setPerfil(p.data); else setNoLink(true)
      setResultados(res.data.data); setResTotal(res.data.total)
      setReqs(req.data.data);       setReqTotal(req.data.total)
      setFaturas(fat.data.data)
    }).finally(() => setLoading(false))
  }, [])

  const loadReqs = (p: number) => {
    api.get('/portal/requisicoes', { params: { page: p } }).then(r => {
      setReqs(r.data.data); setReqTotal(r.data.total); setReqPage(p)
    })
  }
  const loadRes = (p: number) => {
    api.get('/portal/resultados', { params: { page: p } }).then(r => {
      setResultados(r.data.data); setResTotal(r.data.total); setResPage(p)
    })
  }

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) return <div className="portal"><div className="portal-loading">a carregar…</div></div>

  return (
    <div className="portal">
      {/* header */}
      <header className="portal-hd">
        <div className="portal-logo">Lab<strong>System</strong> Pro</div>
        <div className="portal-user">
          <div>
            <div className="portal-user-name">{user?.nome}</div>
            <div className="portal-user-role">portal de utente</div>
          </div>
          <button className="portal-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {noLink ? (
        <div className="portal-no-link">
          <div className="portal-no-link-title">Associar ao registo clínico</div>
          <div className="portal-no-link-sub">Introduza o seu NIF ou Nº SNS para ligar a conta ao seu processo clínico.</div>

          <div style={{ marginTop: 32, width: '100%', maxWidth: 360 }}>
            {linkErr && (
              <div style={{ fontFamily: "'GFS Didot',Georgia,serif", fontSize: 13, color: '#C8001A', background: 'rgba(200,0,26,0.07)', border: '1px solid rgba(200,0,26,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 14 }}>
                {linkErr}
              </div>
            )}
            {linkOk && (
              <div style={{ fontFamily: "'GFS Didot',Georgia,serif", fontSize: 13, color: '#2E7A50', background: 'rgba(46,122,80,0.08)', border: '1px solid rgba(46,122,80,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 14 }}>
                {linkOk}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontFamily: "'GFS Didot',Georgia,serif", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,18,8,0.35)', marginBottom: 5 }}>NIF</label>
              <input
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(26,18,8,0.04)', border: '1px solid rgba(26,18,8,0.1)', borderRadius: 3, padding: '9px 12px', fontFamily: "'GFS Didot',Georgia,serif", fontSize: 13, color: 'rgba(26,18,8,0.82)', outline: 'none' }}
                placeholder="ex: 268332436"
                value={linkNif}
                onChange={e => setLinkNif(e.target.value)}
              />
            </div>
            <div style={{ textAlign: 'center', fontFamily: "'GFS Didot',Georgia,serif", fontStyle: 'italic', fontSize: 12, color: 'rgba(26,18,8,0.3)', margin: '8px 0' }}>ou</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontFamily: "'GFS Didot',Georgia,serif", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,18,8,0.35)', marginBottom: 5 }}>Nº SNS</label>
              <input
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(26,18,8,0.04)', border: '1px solid rgba(26,18,8,0.1)', borderRadius: 3, padding: '9px 12px', fontFamily: "'GFS Didot',Georgia,serif", fontSize: 13, color: 'rgba(26,18,8,0.82)', outline: 'none' }}
                placeholder="ex: 123456789"
                value={linkSns}
                onChange={e => setLinkSns(e.target.value)}
              />
            </div>
            <button
              disabled={linking || (!linkNif.trim() && !linkSns.trim())}
              onClick={async () => {
                setLinkErr(''); setLinkOk(''); setLinking(true)
                try {
                  const r = await api.post('/portal/link', { nif: linkNif || undefined, sns: linkSns || undefined })
                  setLinkOk(`Ligado com sucesso a ${r.data.utente.nome}. A recarregar…`)
                  setTimeout(() => window.location.reload(), 1500)
                } catch (e: unknown) {
                  const err = e as { response?: { data?: { message?: string } } }
                  setLinkErr(err.response?.data?.message ?? 'Erro ao ligar conta')
                } finally { setLinking(false) }
              }}
              style={{ width: '100%', fontFamily: "'GFS Didot',Georgia,serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '12px', background: 'rgba(26,18,8,0.85)', color: '#F0EDE4', border: 'none', borderRadius: 3, cursor: 'pointer', opacity: linking ? 0.6 : 1 }}
            >
              {linking ? 'a verificar…' : 'associar conta'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* hero */}
          <div className="portal-hero">
            <div className="portal-greeting">
              Bom dia, <em>{perfil?.nome.split(' ')[0]}</em>
            </div>
            {perfil && <div className="portal-sns">SNS {perfil.sns} · NIF {perfil.nif}</div>}
          </div>

          {/* KPIs */}
          <div className="portal-kpis">
            <div className="portal-kpi" onClick={() => setTab('resultados')}>
              <div className="portal-kpi-val">{summary?.resultados ?? 0}</div>
              <div className="portal-kpi-lbl">resultados disponíveis</div>
            </div>
            <div className="portal-kpi" onClick={() => setTab('requisicoes')}>
              <div className="portal-kpi-val">{summary?.requisicoes ?? 0}</div>
              <div className="portal-kpi-lbl">requisições</div>
            </div>
            <div className={`portal-kpi${(summary?.criticos ?? 0) > 0 ? ' portal-kpi--alert' : ''}`} onClick={() => setTab('resultados')}>
              <div className="portal-kpi-val">{summary?.criticos ?? 0}</div>
              <div className="portal-kpi-lbl">resultados críticos</div>
            </div>
            <div className="portal-kpi" onClick={() => setTab('faturas')}>
              <div className="portal-kpi-val">{summary?.faturasPendentes ?? 0}</div>
              <div className="portal-kpi-lbl">faturas por pagar</div>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: 'flex', gap: 2, padding: '20px 60px 0' }}>
            {(['resultados','requisicoes','faturas','perfil'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontFamily: "'GFS Didot','Didot',Georgia,serif",
                  fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '7px 16px', border: 'none', borderRadius: '3px 3px 0 0', cursor: 'pointer',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? 'rgba(26,18,8,0.75)' : 'rgba(26,18,8,0.35)',
                  borderBottom: tab === t ? '2px solid rgba(26,18,8,0.75)' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >{t}</button>
            ))}
          </div>

          {/* body */}
          <div className="portal-body" style={{ paddingTop: 0 }}>

            {/* resultados */}
            {tab === 'resultados' && (
              <div className="portal-section portal-section--full">
                <div className="portal-section-hd">
                  <span className="portal-section-title">Os meus resultados</span>
                  <span className="portal-section-count">{resTotal} resultado{resTotal !== 1 ? 's' : ''}</span>
                </div>
                {resultados.length === 0
                  ? <div className="portal-empty">Sem resultados disponíveis</div>
                  : resultados.map(r => (
                    <div key={r._id} className="portal-res-row">
                      <div style={{ flex: 1 }}>
                        <div className="portal-res-analise">{r.analise.nome}</div>
                        <div style={{ fontFamily: "'GFS Didot',Georgia,serif", fontSize: 10, color: 'rgba(26,18,8,0.3)', marginTop: 2 }}>
                          {r.requisicaoNumero} · {fmtDate(r.createdAt)}
                        </div>
                      </div>
                      <div className="portal-res-valor">{r.valor ?? '—'} {r.unidade ?? ''}</div>
                      <span className={`portal-res-flag portal-res-flag--${r.flag}`}>{r.flag.replace(/_/g,' ')}</span>
                      {r.relatorioEmitido && (
                        <button className="portal-res-print" onClick={() => printRelatorio(r)}>↓ PDF</button>
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

            {/* requisições */}
            {tab === 'requisicoes' && (
              <div className="portal-section portal-section--full">
                <div className="portal-section-hd">
                  <span className="portal-section-title">As minhas requisições</span>
                  <span className="portal-section-count">{reqTotal} requisiç{reqTotal !== 1 ? 'ões' : 'ão'}</span>
                </div>
                {reqs.length === 0
                  ? <div className="portal-empty">Sem requisições</div>
                  : reqs.map(r => (
                    <div key={r._id} className="portal-req-row">
                      <span className="portal-req-num">{r.numeroRequisicao}</span>
                      <span className="portal-req-analises">{r.analises.map(a => a.nome).join(', ')}</span>
                      <span className="portal-req-date">{fmtDate(r.createdAt)}</span>
                      <span className={`portal-req-badge portal-req-badge--${r.estado}`}>{r.estado.replace('_',' ')}</span>
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

            {/* faturas */}
            {tab === 'faturas' && (
              <div className="portal-section portal-section--full">
                <div className="portal-section-hd">
                  <span className="portal-section-title">As minhas faturas</span>
                  <span className="portal-section-count">{faturas.length} fatura{faturas.length !== 1 ? 's' : ''}</span>
                </div>
                {faturas.length === 0
                  ? <div className="portal-empty">Sem faturas</div>
                  : faturas.map(f => (
                    <div key={f._id} className="portal-fat-row">
                      <span className="portal-fat-num">{f.numeroFatura}</span>
                      <span className={`portal-fat-tipo portal-fat-tipo--${f.tipo}`}>{f.tipo}</span>
                      {f.dataEmissao && (
                        <span style={{ fontFamily: "'GFS Didot',Georgia,serif", fontSize: 10, color: 'rgba(26,18,8,0.3)' }}>
                          {fmtDate(f.dataEmissao)}
                        </span>
                      )}
                      <span className="portal-fat-valor">{fmtEur(f.valorLiquido)}</span>
                      <span className={`portal-fat-badge portal-fat-badge--${f.estado}`}>{f.estado}</span>
                    </div>
                  ))
                }
              </div>
            )}

            {/* perfil */}
            {tab === 'perfil' && perfil && (
              <div className="portal-section portal-section--full">
                <div className="portal-section-hd">
                  <span className="portal-section-title">O meu perfil</span>
                </div>
                <div className="portal-perfil">
                  <div className="portal-perfil-nome">{perfil.nome}</div>
                  <div className="portal-perfil-grid">
                    {[
                      ['Data de nascimento', fmtDate(perfil.dataNascimento)],
                      ['Género', perfil.genero],
                      ['NIF', perfil.nif],
                      ['Nº SNS', perfil.sns],
                      ['Telemóvel', perfil.contacto],
                      ['Email', perfil.email || '—'],
                      ['Morada', `${perfil.morada.rua}, ${perfil.morada.codigoPostal} ${perfil.morada.localidade}`],
                      ['Médico de família', perfil.medico || '—'],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div className="portal-perfil-field-lbl">{l}</div>
                        <div className="portal-perfil-field-val">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}
