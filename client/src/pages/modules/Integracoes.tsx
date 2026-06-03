import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Integracoes.css'

type Tab = 'eprescricao' | 'api' | 'webhooks' | 'sap'
interface Seg { id: number; name: string; sub: string; color: string; stat: string; statLabel: string }

const ENDPOINTS = [
  { method: 'GET',    path: '/api/auth/me',              desc: 'Perfil do utilizador autenticado' },
  { method: 'POST',   path: '/api/auth/login',           desc: 'Autenticação e emissão de token JWT' },
  { method: 'GET',    path: '/api/utentes',              desc: 'Listagem de utentes (paginada, pesquisa)' },
  { method: 'POST',   path: '/api/utentes',              desc: 'Criação de novo utente' },
  { method: 'GET',    path: '/api/utentes/:id',          desc: 'Detalhe do utente' },
  { method: 'GET',    path: '/api/requisicoes',          desc: 'Listagem de requisições analíticas' },
  { method: 'POST',   path: '/api/requisicoes',          desc: 'Criação de requisição' },
  { method: 'GET',    path: '/api/amostras',             desc: 'Listagem de amostras / colheitas' },
  { method: 'POST',   path: '/api/amostras',             desc: 'Registar nova amostra' },
  { method: 'PUT',    path: '/api/amostras/:id',         desc: 'Actualizar estado de amostra' },
  { method: 'GET',    path: '/api/resultados',           desc: 'Resultados analíticos (paginado, filtro)' },
  { method: 'POST',   path: '/api/resultados',           desc: 'Importar resultado analítico' },
  { method: 'GET',    path: '/api/faturas',              desc: 'Listagem de faturas' },
  { method: 'POST',   path: '/api/faturas',              desc: 'Emitir nova fatura' },
  { method: 'PATCH',  path: '/api/faturas/:id',          desc: 'Actualizar estado de fatura' },
  { method: 'GET',    path: '/api/analytics/dashboard',  desc: 'KPIs e métricas do dashboard' },
  { method: 'GET',    path: '/api/portal/summary',       desc: 'Resumo portal do utente' },
  { method: 'GET',    path: '/api/equipamentos/stats',   desc: 'Stats de equipamentos e stock' },
  { method: 'GET',    path: '/api/auditoria/logs',       desc: 'Log de auditoria (admin apenas)' },
  { method: 'GET',    path: '/api/health',               desc: 'Estado da API (health check)' },
]

const WEBHOOKS_MOCK = [
  { id: '1', evento: 'resultado.critico',    url: 'https://hcul.pt/hooks/criticos',   ativo: true,  ultimo: '2026-06-03T08:12:00' },
  { id: '2', evento: 'fatura.paga',          url: 'https://erp.hcul.pt/fatura-paga',  ativo: true,  ultimo: '2026-06-02T14:30:00' },
  { id: '3', evento: 'amostra.rejeitada',    url: 'https://hcul.pt/hooks/rejeicoes',  ativo: false, ultimo: null },
  { id: '4', evento: 'requisicao.urgente',   url: 'https://notify.hcul.pt/urgentes',  ativo: true,  ultimo: '2026-06-03T07:55:00' },
]

const SAP_EXPORTS_MOCK = [
  { periodo: 'Maio 2026',    data: '2026-06-01', estado: 'exportado', registos: 312 },
  { periodo: 'Abril 2026',   data: '2026-05-01', estado: 'exportado', registos: 287 },
  { periodo: 'Março 2026',   data: '2026-04-01', estado: 'exportado', registos: 301 },
]

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}

const METHOD_COLOR: Record<string, string> = {
  GET: '#2D8B74', POST: '#0064B4', PUT: '#C87800', PATCH: '#7B4B9E', DELETE: '#C8001A',
}

