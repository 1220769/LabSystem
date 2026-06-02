import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import './Login.css'

const TEST_LOGINS: Record<string, { email: string; password: string }> = {
  medico: {
    email: 'medico@labsystem.pt',
    password: 'medico123',
  },
  tecnico: {
    email: 'tecnico@labsystem.pt',
    password: 'tecnico123',
  },
  enfermeiro: {
    email: 'enfermeiro@labsystem.pt',
    password: 'enfermeiro123',
  },
  utente: {
    email: 'utente@labsystem.pt',
    password: 'utente123',
  },
  administrador: {
    email: 'admin@labsystem.pt',
    password: 'admin123',
  },
}

export default function Login() {
  const canvasRef                   = useRef<HTMLCanvasElement>(null)
  const pageRef                     = useRef<HTMLDivElement>(null)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const { setAuth }                 = useAuthStore()
  const navigate                    = useNavigate()

  useEffect(() => {
    const canvas = canvasRef.current
    const page   = pageRef.current
    if (!canvas || !page) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = page.offsetWidth
      canvas.height = page.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const CELL_COUNT  = 38
    const randBetween = (a: number, b: number) => a + Math.random() * (b - a)

    class Cell {
      x = 0; y = 0; rx = 0; ry = 0
      angle = 0; dAngle = 0; vx = 0; vy = 0
      alpha = 0; dAlpha = 0; hue = ''
      nRx = 0; nRy = 0; nOx = 0; nOy = 0

      constructor() { this.reset(true) }

  reset(init: boolean) {
  this.x      = randBetween(0, canvas!.width)
  this.y      = init ? randBetween(0, canvas!.height) : randBetween(0, canvas!.height)
  this.rx     = randBetween(18, 48)
  this.ry     = randBetween(14, 36)
  this.angle  = randBetween(0, Math.PI * 2)
  this.dAngle = (Math.random() - 0.5) * 0.004
  this.vx     = (Math.random() - 0.5) * 0.18
  this.vy     = (Math.random() - 0.5) * 0.18
  this.alpha  = randBetween(0.2, 0.5)
  this.dAlpha = (Math.random() - 0.5) * 0.001
  const pick  = Math.random()
  if (pick < 0.55)      this.hue = 'rgba(255,80,80,'
  else if (pick < 0.78) this.hue = 'rgba(80,200,160,'
  else if (pick < 0.92) this.hue = 'rgba(240,180,60,'
  else                  this.hue = 'rgba(140,180,240,'
  this.nRx = this.rx * randBetween(0.28, 0.42)
  this.nRy = this.ry * randBetween(0.28, 0.42)
  this.nOx = (Math.random() - 0.5) * this.rx * 0.3
  this.nOy = (Math.random() - 0.5) * this.ry * 0.3
}
  update() {
  this.x     += this.vx
  this.y     += this.vy
  this.angle += this.dAngle
  this.alpha += this.dAlpha
  if (this.alpha < 0.15) this.dAlpha =  Math.abs(this.dAlpha)
  if (this.alpha > 0.55) this.dAlpha = -Math.abs(this.dAlpha)
  if (this.x < -60 || this.x > canvas!.width  + 60) this.vx *= -1
  if (this.y < -60 || this.y > canvas!.height + 60) this.vy *= -1
}
      draw() {
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(this.angle)
        ctx.beginPath()
        ctx.ellipse(0, 0, this.rx, this.ry, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `${this.hue}${(this.alpha * 1.8).toFixed(3)})`
        ctx.lineWidth   = 1.2
        ctx.stroke()
        ctx.fillStyle   = `${this.hue}${(this.alpha * 0.35).toFixed(3)})`
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(this.nOx, this.nOy, this.nRx, this.nRy, this.angle * 0.5, 0, Math.PI * 2)
        ctx.strokeStyle = `${this.hue}${(this.alpha * 1.4).toFixed(3)})`
        ctx.lineWidth   = 0.8
        ctx.stroke()
        ctx.fillStyle   = `${this.hue}${(this.alpha * 0.5).toFixed(3)})`
        ctx.fill()
        ctx.restore()
      }
    }

    const cells = Array.from({ length: CELL_COUNT }, () => new Cell())
    let rafId: number
    const loop = () => {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      cells.forEach(c => { c.update(); c.draw() })
      rafId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data, data.token)
      navigate('/private')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    setError('')
    const credentials = TEST_LOGINS[role]
    if (!credentials) return
    setEmail(credentials.email)
    setPassword(credentials.password)
  }

  return (
    <div className="login-page" ref={pageRef}>
      <canvas ref={canvasRef} className="login-canvas" />
      <div className="login-overlay" />

      <div className="login-stamp login-stamp-tl">
        LabSystem Pro<br />v2.0 · 2025
      </div>
      <div className="login-stamp login-stamp-tr">
        HCUL<br />Lab Central
      </div>

      <div className="login-card">

        <div className="login-logo-wrap">
          <div className="login-logo-mark">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="13" y="2" width="6" height="8" rx="1.5" fill="#C8001A" opacity=".9"/>
              <rect x="13" y="2" width="6" height="28" rx="1.5" fill="none" stroke="#C8001A" strokeWidth="1.5" opacity=".3"/>
              <rect x="11" y="8" width="10" height="5" fill="#E8D5B0" opacity=".8"/>
              <rect x="11" y="13" width="10" height="5" fill="#B8CDE0" opacity=".8"/>
              <rect x="11" y="18" width="10" height="5" fill="#C8001A" opacity=".7"/>
              <rect x="11" y="23" width="10" height="5" fill="#D4920A" opacity=".7"/>
              <polygon points="11,28 21,28 19,31 13,31" fill="#0A0A08" opacity=".6"/>
            </svg>
          </div>
          <div>
            <div className="login-logo-text">Lab<em>System</em></div>
            <div className="login-logo-sub">Gestão clínica · Porto</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Email institucional</label>
            <input
              className="login-input"
              type="email"
              placeholder="utilizador@hospital.pt"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'A entrar...' : 'Entrar no sistema'}
          </button>
        </form>

        <div className="login-divider">
          <div className="login-divider-line" />
          <div className="login-divider-text">perfil de acesso</div>
          <div className="login-divider-line" />
        </div>

        <div className="login-roles">
          {[
            { icon: 'ti-stethoscope',        label: 'Médico',     role: 'medico'       },
            { icon: 'ti-flask',              label: 'Técnico',    role: 'tecnico'      },
            { icon: 'ti-heart-rate-monitor', label: 'Enfermeiro', role: 'enfermeiro'   },
            { icon: 'ti-user',               label: 'Utente',     role: 'utente'       },
            { icon: 'ti-shield-lock',        label: 'Admin',      role: 'administrador'},
          ].map(r => (
            <div
              className={`login-chip ${selectedRole === r.role ? 'login-chip--active' : ''}`}
              key={r.label}
              onClick={() => handleRoleSelect(r.role)}
            >
              <i className={`ti ${r.icon}`} aria-hidden="true" />
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <div className="login-footer">Análises que falam contigo</div>
      </div>
    </div>
  )
}
