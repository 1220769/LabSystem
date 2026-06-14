import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import DiveCanvas from '../components/DiveCanvas'
import NotificationBell from '../components/NotificationBell'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import './Landing.css'

interface ModuleInfo {
  id: number
  name: string
  sub: string
  color: string
  stat: string
  statLabel: string
}

interface Group {
  modules: ModuleInfo[]
  svgY: number
  svgH: number
}

const ALL_MODULES: ModuleInfo[] = [
  { id: 0,  name: 'Utilizadores', sub: 'Perfis · permissões · acessos',                   color: '#2A2A28', stat: '6',      statLabel: 'perfis configurados'   },
  { id: 1,  name: 'Utentes',      sub: 'Ficha clínica · portal · agendamento',             color: '#C8A060', stat: '1 284',  statLabel: 'registos activos'      },
  { id: 2,  name: 'Requisições',  sub: 'Pedidos analíticos · urgentes · e-prescrição',     color: '#B8CDE0', stat: '47',     statLabel: 'em curso agora'        },
  { id: 3,  name: 'Colheita',     sub: 'QR · rastreio em tempo real · domiciliária',       color: '#C8001A', stat: '284',    statLabel: 'amostras hoje'         },
  { id: 4,  name: 'Análise',      sub: 'Worklist · hematologia · bioquímica · micro',      color: '#D4920A', stat: '89',     statLabel: 'em processamento'      },
  { id: 5,  name: 'Validação',    sub: 'Técnica · médica · alertas críticos',              color: '#7A9E7E', stat: '18',     statLabel: 'pendentes validação'   },
  { id: 6,  name: 'Financeiro',   sub: 'Faturação · SNS · seguradoras · SAP',              color: '#5A6478', stat: '€ 12.4k',statLabel: 'faturação mensal'      },
  { id: 7,  name: 'Analytics',    sub: 'BI · KPIs · relatórios agendados',                 color: '#1A3A28', stat: '↑ 12%', statLabel: 'vs semana passada'     },
  { id: 8,  name: 'Equipamentos', sub: 'Stock · manutenção · reagentes · calibrações',     color: '#C87800', stat: '12',     statLabel: 'equipamentos activos'  },
  { id: 9,  name: 'Integrações',  sub: 'e-Prescrição · API REST · Webhooks · SAP',         color: '#3A5A6A', stat: '4',      statLabel: 'integrações activas'   },
  { id: 10, name: 'Segurança',    sub: 'Auditoria · RGPD · sessões · backups',             color: '#6B1A1A', stat: '100%',   statLabel: 'conformidade RGPD'     },
]

// 6 bandas no tubo — cada uma com 1 ou 2 módulos
const GROUPS: Group[] = [
  { modules: [ALL_MODULES[0], ALL_MODULES[10]], svgY: 40,  svgH: 76 }, // Utilizadores + Segurança
  { modules: [ALL_MODULES[1]],                  svgY: 116, svgH: 76 }, // Utentes
  { modules: [ALL_MODULES[2], ALL_MODULES[3]],  svgY: 192, svgH: 76 }, // Requisições + Colheita
  { modules: [ALL_MODULES[4], ALL_MODULES[5]],  svgY: 268, svgH: 76 }, // Análise + Validação
  { modules: [ALL_MODULES[6], ALL_MODULES[7]],  svgY: 344, svgH: 76 }, // Financeiro + Analytics
  { modules: [ALL_MODULES[8], ALL_MODULES[9]],  svgY: 420, svgH: 76 }, // Equipamentos + Integrações
]

/* ──────────────────────────────────────────────────────────────────────────
   CAMADA VIVA DO TUBO  —  bolhas + partículas de fluxo + brilho pulsante.
   Tudo determinístico (sem Math.random) para hidratação estável.
   Geometria igual à do tubo: interior x14 y40 w60 h456  →  base = 496.
─────────────────────────────────────────────────────────────────────────── */

// pseudo-aleatório determinístico a partir de uma semente
const rnd = (n: number) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s) }

// bandas "vivas" por defeito: Requisições·Colheita (idx 2) e Análise·Validação (idx 3).
// Para ligar a dados reais, vê isLive() mais abaixo.
const LIVE_GROUPS = new Set<number>([2, 3])

interface ActivityProps {
  hovered: number | null
  diving: boolean
  emCurso?: number
  criticos?: number
}

