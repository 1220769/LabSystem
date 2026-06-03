import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Utilizadores from './modules/Utilizadores'
import Utentes      from './modules/Utentes'
import Requisicoes  from './modules/Requisicoes'
import Colheita     from './modules/Colheita'
import Analise      from './modules/Analise'
import Validacao    from './modules/Validacao'
import Financeiro   from './modules/Financeiro'
import Analytics    from './modules/Analytics'
import Equipamentos from './modules/Equipamentos'
import Integracoes  from './modules/Integracoes'
import Seguranca    from './modules/Seguranca'
import './Modulo.css'

export default function Modulo() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const seg       = state?.seg

  if (!seg) return null

  if (seg.id === 0)  return <Utilizadores seg={seg} />
  if (seg.id === 1)  return <Utentes      seg={seg} />
  if (seg.id === 2)  return <Requisicoes  seg={seg} />
  if (seg.id === 3)  return <Colheita     seg={seg} />
  if (seg.id === 4)  return <Analise      seg={seg} />
  if (seg.id === 5)  return <Validacao    seg={seg} />
  if (seg.id === 6)  return <Financeiro   seg={seg} />
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
