import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db'
import authRoutes       from './routes/authRoutes'
import utenteRoutes     from './routes/utenteRoutes'
import userRoutes       from './routes/userRoutes'
import requisicaoRoutes from './routes/requisicaoRoutes'
import amostraRoutes    from './routes/amostraRoutes'
import resultadoRoutes  from './routes/resultadoRoutes'

dotenv.config()
connectDB()

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

app.use('/api/auth',        authRoutes)
app.use('/api/utentes',     utenteRoutes)
app.use('/api/users',       userRoutes)
app.use('/api/requisicoes', requisicaoRoutes)
app.use('/api/amostras',    amostraRoutes)
app.use('/api/resultados',  resultadoRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🧪 LabSystem API → http://localhost:${PORT}`)
})
connectDB().catch(() => {
  console.log('MongoDB ainda não disponível — servidor continua à espera...')
})
