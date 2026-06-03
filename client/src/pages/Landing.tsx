import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import DiveCanvas from '../components/DiveCanvas'
import NotificationBell from '../components/NotificationBell'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import './Landing.css'

interface Segment {
  id: number
  name: string
  sub: string
  color: string
  svgY: number
  svgH: number
  stat: string
  statLabel: string
  rows: Row[]
}

interface Row {
  name: string
  ref: string
  status: 'ok' | 'pending' | 'critical'
}

const SEGMENTS: Segment[] = [
  {
    id: 0, name: 'Autenticação', sub: 'Segurança e perfis de acesso',
    color: '#2A2A28', svgY: 40, svgH: 36, stat: '6', statLabel: 'perfis configurados',
    rows: [
      { name: 'Administrador', ref: 'ROLE-01', status: 'ok' },
      { name: 'Técnico de laboratório', ref: 'ROLE-02', status: 'ok' },
      { name: 'Médico', ref: 'ROLE-03', status: 'ok' },
      { name: 'Enfermeiro', ref: 'ROLE-04', status: 'ok' },
      { name: 'Financeiro', ref: 'ROLE-05', status: 'ok' },
      { name: 'Utente (portal)', ref: 'ROLE-06', status: 'ok' },
    ],
  },
  {
    id: 1, name: 'Utentes', sub: 'Ficha clínica · portal · agendamento',
    color: '#E8D5B0', svgY: 76, svgH: 52, stat: '1 284', statLabel: 'registos activos',
    rows: [
      { name: 'Ana Silva',       ref: 'U-00291', status: 'ok' },
      { name: 'João Costa',      ref: 'U-00290', status: 'ok' },
      { name: 'Maria Ferreira',  ref: 'U-00289', status: 'critical' },
      { name: 'Rui Mendes',      ref: 'U-00288', status: 'pending' },
      { name: 'Inês Pinto',      ref: 'U-00287', status: 'ok' },
    ],
  },
  {
    id: 2, name: 'Requisições', sub: 'Pedidos analíticos · urgentes · e-prescrição',
    color: '#B8CDE0', svgY: 128, svgH: 44, stat: '47', statLabel: 'em curso agora',
    rows: [
      { name: 'LAB-2847 · Hemograma, PCR', ref: 'REQ-2847', status: 'ok' },
      { name: 'LAB-2846 · TSH, T4', ref: 'REQ-2846', status: 'pending' },
      { name: 'LAB-2845 · D-Dímero', ref: 'REQ-2845', status: 'critical' },
      { name: 'LAB-2844 · Ionograma', ref: 'REQ-2844', status: 'pending' },
      { name: 'LAB-2843 · Coagulação', ref: 'REQ-2843', status: 'ok' },
    ],
  },
  {
    id: 3, name: 'Colheita', sub: 'QR · rastreio em tempo real · domiciliária',
    color: '#C8001A', svgY: 172, svgH: 44, stat: '284', statLabel: 'amostras hoje',
    rows: [
      { name: 'Tubo EDTA · Ana Silva',     ref: 'AM-0291', status: 'ok' },
      { name: 'Tubo citrato · João Costa', ref: 'AM-0290', status: 'pending' },
      { name: 'Tubo gel · Maria Ferreira', ref: 'AM-0289', status: 'critical' },
      { name: 'Urina · Rui Mendes',        ref: 'AM-0288', status: 'ok' },
    ],
  },
  {
    id: 4, name: 'Análise', sub: 'Worklist · hematologia · bioquímica · micro',
    color: '#D4920A', svgY: 216, svgH: 40, stat: '89', statLabel: 'em processamento',
    rows: [
      { name: 'XN-1000 · Hematologia',   ref: 'EQ-01', status: 'ok' },
      { name: 'AU5800 · Bioquímica',     ref: 'EQ-02', status: 'ok' },
      { name: 'Cobas · Imunologia',      ref: 'EQ-03', status: 'pending' },
      { name: 'VIDAS · Endocrinologia',  ref: 'EQ-04', status: 'ok' },
    ],
  },
  {
    id: 5, name: 'Validação', sub: 'Técnica · médica · alertas críticos',
    color: '#7A9E7E', svgY: 256, svgH: 40, stat: '18', statLabel: 'pendentes validação',
    rows: [
      { name: 'D-Dímero 4.8 µg/mL', ref: 'VAL-045', status: 'critical' },
      { name: 'Hemograma LAB-2847', ref: 'VAL-044', status: 'ok' },
      { name: 'TSH LAB-2846',       ref: 'VAL-043', status: 'pending' },
      { name: 'PCR LAB-2841',       ref: 'VAL-042', status: 'ok' },
    ],
  },
  {
    id: 6, name: 'Financeiro', sub: 'Faturação · SNS · seguradoras · SAP',
    color: '#5A6478', svgY: 296, svgH: 38, stat: '€ 12.4k', statLabel: 'faturação mensal',
    rows: [
      { name: 'Fatura SNS · Maio',      ref: 'FAT-0501', status: 'pending' },
      { name: 'Acordo Médis · Abril',   ref: 'FAT-0412', status: 'ok' },
      { name: 'Particular · LAB-2845', ref: 'FAT-0500', status: 'ok' },
      { name: 'Exportação SAP',         ref: 'SAP-001',  status: 'pending' },
    ],
  },
  {
    id: 7, name: 'Analytics', sub: 'BI · KPIs · relatórios agendados',
    color: '#1A1A18', svgY: 334, svgH: 34, stat: '↑ 12%', statLabel: 'vs semana passada',
    rows: [
      { name: 'Dashboard executivo', ref: 'KPI-01', status: 'ok' },
      { name: 'Relatório semanal',   ref: 'KPI-02', status: 'ok' },
      { name: 'Exportação Excel',    ref: 'KPI-03', status: 'pending' },
      { name: 'Alerta produtividade',ref: 'KPI-04', status: 'ok' },
    ],
  },
  {
    id: 8, name: 'Equipamentos', sub: 'Stock · manutenção · reagentes · calibrações',
    color: '#C87800', svgY: 368, svgH: 36, stat: '12', statLabel: 'equipamentos activos',
    rows: [
      { name: 'XN-1000 · Hematologia',    ref: 'EQ-001', status: 'ok' },
      { name: 'AU5800 · Bioquímica',      ref: 'EQ-002', status: 'ok' },
      { name: 'Reagente EDTA · Lot A041', ref: 'REA-01', status: 'pending' },
      { name: 'Calibração cobas · Jun',   ref: 'CAL-06', status: 'pending' },
    ],
  },
  {
    id: 9, name: 'Integrações', sub: 'e-Prescrição · API REST · Webhooks · SAP',
    color: '#3A3A38', svgY: 404, svgH: 36, stat: '4', statLabel: 'integrações activas',
    rows: [
      { name: 'e-Prescrição SNS · SPMS',  ref: 'INT-01', status: 'ok' },
      { name: 'API REST · v2.0',          ref: 'INT-02', status: 'ok' },
      { name: 'Webhooks · 3 activos',     ref: 'INT-03', status: 'ok' },
      { name: 'SAP S/4HANA · activo',     ref: 'INT-04', status: 'ok' },
    ],
  },
  {
    id: 10, name: 'Segurança', sub: 'Auditoria · RGPD · sessões · backups',
    color: '#6B1A1A', svgY: 440, svgH: 44, stat: '100%', statLabel: 'conformidade RGPD',
    rows: [
      { name: 'Log de auditoria', ref: 'SEC-01', status: 'ok' },
      { name: 'Encriptação AES-256', ref: 'SEC-02', status: 'ok' },
      { name: 'Backup automático',   ref: 'SEC-03', status: 'ok' },
      { name: 'Conformidade RGPD',   ref: 'SEC-04', status: 'ok' },
    ],
  },
]

