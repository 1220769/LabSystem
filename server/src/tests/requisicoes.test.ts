import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import authRoutes from '../routes/authRoutes'
import requisicaoRoutes from '../routes/requisicaoRoutes'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/requisicoes', requisicaoRoutes)

async function getToken(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  return res.body.token as string
}

describe('GET /api/requisicoes', () => {
  it('rejeita pedido sem token', async () => {
    const res = await request(app).get('/api/requisicoes')
    expect(res.status).toBe(401)
  })

  it('permite acesso com token válido', async () => {
    const token = await getToken('medico@lab.pt', 'medico123')
    const res = await request(app)
      .get('/api/requisicoes')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('resposta tem paginação', async () => {
    const token = await getToken('tecnico@lab.pt', 'tecnico123')
    const res = await request(app)
      .get('/api/requisicoes?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('pages')
  })
})

describe('POST /api/requisicoes', () => {
  it('rejeita criação sem token', async () => {
    const res = await request(app)
      .post('/api/requisicoes')
      .send({ utente: 'abc', analises: [] })
    expect(res.status).toBe(401)
  })

  it('utente pode criar requisição (pedido próprio)', async () => {
    const token = await getToken('utente@lab.pt', 'utente123')
    const res = await request(app)
      .post('/api/requisicoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ utente: 'abc', analises: [] })
    // utente está autorizado — falha por dados inválidos (400/500), não por 403
    expect(res.status).not.toBe(403)
  })
})