function TubeActivity({ hovered, diving, emCurso = 0, criticos = 0 }: ActivityProps) {
  if (diving) return null

  // banda viva: por defeito as fixas; se passares emCurso/criticos, pulsa só com atividade real
  const isLive = (gi: number) =>
    gi === 2 ? (emCurso  > 0 || LIVE_GROUPS.has(gi))
  : gi === 3 ? (criticos > 0 || LIVE_GROUPS.has(gi))
  : LIVE_GROUPS.has(gi)

  // bolhas por banda (hover liberta uma rajada extra)
  const bubbles = GROUPS.flatMap((g, gi) => {
    const live  = isLive(gi)
    const isHov = hovered === gi
    const count = (live ? 5 : 3) + (isHov ? 5 : 0)
    return Array.from({ length: count }, (_, i) => {
      const s = gi * 97 + i * 13 + (isHov ? 1000 : 0)
      return {
        key:   `${gi}-${i}-${isHov ? 'h' : 'n'}`,
        cx:    23 + rnd(s) * 42,            // dentro do tubo (x 14..74)
        cy:    g.svgY + g.svgH - 3,         // fundo da banda
        r:     0.8 + rnd(s + 1) * 1.7,
        rise:  -(30 + rnd(s + 2) * 38),
        dur:   (live ? 2.5 : 3.8) - (isHov ? 0.9 : 0) + rnd(s + 3) * 1.5,
        delay: rnd(s + 4) * 3,
        bmax:  live ? 0.6 : 0.4,
      }
    })
  })

  // partículas de fluxo — amostras a percorrer o pipeline (de baixo para cima)
  const flow = [0, 1, 2, 3].map(i => {
    const s = 500 + i * 37
    return { key: `f${i}`, cx: 23 + rnd(s) * 42, dur: 3.4 + rnd(s + 1) * 2.4, delay: rnd(s + 2) * 4 }
  })

  return (
    <g clipPath="url(#tubeClip)">
      {/* brilho pulsante nas bandas vivas */}
      {GROUPS.map((g, gi) => isLive(gi) && (
        <rect key={`glow-${gi}`}
          x="14" y={g.svgY} width="60" height={g.svgH}
          fill={g.modules[0].color}
          style={{ mixBlendMode: 'screen', animation: `tubeLiveGlow ${gi === 3 ? 1.9 : 3}s ease-in-out infinite` }}
        />
      ))}

      {/* partículas de fluxo */}
      {flow.map(f => (
        <circle key={f.key} cx={f.cx} cy="492" r="1.7" fill="#C8001A"
          style={{ ['--flowrise' as any]: '-446px', animation: `tubeFlow ${f.dur}s linear ${f.delay}s infinite` }}
        />
      ))}

      {/* bolhas */}
      {bubbles.map(b => (
        <circle key={b.key} cx={b.cx} cy={b.cy} r={b.r} fill="rgba(255,255,255,0.88)"
          style={{
            ['--rise' as any]: `${b.rise}px`,
            ['--bmax' as any]: b.bmax,
            animation: `tubeBubble ${b.dur}s ease-in ${b.delay}s infinite`,
          }}
        />
      ))}
    </g>
  )
}