export default function Landing() {
  const [hovered,    setHovered]    = useState<number | null>(null)
  const [diving,     setDiving]     = useState(false)
  const [diveColor,  setDiveColor]  = useState('#000000')
  const [activeSegId, setActiveSegId] = useState<number | null>(null)
  const [criticos,   setCriticos]   = useState(0)
  const [emCurso,    setEmCurso]    = useState(0)
  const [tipHover,   setTipHover]   = useState(false)
  const navigate = useNavigate()
  const { logout, user } = useAuthStore()

  useEffect(() => {
    api.get('/resultados/stats').then(r => setCriticos(r.data.criticosPorValidar ?? 0)).catch(() => {})
    api.get('/requisicoes/stats').then(r => setEmCurso(r.data.em_curso ?? 0)).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSegClick = (seg: Segment) => {
    setActiveSegId(seg.id)
    setDiveColor(seg.color)
    setDiving(true)
  }

  return (
    <div className="landing">

      <div className="landing-topbar">
        <div className="landing-user">
          <span className="landing-user-name">{user?.nome ?? user?.email}</span>
          <span className="landing-user-role">{user?.role}</span>
        </div>
        <div className="landing-topbar-right">
          <NotificationBell theme="dark" />
          <button className="landing-logout" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      {diving && (
        <DiveCanvas
          color={diveColor}
          onComplete={() =>
            navigate(`/modulo/${activeSegId}`, {
              state: { seg: SEGMENTS.find(s => s.id === activeSegId) },
            })
          }
        />
      )}

      <motion.div
        className="tube-scene"
        animate={
          diving
            ? { scale: 6, opacity: 0 }
            : hovered !== null
              ? { scale: 1.07, opacity: 1 }
              : { scale: 1,    opacity: 1 }
        }
        transition={
          diving
            ? { duration: 0.6, ease: [0.4, 0, 1, 1], delay: 0.2 }
            : { type: 'spring', stiffness: 260, damping: 24 }
        }
      >
        <svg
          className="tube-svg"
          width="120"
          height="720"
          viewBox="0 0 88 540"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="glassL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
              <stop offset="18%"  stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%"  stopColor="rgba(255,255,255,0.02)" />
              <stop offset="75%"  stopColor="rgba(0,0,0,0.08)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
            </linearGradient>
            <linearGradient id="glassR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.0)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>
            <linearGradient id="capG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#4A4A48" />
              <stop offset="40%"  stopColor="#2A2A28" />
              <stop offset="100%" stopColor="#111110" />
            </linearGradient>
          </defs>

          <rect x="14" y="40" width="60" height="460" rx="2"
            fill="rgba(255,255,255,0.55)"
            stroke="rgba(10,10,8,0.18)" strokeWidth="1"
          />

          {SEGMENTS.map((seg) => (
            <rect
              key={seg.id}
              x="14" y={seg.svgY}
              width="60" height={seg.svgH}
              fill={seg.color}
              opacity={
                diving
                  ? activeSegId === seg.id ? 1 : 0
                  : hovered === seg.id ? 1 : 0.85
              }
              style={{ transition: 'opacity 0.25s' }}
            />
          ))}

          {SEGMENTS.slice(1).map((seg) => (
            <line
              key={`div-${seg.id}`}
              x1="14" y1={seg.svgY}
              x2="74" y2={seg.svgY}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              opacity={diving ? 0 : 1}
              style={{ transition: 'opacity 0.2s' }}
            />
          ))}

          <polygon points="14,500 74,500 57,534 31,534"
            fill={tipHover ? '#3A2A2A' : '#111110'}
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s, fill 0.18s' }}
          />
          <polygon points="14,500 74,500 57,534 31,534"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(10,10,8,0.2)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s' }}
          />
          <ellipse cx="44" cy="534" rx="13" ry="4"
            fill={tipHover ? '#3A2A2A' : '#0A0A08'}
            stroke="rgba(10,10,8,0.3)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s, fill 0.18s' }}
          />
          {/* hit area logout */}
          <polygon
            points="14,500 74,500 57,534 31,534"
            fill="transparent"
            style={{ cursor: diving ? 'default' : 'pointer' }}
            onMouseEnter={() => !diving && setTipHover(true)}
            onMouseLeave={() => setTipHover(false)}
            onClick={() => !diving && handleLogout()}
          />
          <ellipse cx="44" cy="534" rx="13" ry="4"
            fill="transparent"
            style={{ cursor: diving ? 'default' : 'pointer' }}
            onMouseEnter={() => !diving && setTipHover(true)}
            onMouseLeave={() => setTipHover(false)}
            onClick={() => !diving && handleLogout()}
          />

          <rect x="14" y="40" width="60" height="460" rx="2"
            fill="url(#glassL)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="14" y="40" width="60" height="460" rx="2"
            fill="url(#glassR)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="14" y="40" width="60" height="460" rx="2"
            fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="15" y="41" width="58" height="458" rx="2"
            fill="none" stroke="rgba(10,10,8,0.2)" strokeWidth="0.5"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="17" y="48" width="4" height="450" rx="2"
            fill="rgba(255,255,255,0.35)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="17" y="48" width="14" height="450" rx="2"
            fill="rgba(255,255,255,0.08)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <rect x="14" y="40" width="60" height="18" rx="2"
            fill="rgba(255,255,255,0.25)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />
          <ellipse cx="32" cy="52" rx="10" ry="5"
            fill="rgba(255,255,255,0.3)"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.3s' }}
          />

          <rect x="8" y="24" width="72" height="20" rx="4"
            fill="url(#capG)"
            stroke="rgba(10,10,8,0.4)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s' }}
          />
          <rect x="12" y="20" width="64" height="8" rx="3"
            fill="#3A3A38"
            stroke="rgba(10,10,8,0.3)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s' }}
          />

          {SEGMENTS.slice(1).map((seg) => (
            <line
              key={`tick-${seg.id}`}
              x1="76" y1={seg.svgY}
              x2="83" y2={seg.svgY}
              stroke="rgba(10,10,8,0.18)"
              strokeWidth="1"
              opacity={diving ? 0 : 1}
              style={{ transition: 'opacity 0.2s' }}
            />
          ))}

          {SEGMENTS.map((seg) => (
            <rect
              key={`hit-${seg.id}`}
              x="14" y={seg.svgY}
              width="60" height={seg.svgH}
              fill="transparent"
              style={{ cursor: diving ? 'default' : 'pointer' }}
              onMouseEnter={() => !diving && setHovered(seg.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !diving && handleSegClick(seg)}
            />
          ))}
        </svg>

        {hovered !== null && !diving && (() => {
          const seg    = SEGMENTS[hovered]
          const midY   = seg.svgY + seg.svgH / 2
          const topPct = (midY / 540) * 100
          const livestat =
            seg.id === 2 && emCurso   > 0 ? `${emCurso} em curso` :
            seg.id === 5 && criticos  > 0 ? `${criticos} críticos` :
            null
          return (
            <div className="seg-label" style={{ top: `${topPct}%` }}>
              <div className="seg-label-line" />
              <div className="seg-label-num">{String(seg.id).padStart(2, '0')}</div>
              <div className="seg-label-name">{seg.name}</div>
              <div className="seg-label-desc">{seg.sub}</div>
              {livestat && <div className="seg-label-live">{livestat}</div>}
            </div>
          )
        })()}

        {tipHover && !diving && (
          <div className="seg-label seg-label--logout" style={{ top: `${(517 / 540) * 100}%` }}>
            <div className="seg-label-line" />
            <div className="seg-label-name" style={{ fontSize: 20, color: 'rgba(200,0,26,0.75)' }}>sair</div>
            <div className="seg-label-desc">terminar sessão</div>
          </div>
        )}

        {/* badge críticos persistente — segmento Validação */}
        {criticos > 0 && !diving && (
          <div className="live-badge live-badge--crit" style={{ top: `${((256 + 20) / 540) * 100}%` }}>
            <span className="live-badge-pulse" />
            {criticos} crítico{criticos !== 1 ? 's' : ''}
          </div>
        )}

        {/* badge requisições em curso — segmento Requisições */}
        {emCurso > 0 && !diving && (
          <div className="live-badge live-badge--info" style={{ top: `${((128 + 22) / 540) * 100}%` }}>
            {emCurso} em curso
          </div>
        )}
      </motion.div>

      <div className={`slogan slogan-left${hovered !== null ? ' slogan--hide' : ''}`}>
        <div style={{ marginBottom: '0.15em' }}>Análises</div>
        <div style={{ textAlign: 'center' }}>que falam</div>
      </div>
      <div className={`slogan slogan-right${hovered !== null ? ' slogan--hide' : ''}`}>Contigo</div>

    </div>
  )
}