import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Utilizadores              from './modules/Utilizadores'
import Utentes                   from './modules/Utentes'
import Requisicoes               from './modules/Requisicoes'
import Colheita                  from './modules/Colheita'
import Analise                   from './modules/Analise'
import Validacao                 from './modules/Validacao'
import Financeiro                from './modules/Financeiro'
import Analytics                 from './modules/Analytics'
import Equipamentos              from './modules/Equipamentos'
import Integracoes               from './modules/Integracoes'
import Seguranca                 from './modules/Seguranca'
import './Modulo.css'

const MODULE_DEFAULTS = [
  { id: 0,  name: 'Utilizadores', sub: 'Perfis · permissões · acessos',                color: '#2A2A28', stat: '—', statLabel: '' },
  { id: 1,  name: 'Utentes',      sub: 'Ficha clínica · portal · agendamento',          color: '#C8A060', stat: '—', statLabel: '' },
  { id: 2,  name: 'Requisições',  sub: 'Pedidos analíticos · urgentes · e-prescrição',  color: '#B8CDE0', stat: '—', statLabel: '' },
  { id: 3,  name: 'Colheita',     sub: 'QR · rastreio em tempo real · domiciliária',    color: '#C8001A', stat: '—', statLabel: '' },
  { id: 4,  name: 'Análise',      sub: 'Worklist · hematologia · bioquímica · micro',   color: '#D4920A', stat: '—', statLabel: '' },
  { id: 5,  name: 'Validação',    sub: 'Técnica · médica · alertas críticos',           color: '#7A9E7E', stat: '—', statLabel: '' },
  { id: 6,  name: 'Financeiro',   sub: 'Faturação · SNS · seguradoras · SAP',           color: '#5A6478', stat: '—', statLabel: '' },
  { id: 7,  name: 'Analytics',    sub: 'BI · KPIs · relatórios agendados',              color: '#1A3A28', stat: '—', statLabel: '' },
  { id: 8,  name: 'Equipamentos', sub: 'Stock · manutenção · reagentes · calibrações',  color: '#C87800', stat: '—', statLabel: '' },
  { id: 9,  name: 'Integrações',  sub: 'e-Prescrição · API REST · Webhooks · SAP',      color: '#3A5A6A', stat: '—', statLabel: '' },
  { id: 10, name: 'Segurança',    sub: 'Auditoria · RGPD · sessões · backups',          color: '#6B1A1A', stat: '—', statLabel: '' },
]

export default function Modulo() {
  const { state }  = useLocation()
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()

  // se vier de notificação (sem state), usa os dados por defeito do módulo
  const seg = state?.seg ?? MODULE_DEFAULTS.find(m => m.id === Number(id))

  if (!seg) return null

  if (seg.id === 0)  return <Utilizadores seg={seg} />
  if (seg.id === 1)  return <Utentes      seg={seg} />
  if (seg.id === 2)  return <Requisicoes  seg={seg} />
  if (seg.id === 3)  return <Colheita     seg={seg} />
  if (seg.id === 4)  return <Analise      seg={seg} />
  if (seg.id === 5)  return <Validacao    seg={seg} />
  if (seg.id === 6)  return <Financeiro    seg={seg} />
  if (seg.id === 7)  return <Analytics    seg={seg} />
  if (seg.id === 8)  return <Equipamentos seg={seg} />
  if (seg.id === 9)  return <Integracoes  seg={seg} />
  if (seg.id === 10) return <Seguranca    seg={seg} />

  return (
    <motion.div
      className="modulo"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <button className="modulo-back" onClick={() => navigate('/')}>← voltar</button>
      <div className="modulo-num">{String(seg.id).padStart(2, '0')}</div>
      <div className="modulo-name">{seg.name}</div>
      <div className="modulo-sub">{seg.sub}</div>
      <div className="modulo-stat">{seg.stat}</div>
      <div className="modulo-stat-label">{seg.statLabel}</div>
    </motion.div>
  )
}
