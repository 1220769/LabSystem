import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import authRoutes from '../routes/authRoutes'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('POST /api/auth/login', () => {
  it('rejeita credenciais inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'naoexiste@lab.pt', password: 'errada' })
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('message')
  })

  it('aceita credenciais demo válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'medico@lab.pt', password: 'medico123' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('role', 'medico')
    expect(res.body).toHaveProperty('nome', 'João Costa')
  })

  it('rejeita body vazio', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
    expect(res.status).toBe(401)
  })

  it('retorna token JWT válido com campos esperados', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin2@lab.pt', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^eyJ/)
    expect(res.body.role).toBe('administrador')
  })
})
