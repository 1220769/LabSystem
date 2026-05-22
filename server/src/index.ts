import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db'
import authRoutes   from './routes/authRoutes'
import utenteRoutes from './routes/utenteRoutes'
import userRoutes   from './routes/userRoutes'

dotenv.config()
connectDB()

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

app.use('/api/auth',    authRoutes)
app.use('/api/utentes', utenteRoutes)
app.use('/api/users',   userRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🧪 LabSystem API → http://localhost:${PORT}`)
})