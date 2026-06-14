import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import './Login.css'

const DEMO_LOGINS = [
  { label: 'Médico',      email: 'medico@lab.pt',       password: 'medico123'      },
  { label: 'Técnico',     email: 'tecnico@lab.pt',      password: 'tecnico123'     },
  { label: 'Enfermeiro',  email: 'enfermeiro@lab.pt',   password: 'enfermeiro123'  },
  { label: 'Utente',      email: 'utente@lab.pt',       password: 'utente123'      },
  { label: 'Admin',       email: 'admin2@lab.pt',       password: 'admin123'       },
]


export default function Login() {
  const canvasRef                   = useRef<HTMLCanvasElement>(null)
  const pageRef                     = useRef<HTMLDivElement>(null)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
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

  function destino(role: string) {
    if (role === 'utente')        return '/portal'
    if (role === 'medico')        return '/medico'
    if (role === 'tecnico')       return '/tecnico'
    if (role === 'administrador') return '/'
    return '/private'   /* enfermeiro */
  }

  const [regModal,      setRegModal]      = useState(false)
  const [regNome,       setRegNome]       = useState('')
  const [regEmail,      setRegEmail]      = useState('')
  const [regPassword,   setRegPassword]   = useState('')
  const [regConfirm,    setRegConfirm]    = useState('')
  const [regRole,       setRegRole]       = useState('tecnico')
  const [regMsg,        setRegMsg]        = useState('')
  const [regErr,        setRegErr]        = useState('')
  const [regLoading,    setRegLoading]    = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegErr(''); setRegMsg('')
    if (regPassword !== regConfirm) { setRegErr('As passwords não coincidem'); return }
    setRegLoading(true)
    try {
      const { data } = await api.post('/auth/register-request', {
        nome: regNome, email: regEmail, password: regPassword, role: regRole,
      })
      setRegMsg(data.message)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setRegErr(e.response?.data?.message || 'Erro ao criar conta')
    } finally {
      setRegLoading(false)
    }
  }

  const [recovering,      setRecovering]      = useState(false)
  const [recoverEmail,    setRecoverEmail]    = useState('')
  const [recoverNome,     setRecoverNome]     = useState('')
  const [recoverPassword, setRecoverPassword] = useState('')
  const [recoverConfirm,  setRecoverConfirm]  = useState('')
  const [recoverMsg,      setRecoverMsg]      = useState('')
  const [recoverErr,      setRecoverErr]      = useState('')
  const [recoverLoading,  setRecoverLoading]  = useState(false)

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecoverErr(''); setRecoverMsg('')
    if (recoverPassword !== recoverConfirm) {
      setRecoverErr('As passwords não coincidem')
      return
    }
    setRecoverLoading(true)
    try {
      const { data } = await api.post('/auth/recover-request', {
        email:        recoverEmail,
        nome:         recoverNome,
        passwordNova: recoverPassword,
      })
      setRecoverMsg(data.message)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setRecoverErr(e.response?.data?.message || 'Erro ao redefinir password')
    } finally {
      setRecoverLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data, data.token)
      navigate(destino(data.role))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

return (
    <div className="login-page" ref={pageRef}>
      <canvas ref={canvasRef} className="login-canvas" />
      <div className="login-overlay" />




      <div className="login-card">

        <div className="login-logo-wrap">
          <div>
            <div className="login-logo-text">Lab<em>System</em></div>
            <div className="login-logo-sub">Sistema de Análises Clínicas</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Email</label>
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

          <button
            type="button"
            className="login-recover-link"
            onClick={() => { setRecovering(r => !r); setRecoverMsg(''); setRecoverErr('') }}
          >
            Esqueceu a password?
          </button>
        </form>

        {recovering && (
          <div className="login-recover-panel">
            {recoverMsg ? (
              <p className="login-recover-ok">{recoverMsg}</p>
            ) : (
              <form onSubmit={handleRecover}>
                <p className="login-recover-info">
                  Confirme a sua identidade e defina uma nova password.
                </p>
                <div className="login-field">
                  <label className="login-label">Email</label>
                  <input className="login-input" type="email" placeholder="o-seu-email@hospital.pt"
                    value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Nome completo</label>
                  <input className="login-input" type="text" placeholder="Nome tal como registado"
                    value={recoverNome} onChange={e => setRecoverNome(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Nova password</label>
                  <input className="login-input" type="password" placeholder="mínimo 6 caracteres"
                    value={recoverPassword} onChange={e => setRecoverPassword(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Confirmar password</label>
                  <input className="login-input" type="password" placeholder="repetir password"
                    value={recoverConfirm} onChange={e => setRecoverConfirm(e.target.value)} required />
                </div>
                {recoverErr && <div className="login-error">{recoverErr}</div>}
                <button className="login-btn" type="submit" disabled={recoverLoading}>
                  {recoverLoading ? 'A redefinir...' : 'Redefinir password'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="login-demo">
          <div className="login-demo-label">Acesso rápido — demonstração</div>
          <div className="login-demo-grid">
            {DEMO_LOGINS.map(d => (
              <button
                key={d.label}
                type="button"
                className="login-demo-btn"
                onClick={() => { setEmail(d.email); setPassword(d.password); setError('') }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="login-footer">
          <button className="login-register-link" onClick={() => { setRegModal(true); setRegMsg(''); setRegErr('') }}>
            Criar conta
          </button>
        </div>
      </div>

      {/* Modal de registo */}
      {regModal && (
        <div className="login-modal-overlay" onClick={() => setRegModal(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <button className="login-modal-close" onClick={() => setRegModal(false)}>✕</button>
            <h2 className="login-modal-title">Criar conta</h2>
            <p className="login-modal-sub">A conta ficará pendente até o administrador aprovar.</p>

            {regMsg ? (
              <p className="login-recover-ok" style={{ textAlign: 'center', padding: '20px 0' }}>{regMsg}</p>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="login-field">
                  <label className="login-label">Nome completo</label>
                  <input className="login-input" type="text" placeholder="Nome Apelido"
                    value={regNome} onChange={e => setRegNome(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Email</label>
                  <input className="login-input" type="email" placeholder="nome@hospital.pt"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Perfil</label>
                  <select className="login-input" value={regRole} onChange={e => setRegRole(e.target.value)}>
                    <option value="medico">Médico</option>
                    <option value="tecnico">Técnico</option>
                    <option value="enfermeiro">Enfermeiro</option>
                    <option value="utente">Utente</option>
                  </select>
                </div>
                <div className="login-field">
                  <label className="login-label">Password</label>
                  <input className="login-input" type="password" placeholder="mínimo 6 caracteres"
                    value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                </div>
                <div className="login-field">
                  <label className="login-label">Confirmar password</label>
                  <input className="login-input" type="password" placeholder="repetir password"
                    value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required />
                </div>
                {regErr && <div className="login-error">{regErr}</div>}
                <button className="login-btn" type="submit" disabled={regLoading}>
                  {regLoading ? 'A criar...' : 'Submeter pedido'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