export default function Integracoes({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('eprescricao')

  return (
    <motion.div className="int-page" style={{ background: seg.color }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>

      <button className="int-back" onClick={() => navigate('/')}>← voltar</button>

      <div className="int-top">
        <div className="int-num">0{seg.id}</div>
        <div className="int-title">{seg.name}</div>
        <div className="int-sub">{seg.sub}</div>
      </div>

      {/* status bar */}
      <div className="int-status-bar">
        <div className="int-status-item int-status--ok"><span className="int-status-dot" />e-Prescrição SNS · Ligado</div>
        <div className="int-status-item int-status--ok"><span className="int-status-dot" />API REST · Activa</div>
        <div className="int-status-item int-status--ok"><span className="int-status-dot" />Webhooks · {WEBHOOKS_MOCK.filter(w => w.ativo).length} activos</div>
        <div className="int-status-item int-status--ok"><span className="int-status-dot" />SAP · Última exportação OK</div>
      </div>

      {/* Tabs */}
      <div className="int-tabs">
        <button className={`int-tab${tab === 'eprescricao' ? ' int-tab--on' : ''}`} onClick={() => setTab('eprescricao')}>e-Prescrição</button>
        <button className={`int-tab${tab === 'api'         ? ' int-tab--on' : ''}`} onClick={() => setTab('api')}>API REST</button>
        <button className={`int-tab${tab === 'webhooks'    ? ' int-tab--on' : ''}`} onClick={() => setTab('webhooks')}>Webhooks</button>
        <button className={`int-tab${tab === 'sap'         ? ' int-tab--on' : ''}`} onClick={() => setTab('sap')}>SAP</button>
      </div>

      <div className="int-content">

        {/* ═══ e-PRESCRIÇÃO ═══ */}
        {tab === 'eprescricao' && (
          <div className="int-section">
            <div className="int-sh"><span className="int-stitle">Prescrição Eletrónica Nacional</span><span className="int-pill int-pill--ok">Ligado</span></div>
            <div className="int-info-grid">
              <div className="int-info-card">
                <div className="int-info-lbl">Serviço</div>
                <div className="int-info-val">SPMS · Serviços Partilhados do MS</div>
              </div>
              <div className="int-info-card">
                <div className="int-info-lbl">Protocolo</div>
                <div className="int-info-val int-mono">HL7 FHIR R4</div>
              </div>
              <div className="int-info-card">
                <div className="int-info-lbl">Última sincronização</div>
                <div className="int-info-val">Hoje, 08:00</div>
              </div>
              <div className="int-info-card">
                <div className="int-info-lbl">Prescrições importadas hoje</div>
                <div className="int-info-val int-num">14</div>
              </div>
              <div className="int-info-card">
                <div className="int-info-lbl">Importadas este mês</div>
                <div className="int-info-val int-num">312</div>
              </div>
              <div className="int-info-card">
                <div className="int-info-lbl">Taxa de sucesso</div>
                <div className="int-info-val int-num">99.4%</div>
              </div>
            </div>
            <div className="int-section-sub">
              <div className="int-stitle" style={{ padding: '16px 22px 10px' }}>Últimas prescrições importadas</div>
              {[
                { num: 'EP-2026-00891', utente: 'Ana Margarida Silva', medico: 'Dr. Rui Fonseca', analises: 'Hemograma, PCR', data: 'Hoje 07:58' },
                { num: 'EP-2026-00890', utente: 'João Costa',          medico: 'Dra. Marta Lima',  analises: 'TSH, T4, T3',   data: 'Hoje 07:45' },
                { num: 'EP-2026-00889', utente: 'Maria Ferreira',      medico: 'Dr. Rui Fonseca',  analises: 'Ionograma',      data: 'Ontem 16:30' },
              ].map(p => (
                <div key={p.num} className="int-row">
                  <div><div className="int-nome">{p.utente}</div><div className="int-meta"><span className="int-mono">{p.num}</span>· {p.medico} · {p.analises}</div></div>
                  <span className="int-data">{p.data}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ API REST ═══ */}
        {tab === 'api' && (
          <div className="int-section">
            <div className="int-sh">
              <span className="int-stitle">Documentação da API REST</span>
              <span className="int-mono" style={{ fontSize: 11, color: 'rgba(26,18,8,0.38)' }}>Bearer JWT · v2.0</span>
            </div>
            <div className="int-api-base">
              <span className="int-lbl">Base URL</span>
              <code className="int-code">http://localhost:4000/api</code>
            </div>
            <div className="int-ep-list">
              {ENDPOINTS.map((ep, i) => (
                <div key={i} className="int-ep">
                  <span className="int-method" style={{ color: METHOD_COLOR[ep.method] ?? '#888' }}>{ep.method}</span>
                  <code className="int-path">{ep.path}</code>
                  <span className="int-ep-desc">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ WEBHOOKS ═══ */}
        {tab === 'webhooks' && (
          <div className="int-section">
            <div className="int-sh"><span className="int-stitle">Webhooks configurados</span><span className="int-cnt">{WEBHOOKS_MOCK.length}</span></div>
            <ul className="int-wh-list">
              {WEBHOOKS_MOCK.map(w => (
                <li key={w.id} className="int-wh-item">
                  <div className="int-wh-l">
                    <span className={`int-wh-dot${w.ativo ? ' int-wh-dot--on' : ''}`} />
                    <div>
                      <div className="int-nome"><span className="int-mono">{w.evento}</span></div>
                      <div className="int-meta int-wh-url">{w.url}</div>
                    </div>
                  </div>
                  <div className="int-wh-r">
                    <span className={`int-pill${w.ativo ? ' int-pill--ok' : ' int-pill--off'}`}>{w.ativo ? 'Activo' : 'Inactivo'}</span>
                    <span className="int-data">{w.ultimo ? fmtDateTime(w.ultimo) : '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="int-wh-note">Os webhooks são configurados pelo administrador de sistema. Contacte o suporte para adicionar ou remover endpoints.</div>
          </div>
        )}

        {/* ═══ SAP ═══ */}
        {tab === 'sap' && (
          <div className="int-section">
            <div className="int-sh"><span className="int-stitle">Integração contabilística SAP</span><span className="int-pill int-pill--ok">Activo</span></div>
            <div className="int-info-grid" style={{ borderBottom: '1px solid rgba(26,18,8,0.07)', paddingBottom: 16 }}>
              <div className="int-info-card"><div className="int-info-lbl">Sistema</div><div className="int-info-val">SAP S/4HANA</div></div>
              <div className="int-info-card"><div className="int-info-lbl">Formato</div><div className="int-info-val int-mono">iDoc · RFC</div></div>
              <div className="int-info-card"><div className="int-info-lbl">Próxima exportação</div><div className="int-info-val">1 Jul 2026</div></div>
            </div>
            <div className="int-sh" style={{ paddingTop: 14 }}><span className="int-stitle">Histórico de exportações</span></div>
            <ul className="int-list">
              {SAP_EXPORTS_MOCK.map((e, i) => (
                <li key={i} className="int-row">
                  <div><div className="int-nome">{e.periodo}</div><div className="int-meta">Exportado a {e.data} · {e.registos} registos</div></div>
                  <span className="int-pill int-pill--ok">Exportado</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </motion.div>
  )
}