export default function Landing() {
  const [hovered,     setHovered]     = useState<number | null>(null)
  const [picker,      setPicker]      = useState<number | null>(null)
  const [diving,      setDiving]      = useState(false)
  const [diveColor,   setDiveColor]   = useState('#000000')
  const [activeModId, setActiveModId] = useState<number | null>(null)
  const [criticos,    setCriticos]    = useState(0)
  const [emCurso,     setEmCurso]     = useState(0)
  const [tipHover,    setTipHover]    = useState(false)
  const navigate = useNavigate()
  const { logout, user } = useAuthStore()

  useEffect(() => {
    api.get('/resultados/stats').then(r => setCriticos(r.data.criticosPorValidar ?? 0)).catch(() => {})
    api.get('/requisicoes/stats').then(r => setEmCurso(r.data.em_curso ?? 0)).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const dive = (mod: ModuleInfo) => {
    setPicker(null)
    setActiveModId(mod.id)
    setDiveColor(mod.color)
    setDiving(true)
  }

  const handleGroupClick = (gi: number) => {
    if (diving) return
    const group = GROUPS[gi]
    if (group.modules.length === 1) {
      dive(group.modules[0])
    } else {
      setPicker(picker === gi ? null : gi)
    }
  }

  return (
    <div className="landing" onClick={() => setPicker(null)}>

      <div className="landing-topbar">
        <div className="landing-user">
          <span className="landing-user-name">{user?.nome ?? user?.email}</span>
          <span className="landing-user-role">{user?.role}</span>
        </div>
        <div className="landing-topbar-right">
          <NotificationBell theme="light" />
          <button className="landing-logout" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      {diving && (
        <DiveCanvas
          color={diveColor}
          onComplete={() =>
            navigate(`/modulo/${activeModId}`, {
              state: { seg: ALL_MODULES.find(m => m.id === activeModId) },
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
            {/* recorta a camada viva ao interior do tubo */}
            <clipPath id="tubeClip">
              <rect x="14" y="40" width="60" height="456" rx="2" />
            </clipPath>
          </defs>

          {/* fundo do tubo */}
          <rect x="14" y="40" width="60" height="456" rx="2"
            fill="rgba(255,255,255,0.55)"
            stroke="rgba(10,10,8,0.18)" strokeWidth="1"
          />

          {/* bandas coloridas — 1 rect por grupo */}
          {GROUPS.map((g, gi) => {
            const isHov  = hovered === gi
            const isPick = picker === gi
            const col    = g.modules[0].color
            const isDiving = diving && g.modules.some(m => m.id === activeModId)
            return (
              <rect key={gi}
                x="14" y={g.svgY} width="60" height={g.svgH}
                fill={col}
                opacity={diving ? (isDiving ? 1 : 0) : isHov || isPick ? 1 : 0.82}
                style={{ transition: 'opacity 0.25s' }}
              />
            )
          })}

          {/* ▼▼▼ CAMADA VIVA — bolhas, fluxo, brilho (por baixo do vidro) ▼▼▼ */}
          <TubeActivity hovered={hovered} diving={diving} emCurso={emCurso} criticos={criticos} />
          {/* ▲▲▲ ────────────────────────────────────────────────────── ▲▲▲ */}

          {/* divisores entre grupos */}
          {GROUPS.slice(1).map((g, i) => (
            <line key={`div-${i}`}
              x1="14" y1={g.svgY} x2="74" y2={g.svgY}
              stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"
              opacity={diving ? 0 : 1}
              style={{ transition: 'opacity 0.2s' }}
            />
          ))}

          {/* ponta — logout */}
          <polygon points="14,496 74,496 57,530 31,530"
            fill={tipHover ? '#3A2A2A' : '#111110'}
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s, fill 0.18s' }}
          />
          <polygon points="14,496 74,496 57,530 31,530"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(10,10,8,0.2)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s' }}
          />
          <ellipse cx="44" cy="530" rx="13" ry="4"
            fill={tipHover ? '#3A2A2A' : '#0A0A08'}
            stroke="rgba(10,10,8,0.3)" strokeWidth="1"
            opacity={diving ? 0 : 1}
            style={{ transition: 'opacity 0.2s, fill 0.18s' }}
          />
          <polygon points="14,496 74,496 57,530 31,530" fill="transparent"
            style={{ cursor: diving ? 'default' : 'pointer' }}
            onMouseEnter={() => !diving && setTipHover(true)}
            onMouseLeave={() => setTipHover(false)}
            onClick={e => { e.stopPropagation(); if (!diving) handleLogout() }}
          />
          <ellipse cx="44" cy="530" rx="13" ry="4" fill="transparent"
            style={{ cursor: diving ? 'default' : 'pointer' }}
            onMouseEnter={() => !diving && setTipHover(true)}
            onMouseLeave={() => setTipHover(false)}
            onClick={e => { e.stopPropagation(); if (!diving) handleLogout() }}
          />

          {/* camadas de vidro */}
          <rect x="14" y="40" width="60" height="456" rx="2" fill="url(#glassL)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="14" y="40" width="60" height="456" rx="2" fill="url(#glassR)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="14" y="40" width="60" height="456" rx="2" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="15" y="41" width="58" height="454" rx="2" fill="none" stroke="rgba(10,10,8,0.2)" strokeWidth="0.5" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="17" y="48" width="4"  height="440" rx="2" fill="rgba(255,255,255,0.35)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="17" y="48" width="14" height="440" rx="2" fill="rgba(255,255,255,0.08)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <rect x="14" y="40" width="60" height="18"  rx="2" fill="rgba(255,255,255,0.25)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />
          <ellipse cx="32" cy="52" rx="10" ry="5" fill="rgba(255,255,255,0.3)" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.3s' }} />

          {/* tampa */}
          <rect x="8"  y="24" width="72" height="20" rx="4" fill="url(#capG)" stroke="rgba(10,10,8,0.4)" strokeWidth="1" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.2s' }} />
          <rect x="12" y="20" width="64" height="8"  rx="3" fill="#3A3A38"    stroke="rgba(10,10,8,0.3)" strokeWidth="1" opacity={diving ? 0 : 1} style={{ transition: 'opacity 0.2s' }} />

          {/* ticks laterais */}
          {GROUPS.slice(1).map((g, i) => (
            <line key={`tick-${i}`}
              x1="76" y1={g.svgY} x2="83" y2={g.svgY}
              stroke="rgba(10,10,8,0.18)" strokeWidth="1"
              opacity={diving ? 0 : 1}
              style={{ transition: 'opacity 0.2s' }}
            />
          ))}

          {/* hit areas por grupo */}
          {GROUPS.map((g, gi) => (
            <rect key={`hit-${gi}`}
              x="14" y={g.svgY} width="60" height={g.svgH}
              fill="transparent"
              style={{ cursor: diving ? 'default' : 'pointer' }}
              onMouseEnter={() => !diving && setHovered(gi)}
              onMouseLeave={() => setHovered(null)}
              onClick={e => { e.stopPropagation(); handleGroupClick(gi) }}
            />
          ))}
        </svg>

        {/* label hover */}
        {hovered !== null && !diving && (() => {
          const g      = GROUPS[hovered]
          const midY   = g.svgY + g.svgH / 2
          const topPct = (midY / 540) * 100
          const livestat =
            g.modules.some(m => m.id === 2) && emCurso  > 0 ? `${emCurso} em curso`    :
            g.modules.some(m => m.id === 5) && criticos > 0 ? `${criticos} críticos`   :
            null
          return (
            <div className="seg-label" style={{ top: `${topPct}%` }}>
              <div className="seg-label-line" />
              {g.modules.length === 1 ? (
                <>
                  <div className="seg-label-name">{g.modules[0].name}</div>
                  <div className="seg-label-desc">{g.modules[0].sub}</div>
                </>
              ) : (
                <>
                  <div className="seg-label-name">{g.modules[0].name}</div>
                  <div className="seg-label-name seg-label-name--2">{g.modules[1].name}</div>
                </>
              )}
              {livestat && <div className="seg-label-live">{livestat}</div>}
            </div>
          )
        })()}

        {/* picker para grupos com 2 módulos */}
        <AnimatePresence>
          {picker !== null && !diving && (() => {
            const g      = GROUPS[picker]
            const midY   = g.svgY + g.svgH / 2
            const topPct = (midY / 540) * 100
            return (
              <motion.div
                className="tube-picker"
                style={{ top: `${topPct}%` }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                onClick={e => e.stopPropagation()}
              >
                {g.modules.map(mod => (
                  <button
                    key={mod.id}
                    className="tube-picker-btn"
                    style={{ '--dot': mod.color } as React.CSSProperties}
                    onClick={() => dive(mod)}
                  >
                    {mod.name}
                  </button>
                ))}
              </motion.div>
            )
          })()}
        </AnimatePresence>

        {tipHover && !diving && (
          <div className="seg-label seg-label--logout" style={{ top: `${(513 / 540) * 100}%` }}>
            <div className="seg-label-line" />
            <div className="seg-label-name" style={{ fontSize: 20, color: 'rgba(200,0,26,0.75)' }}>sair</div>
            <div className="seg-label-desc">terminar sessão</div>
          </div>
        )}

        {criticos > 0 && !diving && (
          <div
            className="live-badge live-badge--crit"
            style={{
              top: `${((268 + 38) / 540) * 100}%`,
              opacity: hovered === 3 || picker === 3 ? 0 : 1,
              transition: 'opacity 0.18s',
              pointerEvents: 'none',
            }}
          >
            <span className="live-badge-pulse" />
            {criticos} crítico{criticos !== 1 ? 's' : ''}
          </div>
        )}
        {emCurso > 0 && !diving && (
          <div
            className="live-badge live-badge--info"
            style={{
              top: `${((192 + 38) / 540) * 100}%`,
              opacity: hovered === 2 || picker === 2 ? 0 : 1,
              transition: 'opacity 0.18s',
              pointerEvents: 'none',
            }}
          >
            {emCurso} em curso
          </div>
        )}
      </motion.div>

      <div className={`slogan slogan-left${hovered !== null || picker !== null ? ' slogan--hide' : ''}`}>
        Análises que falam
      </div>
      <div className={`slogan slogan-right${hovered !== null || picker !== null ? ' slogan--hide' : ''}`}>Contigo</div>

    </div>
  )
}
