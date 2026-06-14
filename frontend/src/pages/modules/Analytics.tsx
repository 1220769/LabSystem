import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import api from '../../api/axios'
import './Analytics.css'

function fmtEur(v: number) {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

/* intervalo de atualização automática (ms) */
const REFRESH_MS = 30_000

/* "atualizado há Ns / há N min" */
function agoLabel(d: Date | null): string {
  if (!d) return '—'
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 5)  return 'agora mesmo'
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  return `há ${m} min`
}

const PIPELINE_LABELS: Record<string, string> = {
  pendente:               'Pendente',
  em_processamento:       'Em Processamento',
  resultado_disponivel:   'Resultado Disponível',
  validado_tecnico:       'Validado Técnico',
  validado_medico:        'Validado Médico',
}
const PIPELINE_COLORS: Record<string, string> = {
  pendente:               '#4A5568',
  em_processamento:       '#90CAFF',
  resultado_disponivel:   '#F0D080',
  validado_tecnico:       '#A8D4B0',
  validado_medico:        '#68C894',
}

const FLAG_COLORS: Record<string, string> = {
  normal:        '#A8D4B0',
  alto:          '#F0D080',
  baixo:         '#90CAFF',
  critico_alto:  '#FF6060',
  critico_baixo: '#FF9060',
  pendente:      '#4A5568',
}

interface IDash {
  requisicoes: { hoje: number; semana: number; mes: number }
  amostras:    { hoje: number; porEstado: { _id: string; count: number }[] }
  resultados:  {
    porFlag:       { _id: string; count: number }[]
    porCategoria:  { _id: string; count: number }[]
    validadosHoje: number
    criticosPorValidar: number
  }
  topAnalises:        { _id: string; nome: string; count: number }[]
  financeiro:         { _id: string; count: number; valor: number }[]
  pipeline:           { _id: string; count: number }[]
  requisicoesPorDia:  { _id: string; count: number }[]
}

