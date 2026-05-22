import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Modulo.css'

export default function Modulo() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const seg = state?.seg

  if (!seg) return null

  return (
    <motion.div
      className="modulo"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <button className="modulo-back" onClick={() => navigate('/')}>
        ← voltar
      </button>
      <div className="modulo-num">{String(seg.id).padStart(2, '0')}</div>
      <div className="modulo-name">{seg.name}</div>
      <div className="modulo-sub">{seg.sub}</div>
      <div className="modulo-stat">{seg.stat}</div>
      <div className="modulo-stat-label">{seg.statLabel}</div>
    </motion.div>
  )
}