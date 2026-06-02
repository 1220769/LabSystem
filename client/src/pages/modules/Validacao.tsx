import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import './Validacao.css'

/* ── types ── */
type Flag  = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
type Estado = 'resultado_disponivel' | 'validado_tecnico' | 'validado_medico'
type TabFiltro = 'tecnica' | 'medica' | 'concluida'

interface Assinatura { nome: string; dataHora: string; observacoes?: string }

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
  estado: Estado
  observacoes?: string
  validacaoTecnica?: Assinatura
  validacaoMedica?: Assinatura
  relatorioEmitido: boolean
  relatorioDataHora?: string
  createdAt: string
}

interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const FLAG_LABEL: Record<Flag, string> = {
  pendente: 'Pendente', normal: 'Normal',
  alto: 'Alto ↑', baixo: 'Baixo ↓',
  critico_alto: '⬆ Crítico Alto', critico_baixo: '⬇ Crítico Baixo',
}

const isCritico = (f: Flag) => f === 'critico_alto' || f === 'critico_baixo'

/* ── component ── */
export default function Validacao({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [resultados, setResultados] = useState<Resultado[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]     = useState<TabFiltro>('tecnica')
  const [search, setSearch]   = useState('')
  const [debSearch, setDebSearch] = useState('')
  const [stats, setStats] = useState({ disponivel: 0, validado_tecnico: 0, validado_medico: 0, criticosPorValidar: 0 })

  const [panel, setPanel]       = useState<'detail' | null>(null)
  const [selected, setSelected] = useState<Resultado | null>(null)
  const [fObs, setFObs]         = useState('')
  const [fEmitir, setFEmitir]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isTecnico = ['administrador','tecnico'].includes(user?.role ?? '')
  const isMedico  = ['administrador','medico'].includes(user?.role ?? '')

  const estadoByTab: Record<TabFiltro, string> = {
    tecnica:   'resultado_disponivel',
    medica:    'validado_tecnico',
    concluida: 'validado_medico',
  }

  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDebSearch(search); setPage(1) }, 300)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  const fetchResultados = () => {
    setLoading(true)
    api.get('/resultados', {
      params: { estado: estadoByTab[tab], search: debSearch, page, limit: 30 }
    }).then(({ data }) => {
      setResultados(data.data); setTotal(data.total); setPages(data.pages)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchResultados() }, [tab, debSearch, page])

  useEffect(() => {
    api.get('/resultados/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [resultados])

  const openDetail = (r: Resultado) => {
    setSelected(r); setFObs(''); setFEmitir(false); setFormErr(''); setPanel('detail')
  }
  const closePanel = () => { setPanel(null); setSelected(null); setFormErr('') }

  const handleValidarTecnico = async () => {
    if (!selected) return
    setSaving(true); setFormErr('')
    try {
      await api.post(`/resultados/${selected._id}/validar-tecnico`, { observacoes: fObs || undefined })
      closePanel(); fetchResultados()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao validar')
    } finally { setSaving(false) }
  }

  const handleValidarMedico = async () => {
    if (!selected) return
    setSaving(true); setFormErr('')
    try {
      await api.post(`/resultados/${selected._id}/validar-medico`, {
        observacoes:      fObs || undefined,
        emitirRelatorio:  fEmitir,
      })
      closePanel(); fetchResultados()
    } catch (err: any) {
      setFormErr(err.response?.data?.message ?? 'Erro ao validar')
    } finally { setSaving(false) }
  }

  const printRelatorio = (r: Resultado) => {
    const flagColor: Record<Flag, string> = {
      normal: '#2E7A50', alto: '#C87830', baixo: '#3A7AB0',
      critico_alto: '#C8001A', critico_baixo: '#C8001A', pendente: '#888',
    }
    const html = `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"/>
<title>Relatório ${r.codigoResultado}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Space+Grotesk:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Space Grotesk',sans-serif;color:#1A1208;background:#fff;padding:40px 60px;max-width:700px;margin:0 auto}
  .logo{font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.1em;color:#1A1208;text-transform:uppercase;margin-bottom:4px}
  .logo-sub{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;color:#888;text-transform:uppercase;margin-bottom:28px}
  hr{border:none;border-top:1px solid #e8e4dc;margin:20px 0}
  .sec-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#999;margin-bottom:8px}
  .patient{font-size:18px;font-weight:600;color:#1A1208;margin-bottom:2px}
  .meta{font-family:'DM Mono',monospace;font-size:10px;color:#888;margin-bottom:16px}
  .analise-box{background:#F8F5EF;border-radius:6px;padding:20px 24px;margin:20px 0}
  .analise-name{font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
  .result-row{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
  .result-val{font-family:'Oswald',sans-serif;font-size:36px;font-weight:700}
  .result-unit{font-size:16px;color:#666}
  .result-flag{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;padding:3px 10px;border-radius:3px;background:rgba(200,0,26,0.08);color:${flagColor[r.flag]};font-weight:600}
  .ref{font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-top:4px}
  .val-block{margin:6px 0;padding:10px 14px;border-left:3px solid #e8e4dc;background:#faf8f4}
  .val-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#aaa;margin-bottom:3px}
  .val-signer{font-size:13px;font-weight:500;color:#333}
  .val-when{font-family:'DM Mono',monospace;font-size:10px;color:#aaa}
  .obs{font-style:italic;font-size:12px;color:#888;margin-top:6px}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e4dc;font-family:'DM Mono',monospace;font-size:9px;color:#bbb;letter-spacing:0.1em}
  @media print{body{padding:20px 30px}}
</style></head><body>
<div class="logo">LabSystem Pro</div>
<div class="logo-sub">Sistema de Gestão Laboratorial</div>
<div class="sec-label">Utente</div>
<div class="patient">${r.utenteNome}</div>
<div class="meta">${r.requisicaoNumero} · ${r.codigoAmostra} · ${new Date(r.createdAt).toLocaleDateString('pt-PT')}</div>
<hr/>
<div class="sec-label">Resultado</div>
<div class="analise-box">
  <div class="analise-name">${r.analise.nome} <span style="font-size:12px;color:#999;font-weight:400">${r.analise.codigo}</span></div>
  ${r.valor ? `<div class="result-row"><span class="result-val" style="color:${flagColor[r.flag]}">${r.valor}</span><span class="result-unit">${r.unidade ?? ''}</span><span class="result-flag">${r.flag.replace(/_/g,' ')}</span></div>` : '<div style="color:#aaa;font-style:italic">Valor não registado</div>'}
  ${(r.refMin !== undefined || r.refMax !== undefined) ? `<div class="ref">Ref: ${r.refMin ?? '?'} – ${r.refMax ?? '?'} ${r.unidade ?? ''}</div>` : ''}
  ${r.equipamento ? `<div class="ref" style="margin-top:6px">Equipamento: ${r.equipamento}</div>` : ''}
</div>
${r.observacoes ? `<div class="obs">Obs: ${r.observacoes}</div>` : ''}
<hr/>
<div class="sec-label">Validações</div>
${r.validacaoTecnica ? `<div class="val-block"><div class="val-label">Validação Técnica</div><div class="val-signer">${r.validacaoTecnica.nome}</div><div class="val-when">${new Date(r.validacaoTecnica.dataHora).toLocaleString('pt-PT')}</div>${r.validacaoTecnica.observacoes ? `<div class="obs">${r.validacaoTecnica.observacoes}</div>` : ''}</div>` : ''}
${r.validacaoMedica ? `<div class="val-block"><div class="val-label">Validação Médica</div><div class="val-signer">${r.validacaoMedica.nome}</div><div class="val-when">${new Date(r.validacaoMedica.dataHora).toLocaleString('pt-PT')}</div>${r.validacaoMedica.observacoes ? `<div class="obs">${r.validacaoMedica.observacoes}</div>` : ''}</div>` : ''}
<div class="footer">
  ${r.codigoResultado} · Emitido em ${new Date().toLocaleString('pt-PT')} · LabSystem Pro
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
    const w = window.open('', '_blank', 'width=760,height=900')
    if (w) { w.document.write(html); w.document.close() }
  }

  const handleEmitirRelatorio = async (r: Resultado) => {
    try {
      await api.post(`/resultados/${r._id}/emitir-relatorio`)
      setSelected(prev => prev ? { ...prev, relatorioEmitido: true } : prev)
      fetchResultados()
      printRelatorio(r)
    } catch {}
  }

  const fmt     = (d: string) => new Date(d).toLocaleDateString('pt-PT')
  const fmtHour = (d: string) => new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <motion.div
      className="val-page"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.45 }}
    >
      {/* top */}
      <div className="val-top">
        <button className="val-back" onClick={() => navigate('/')}>← voltar</button>
        <div className="val-identity">
          <span className="val-num">05</span>
          <h1 className="val-title">Validação</h1>
          <p className="val-sub">{seg.sub}</p>
        </div>
        <div className="val-kpis">
          <div className="val-kpi">
            <span className="val-kpi-val">{stats.disponivel}</span>
            <span className="val-kpi-lbl">aguardam técnica</span>
          </div>
          <div className="val-kpi">
            <span className="val-kpi-val">{stats.validado_tecnico}</span>
            <span className="val-kpi-lbl">aguardam médica</span>
          </div>
          {stats.criticosPorValidar > 0 && (
            <div className="val-kpi val-kpi--crit">
              <span className="val-kpi-val">{stats.criticosPorValidar}</span>
              <span className="val-kpi-lbl">críticos urgentes</span>
            </div>
          )}
        </div>
      </div>

      {/* alerta críticos */}
      {stats.criticosPorValidar > 0 && (
        <motion.div className="val-alert"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          ⬆ {stats.criticosPorValidar} resultado{stats.criticosPorValidar > 1 ? 's' : ''} com valor crítico aguarda{stats.criticosPorValidar > 1 ? 'm' : ''} validação
        </motion.div>
      )}

      {/* toolbar */}
      <div className="val-toolbar">
        <div className="val-tabs">
          {([
            { key: 'tecnica',   label: `Validação técnica (${stats.disponivel})` },
            { key: 'medica',    label: `Validação médica (${stats.validado_tecnico})` },
            { key: 'concluida', label: `Concluída (${stats.validado_medico})` },
          ] as {key: TabFiltro, label: string}[]).map(t => (
            <button key={t.key} className={`val-tab ${tab === t.key ? 'val-tab--on' : ''}`}
              onClick={() => { setTab(t.key); setPage(1) }}>
              {t.label}
            </button>
          ))}
        </div>
        <input className="val-search" placeholder="análise · utente · amostra…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* list */}
      <div className="val-list-area">
        {loading ? (
          <div className="val-msg">a carregar…</div>
        ) : resultados.length === 0 ? (
          <div className="val-msg">sem resultados pendentes</div>
        ) : (
          <>
            <div className="val-list">
              {resultados.map((r, i) => (
                <motion.div key={r._id}
                  className={`val-row ${isCritico(r.flag) ? 'val-row--crit' : ''}`}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => openDetail(r)}>

                  <div className="val-row-left">
                    {isCritico(r.flag) && <span className="val-crit-pulse" />}
                    <div>
                      <div className="val-row-nome">{r.analise.nome}</div>
                      <div className="val-row-meta">{r.codigoAmostra} · {r.utenteNome}</div>
                    </div>
                  </div>

                  <div className="val-row-mid">
                    {r.valor ? (
                      <span className={`val-valor val-valor--${r.flag}`}>
                        {r.valor} {r.unidade}
                      </span>
                    ) : (
                      <span className="val-no-val">sem valor</span>
                    )}
                    {(r.refMin !== undefined || r.refMax !== undefined) && (
                      <span className="val-ref">ref {r.refMin ?? '–'}–{r.refMax ?? '–'}</span>
                    )}
                  </div>

                  <div className="val-row-right">
                    <span className={`val-flag val-flag--${r.flag}`}>{FLAG_LABEL[r.flag]}</span>
                    {tab === 'concluida' && r.relatorioEmitido && (
                      <span className="val-rel-badge">✓ relatório</span>
                    )}
                    <span className="val-arr">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
            {pages > 1 && (
              <div className="val-pag">
                <button className="val-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <span className="val-pag-info">{page} / {pages}</span>
                <button className="val-pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* panel */}
      <AnimatePresence>
        {panel === 'detail' && selected && (
          <motion.aside className="val-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className="val-panel-hd">
              <button className="val-back val-back--panel" onClick={closePanel}>← fechar</button>
              <div className="val-panel-label">{selected.analise.nome}</div>
              {isCritico(selected.flag) && (
                <div className="val-panel-crit">{FLAG_LABEL[selected.flag]}</div>
              )}
            </div>

            <div className="val-detail">

              {/* resultado destaque */}
              <div className={`val-result-card val-result-card--${selected.flag}`}>
                <div className="val-result-valor">
                  {selected.valor ?? '—'}
                  {selected.unidade && <span className="val-result-unidade"> {selected.unidade}</span>}
                </div>
                <div className={`val-flag-big val-flag-big--${selected.flag}`}>{FLAG_LABEL[selected.flag]}</div>
                {(selected.refMin !== undefined || selected.refMax !== undefined) && (
                  <div className="val-result-ref">
                    Referência: {selected.refMin ?? '–'} – {selected.refMax ?? '–'} {selected.unidade}
                  </div>
                )}
              </div>

              {/* info */}
              <div className="val-info-grid">
                <VField l="Código"      v={selected.codigoResultado} />
                <VField l="Amostra"     v={selected.codigoAmostra} />
                <VField l="Utente"      v={selected.utenteNome} />
                <VField l="Requisição"  v={selected.requisicaoNumero} />
                <VField l="Categoria"   v={selected.analise.categoria} />
                {selected.equipamento && <VField l="Equipamento" v={selected.equipamento} />}
                {selected.observacoes  && <VField l="Obs. técnico" v={selected.observacoes} />}
                <VField l="Data" v={fmt(selected.createdAt)} />
              </div>

              {/* histórico de validações */}
              {selected.validacaoTecnica && (
                <div className="val-history-item val-history-item--tec">
                  <div className="val-history-label">✓ Validado tecnicamente</div>
                  <div className="val-history-who">{selected.validacaoTecnica.nome}</div>
                  <div className="val-history-when">{fmtHour(selected.validacaoTecnica.dataHora)}</div>
                  {selected.validacaoTecnica.observacoes && (
                    <div className="val-history-obs">{selected.validacaoTecnica.observacoes}</div>
                  )}
                </div>
              )}

              {selected.validacaoMedica && (
                <div className="val-history-item val-history-item--med">
                  <div className="val-history-label">✓ Validado medicamente</div>
                  <div className="val-history-who">{selected.validacaoMedica.nome}</div>
                  <div className="val-history-when">{fmtHour(selected.validacaoMedica.dataHora)}</div>
                  {selected.validacaoMedica.observacoes && (
                    <div className="val-history-obs">{selected.validacaoMedica.observacoes}</div>
                  )}
                </div>
              )}

              {selected.relatorioEmitido && selected.relatorioDataHora && (
                <div className="val-history-item val-history-item--rel">
                  <div className="val-history-label">✓ Relatório emitido</div>
                  <div className="val-history-when">{fmtHour(selected.relatorioDataHora)}</div>
                  <button className="val-btn-reimprimir" onClick={() => printRelatorio(selected)}>
                    ↓ reimprimir
                  </button>
                </div>
              )}

              {formErr && <div className="val-form-err">{formErr}</div>}

              {/* acções de validação */}
              {selected.estado === 'resultado_disponivel' && isTecnico && (
                <div className="val-action-section">
                  <div className="val-action-title">Validação Técnica</div>
                  <div className="val-ff">
                    <label className="val-ff-label">Observações (opcional)</label>
                    <textarea className="val-input" rows={2}
                      value={fObs} onChange={e => setFObs(e.target.value)} />
                  </div>
                  <button className="val-btn-validate" onClick={handleValidarTecnico} disabled={saving}>
                    {saving ? 'a validar…' : `✓ Assinar — ${user?.nome}`}
                  </button>
                </div>
              )}

              {selected.estado === 'validado_tecnico' && isMedico && (
                <div className="val-action-section">
                  <div className="val-action-title">Validação Médica</div>
                  <div className="val-ff">
                    <label className="val-ff-label">Observações clínicas (opcional)</label>
                    <textarea className="val-input" rows={3}
                      value={fObs} onChange={e => setFObs(e.target.value)} />
                  </div>
                  <label className="val-emit-wrap">
                    <input type="checkbox" checked={fEmitir}
                      onChange={e => setFEmitir(e.target.checked)} />
                    <span>Emitir relatório automaticamente</span>
                  </label>
                  <button className="val-btn-validate val-btn-validate--med" onClick={handleValidarMedico} disabled={saving}>
                    {saving ? 'a validar…' : `✓ Assinar — ${user?.nome}`}
                  </button>
                </div>
              )}

              {selected.estado === 'validado_medico' && !selected.relatorioEmitido && (
                <div className="val-action-section">
                  <button className="val-btn-relatorio" onClick={() => handleEmitirRelatorio(selected)}>
                    Emitir relatório
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function VField({ l, v }: { l: string; v: string }) {
  return (
    <div className="val-vfield">
      <div className="val-vfield-l">{l}</div>
      <div className="val-vfield-v">{v}</div>
    </div>
  )
}