function BarFill({ pct, color }: { pct: number; color: string }) {
  return (
    <motion.div
      className="an7-bar-fill"
      style={{ background: color, width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    />
  )
}

function exportCSV(data: IDash) {
  const rows: string[][] = [
    ['Secção', 'Item', 'Valor'],
    ['Requisições', 'Hoje',   String(data.requisicoes.hoje)],
    ['Requisições', '7 dias', String(data.requisicoes.semana)],
    ['Requisições', 'Mês',    String(data.requisicoes.mes)],
    ['Amostras',    'Hoje',   String(data.amostras.hoje)],
    ...data.resultados.porFlag.map(f => ['Flags', f._id, String(f.count)]),
    ...data.resultados.porCategoria.map(c => ['Categoria', c._id || 'Sem categoria', String(c.count)]),
    ['Resultados', 'Validados hoje',       String(data.resultados.validadosHoje)],
    ['Resultados', 'Críticos por validar', String(data.resultados.criticosPorValidar)],
    ...data.topAnalises.map(a => ['Top Análises', `${a._id} – ${a.nome}`, String(a.count)]),
    ...data.financeiro.map(f => ['Financeiro', f._id, `${f.count} fatura(s) / ${fmtEur(f.valor)}`]),
  ]
  const csv  = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `labsystem_analytics_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Analytics({ seg }: { seg: { color: string; name: string } }) {
  const navigate = useNavigate()
  const [data,        setData]        = useState<IDash | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [err,         setErr]         = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [live,        setLive]        = useState(true)
  const [, setTick]   = useState(0)   // força recálculo do "há Ns"

  /* carrega o dashboard; background=true → atualização silenciosa (sem ecrã de loading) */
  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    try {
      const r = await api.get('/analytics/dashboard')
      setData(r.data); setLastUpdated(new Date()); setErr('')
    } catch {
      if (!background) setErr('Não foi possível carregar os dados.')
    } finally {
      if (background) setRefreshing(false)
      setLoading(false)
    }
  }, [])

  /* primeiro carregamento */
  useEffect(() => { load(false) }, [load])

  /* atualização automática (polling) — só quando "ao vivo" está ligado */
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [live, load])

  /* tick de 1s para o rótulo "atualizado há Ns" ir avançando */
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const maxPipeline = data ? Math.max(1, ...data.pipeline.map(p => p.count)) : 1
  const maxCat      = data ? Math.max(1, ...data.resultados.porCategoria.map(c => c.count)) : 1
  const maxTop      = data ? Math.max(1, ...data.topAnalises.map(a => a.count)) : 1
  const totalFlags  = data ? data.resultados.porFlag.reduce((s, f) => s + f.count, 0) : 0

  return (
    <div className="an7-page">
      <button className="an7-back" onClick={() => navigate('/')}>← voltar</button>
      {data && (
        <button className="an7-export" onClick={() => exportCSV(data)}>↓ exportar CSV</button>
      )}

      <div className="an7-hd">
        <span className="an7-num">07</span>
        <h1 className="an7-title">Analytics</h1>
        <p className="an7-sub">dashboard operacional em tempo real</p>

        <div className="an7-live">
          <span className={`an7-live-dot${!live ? ' an7-live-dot--paused' : refreshing ? ' an7-live-dot--busy' : ''}`} />
          <span className="an7-live-txt">
            {!live ? 'pausado' : refreshing ? 'a atualizar…' : `atualizado ${agoLabel(lastUpdated)}`}
          </span>
          <button className="an7-live-btn" onClick={() => load(true)} disabled={refreshing}>atualizar</button>
          <button className="an7-live-btn" onClick={() => setLive(v => !v)}>{live ? 'pausar' : 'retomar'}</button>
        </div>
      </div>

      {loading && <div className="an7-loading">a carregar dados…</div>}
      {err     && <div className="an7-err">{err}</div>}

      {data && (
        <>
          {/* Gráficos recharts */}
          <div className="an7-charts">
            <div className="an7-chart-card">
              <div className="an7-section-title">Requisições — últimos 14 dias</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.requisicoesPorDia} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#90CAFF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#90CAFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'rgba(240,235,225,0.35)' }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(240,235,225,0.35)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1A1A18', border: '1px solid rgba(240,235,225,0.1)', borderRadius: 4, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(240,235,225,0.6)' }}
                    itemStyle={{ color: '#90CAFF' }}
                  />
                  <Area type="monotone" dataKey="count" name="requisições"
                    stroke="#90CAFF" strokeWidth={2} fill="url(#reqGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="an7-chart-card">
              <div className="an7-section-title">Flags — distribuição</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={data.resultados.porFlag.filter(f => f.count > 0)}
                    dataKey="count" nameKey="_id"
                    cx="50%" cy="50%" outerRadius={60} strokeWidth={0}>
                    {data.resultados.porFlag.filter(f => f.count > 0).map(f => (
                      <Cell key={f._id} fill={FLAG_COLORS[f._id] ?? '#888'} />
                    ))}
                  </Pie>
                  <Legend iconSize={8} iconType="circle"
                    formatter={(v: string) => <span style={{ fontSize: 11, color: 'rgba(240,235,225,0.55)' }}>{v.replace(/_/g,' ')}</span>} />
                  <Tooltip
                    contentStyle={{ background: '#1A1A18', border: '1px solid rgba(240,235,225,0.1)', borderRadius: 4, fontSize: 12 }}
                    itemStyle={{ color: 'rgba(240,235,225,0.8)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPIs */}
          <div className="an7-kpis">
            <div className="an7-kpi">
              <div className="an7-kpi-val">{data.requisicoes.hoje}</div>
              <div className="an7-kpi-lbl">req. hoje</div>
            </div>
            <div className="an7-kpi an7-kpi--week">
              <div className="an7-kpi-val">{data.requisicoes.semana}</div>
              <div className="an7-kpi-lbl">req. 7 dias</div>
            </div>
            <div className="an7-kpi">
              <div className="an7-kpi-val">{data.requisicoes.mes}</div>
              <div className="an7-kpi-lbl">req. mês</div>
            </div>
            <div className="an7-kpi">
              <div className="an7-kpi-val">{data.amostras.hoje}</div>
              <div className="an7-kpi-lbl">amostras hoje</div>
            </div>
            <div className="an7-kpi an7-kpi--ok">
              <div className="an7-kpi-val">{data.resultados.validadosHoje}</div>
              <div className="an7-kpi-lbl">validados hoje</div>
            </div>
            <div className={`an7-kpi${data.resultados.criticosPorValidar > 0 ? ' an7-kpi--alert' : ''}`}>
              <div className="an7-kpi-val">{data.resultados.criticosPorValidar}</div>
              <div className="an7-kpi-lbl">críticos p/validar</div>
            </div>
          </div>

          <div className="an7-body">
            {/* pipeline */}
            <div>
              <div className="an7-section-title">Pipeline de Resultados</div>
              <div className="an7-pipeline">
                {(['pendente','em_processamento','resultado_disponivel','validado_tecnico','validado_medico']).map(estado => {
                  const entry = data.pipeline.find(p => p._id === estado)
                  const count = entry?.count ?? 0
                  const pct   = (count / maxPipeline) * 100
                  return (
                    <div key={estado} className="an7-pipe-row">
                      <span className="an7-pipe-label">{PIPELINE_LABELS[estado]}</span>
                      <div className="an7-pipe-track">
                        <motion.div
                          className="an7-pipe-fill"
                          style={{ background: PIPELINE_COLORS[estado], width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="an7-pipe-count">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* flags + categorias */}
            <div className="an7-grid2">
              <div className="an7-card">
                <div className="an7-section-title">Distribuição por Flag</div>
                <div className="an7-flags">
                  {(['normal','alto','baixo','critico_alto','critico_baixo','pendente']).map(flag => {
                    const entry = data.resultados.porFlag.find(f => f._id === flag)
                    const count = entry?.count ?? 0
                    if (count === 0 && flag !== 'normal') return null
                    return (
                      <div key={flag} className="an7-flag-row">
                        <div className="an7-flag-dot" style={{ background: FLAG_COLORS[flag] }} />
                        <span className="an7-flag-name">{flag.replace(/_/g,' ')}</span>
                        <span className="an7-flag-count">{count}</span>
                      </div>
                    )
                  })}
                  {totalFlags > 0 && (
                    <div style={{ borderTop: '1px solid rgba(240,235,225,0.07)', paddingTop: '8px', marginTop: '4px' }}>
                      <div className="an7-flag-row">
                        <div className="an7-flag-dot" style={{ background: 'transparent' }} />
                        <span className="an7-flag-name" style={{ color: 'rgba(240,235,225,0.25)' }}>total</span>
                        <span className="an7-flag-count" style={{ color: 'rgba(240,235,225,0.5)', fontSize: '14px' }}>{totalFlags}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="an7-card">
                <div className="an7-section-title">Resultados por Categoria</div>
                <div className="an7-bars">
                  {data.resultados.porCategoria.slice(0, 8).map(c => (
                    <div key={c._id} className="an7-bar-row">
                      <span className="an7-bar-label">{c._id || 'Sem categoria'}</span>
                      <div className="an7-bar-track">
                        <BarFill pct={(c.count / maxCat) * 100} color="#90CAFF" />
                      </div>
                      <span className="an7-bar-val">{c.count}</span>
                    </div>
                  ))}
                  {data.resultados.porCategoria.length === 0 && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(240,235,225,0.25)', padding: '12px 0' }}>
                      sem dados
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* top análises + financeiro */}
            <div className="an7-grid2">
              <div className="an7-card">
                <div className="an7-section-title">Top 8 Análises</div>
                <div className="an7-bars">
                  {data.topAnalises.map(a => (
                    <div key={a._id} className="an7-bar-row">
                      <span className="an7-bar-label">{a._id}</span>
                      <div className="an7-bar-track">
                        <BarFill pct={(a.count / maxTop) * 100} color="#F0D080" />
                      </div>
                      <span className="an7-bar-val">{a.count}</span>
                    </div>
                  ))}
                  {data.topAnalises.length === 0 && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(240,235,225,0.25)', padding: '12px 0' }}>
                      sem dados
                    </div>
                  )}
                </div>
              </div>

              <div className="an7-card">
                <div className="an7-section-title">Faturação por Estado</div>
                <div className="an7-fin-cards">
                  {(['rascunho','emitida','paga','anulada']).map(estado => {
                    const entry = data.financeiro.find(f => f._id === estado)
                    return (
                      <div key={estado} className={`an7-fin-card an7-fin-card--${estado}`}>
                        <div className="an7-fin-card-estado">{estado}</div>
                        <div className="an7-fin-card-count">{entry?.count ?? 0}</div>
                        <div className="an7-fin-card-valor">{fmtEur(entry?.valor ?? 0)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
