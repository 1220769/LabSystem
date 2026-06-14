import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { loginRateLimiter } from './middleWare/rateLimiter'
import { connectDB } from './config/db'
import authRoutes         from './routes/auth.route'
import utenteRoutes       from './routes/utente.route'
import userRoutes         from './routes/user.route'
import requisicaoRoutes   from './routes/requisicao.route'
import amostraRoutes      from './routes/amostra.route'
import resultadoRoutes    from './routes/resultado.route'
import faturaRoutes       from './routes/fatura.route'
import analyticsRoutes    from './routes/analytics.route'
import portalRoutes       from './routes/portal.route'
import notificationRoutes from './routes/notification.route'
import equipamentoRoutes  from './routes/equipamento.route'
import auditRoutes        from './routes/audit.route'

dotenv.config()
connectDB()

const app  = express()
const PORT = process.env.PORT || 4000

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(o => o.trim())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true)
    else cb(new Error(`CORS: origem não permitida — ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth/login', loginRateLimiter)

app.use('/api/auth',          authRoutes)
app.use('/api/utentes',       utenteRoutes)
app.use('/api/users',         userRoutes)
app.use('/api/requisicoes',   requisicaoRoutes)
app.use('/api/amostras',      amostraRoutes)
app.use('/api/resultados',    resultadoRoutes)
app.use('/api/faturas',       faturaRoutes)
app.use('/api/analytics',     analyticsRoutes)
app.use('/api/portal',        portalRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/equipamentos',  equipamentoRoutes)
app.use('/api/auditoria',     auditRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🧪 LabSystem API → http://localhost:${PORT}`)
})
