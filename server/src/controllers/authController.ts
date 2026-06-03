import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User, { IUser, type UserRole } from '../models/User'
import bcrypt from 'bcryptjs'

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: '7d' })

const DEMO_USERS: Record<string, { nome: string; password: string; role: UserRole }> = {
  'medico@labsystem.pt':     { nome: 'Dr. Joao Costa', password: 'medico123', role: 'medico' },
  'tecnico@labsystem.pt':    { nome: 'Tecnico Laboratorio', password: 'tecnico123', role: 'tecnico' },
  'enfermeiro@labsystem.pt': { nome: 'Enfermeiro Principal', password: 'enfermeiro123', role: 'enfermeiro' },
  'financeiro@labsystem.pt': { nome: 'Financeiro Principal', password: 'financeiro123', role: 'financeiro' },
  'utente@labsystem.pt':     { nome: 'Utente Demo', password: 'utente123', role: 'utente' },
  'admin@labsystem.pt':      { nome: 'Administrador', password: 'admin123', role: 'administrador' },
}

async function ensureDemoUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim()
  const demo = DEMO_USERS[normalizedEmail]
  if (!demo || password !== demo.password) return null

  const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10))
  return User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        nome: demo.nome,
        email: normalizedEmail,
        password: hashedPassword,
        role: demo.role,
        ativo: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
}

export const register = async (req: Request, res: Response) => {
  try {
    const { nome, email, password, role } = req.body
    const existe = await User.findOne({ email })
    if (existe) return res.status(400).json({ message: 'Email já registado' })

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await User.create({ nome, email, password: hashedPassword, role })
    res.status(201).json({
      _id: user._id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      token: generateToken(user._id.toString()),
    })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao registar', error: err })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = String(email ?? '').toLowerCase().trim()
    const normalizedPassword = String(password ?? '')
    const demoUser = await ensureDemoUser(normalizedEmail, normalizedPassword)
    const user = demoUser ?? await User.findOne({ email: normalizedEmail })
    if (!user || !(await user.matchPassword(normalizedPassword))) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    if (!user.ativo) {
      return res.status(403).json({ message: 'Conta desactivada' })
    }
    user.ultimoLogin = new Date()
    await user.save()
    res.json({
      _id: user._id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      token: generateToken(user._id.toString()),
    })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao autenticar', error: err })
  }
}

export const getMe = async (req: Request & { user?: IUser }, res: Response) => {
  const user = req.user
  if (!user) return res.status(401).json({ message: 'Não autenticado' })
  res.json({
    _id: user._id,
    nome: user.nome,
    email: user.email,
    role: user.role,
  })
}
