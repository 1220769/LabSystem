import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import authRoutes from '../routes/authRoutes'
import resultadoRoutes from '../routes/resultadoRoutes'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/resultados', resultadoRoutes)

async function getToken(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  return res.body.token as string
}

describe('GET /api/resultados', () => {
  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/resultados')
    expect(res.status).toBe(401)
  })

  it('permite técnico aceder', async () => {
    const token = await getToken('tecnico@lab.pt', 'tecnico123')
    const res = await request(app)
      .get('/api/resultados')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
  })

  it('GET /stats devolve contadores', async () => {
    const token = await getToken('tecnico@lab.pt', 'tecnico123')
    const res = await request(app)
      .get('/api/resultados/stats')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('pendente')
    expect(res.body).toHaveProperty('criticosPorValidar')
  })
})

describe('Validação de resultados — controlo de roles', () => {
  it('utente não pode validar tecnicamente (403 antes de chegar ao recurso)', async () => {
    const token = await getToken('utente@lab.pt', 'utente123')
    const res = await request(app)
      .post('/api/resultados/507f1f77bcf86cd799439011/validar-tecnico')
      .set('Authorization', `Bearer ${token}`)
      .send({ observacoes: 'ok' })
    expect(res.status).toBe(403)
  })

  it('médico não pode validar tecnicamente — só o técnico pode', async () => {
    const token = await getToken('medico@lab.pt', 'medico123')
    const res = await request(app)
      .post('/api/resultados/507f1f77bcf86cd799439011/validar-tecnico')
      .set('Authorization', `Bearer ${token}`)
      .send({ observacoes: 'ok' })
    expect(res.status).toBe(403)
  })
})
