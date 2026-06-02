import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db'
import loginRoutes    from './routes/login.route'
import utenteRoutes   from './routes/utente.route'
import adminRoutes    from './routes/admin.route'
import medicoRoutes   from './routes/medico.route'
import anamneseRoutes from './routes/anamenese.route'

dotenv.config()
connectDB()

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

app.use('/api/auth',      loginRoutes)
app.use('/api/utentes',   utenteRoutes)
app.use('/api/users',     adminRoutes)
app.use('/api/medicos',   medicoRoutes)
app.use('/api/anamneses', anamneseRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🧪 LabSystem API → http://localhost:${PORT}`)
})
