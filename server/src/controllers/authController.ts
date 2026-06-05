import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User, { IUser, type UserRole } from '../models/User'
import bcrypt from 'bcryptjs'
import { registarEvento } from '../utils/registarEvento'

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: '7d' })

const DEMO_USERS: Record<string, { nome: string; password: string; role: UserRole }> = {
  'medico@lab.pt':           { nome: 'João Costa',      password: 'medico123',      role: 'medico'         },
  'tecnico@lab.pt':          { nome: 'Carlos Oliveira', password: 'tecnico123',     role: 'tecnico'        },
  'enfermeiro@lab.pt':       { nome: 'Sara Rodrigues',  password: 'enfermeiro123',  role: 'enfermeiro'     },
  'financeiro@lab.pt':       { nome: 'Pedro Almeida',   password: 'financeiro123',  role: 'financeiro'     },
  'utente@lab.pt':           { nome: 'Ana Silva',        password: 'utente123',      role: 'utente'         },
  'admin2@lab.pt':           { nome: 'Miguel Santos',   password: 'admin123',       role: 'administrador'  },
  'medico@labsystem.pt':     { nome: 'João Costa',      password: 'medico123',      role: 'medico'         },
  'tecnico@labsystem.pt':    { nome: 'Carlos Oliveira', password: 'tecnico123',     role: 'tecnico'        },
  'enfermeiro@labsystem.pt': { nome: 'Sara Rodrigues',  password: 'enfermeiro123',  role: 'enfermeiro'     },
  'financeiro@labsystem.pt': { nome: 'Pedro Almeida',   password: 'financeiro123',  role: 'financeiro'     },
  'utente@labsystem.pt':     { nome: 'Ana Silva',        password: 'utente123',      role: 'utente'         },
  'admin@labsystem.pt':      { nome: 'Miguel Santos',   password: 'admin123',       role: 'administrador'  },
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
    registarEvento({
      utilizador:   user.nome,
      utilizadorId: user._id as any,
      acao:         'login',
      modulo:       'auth',
      detalhe:      `Login com role ${user.role}`,
      ip:           req.ip,
    })
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

// PUT /api/auth/change-password — utilizador altera a própria password
export const changePassword = async (req: Request & { user?: IUser }, res: Response) => {
  try {
    const { passwordAtual, passwordNova } = req.body
    if (!passwordAtual || !passwordNova) {
      return res.status(400).json({ message: 'Password actual e nova são obrigatórias' })
    }
    if (passwordNova.length < 6) {
      return res.status(400).json({ message: 'A nova password deve ter pelo menos 6 caracteres' })
    }
    const user = await (await import('../models/User')).default.findById(req.user!._id)
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado' })
    if (!(await user.matchPassword(passwordAtual))) {
      return res.status(401).json({ message: 'Password actual incorrecta' })
    }
    user.password = await bcrypt.hash(passwordNova, await bcrypt.genSalt(10))
    await user.save()
    registarEvento({
      utilizador:   user.nome,
      utilizadorId: user._id as any,
      acao:         'alterar_password',
      modulo:       'auth',
    })
    res.json({ message: 'Password alterada com sucesso' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao alterar password', error: err })
  }
}

// POST /api/auth/reset-password/:userId — admin reseta password de outro utilizador
export const resetPassword = async (req: Request & { user?: IUser }, res: Response) => {
  try {
    const { passwordNova } = req.body
    if (!passwordNova || passwordNova.length < 6) {
      return res.status(400).json({ message: 'Password deve ter pelo menos 6 caracteres' })
    }
    const UserModel = (await import('../models/User')).default
    const target = await UserModel.findById(req.params.userId)
    if (!target) return res.status(404).json({ message: 'Utilizador não encontrado' })

    target.password = await bcrypt.hash(passwordNova, await bcrypt.genSalt(10))
    await target.save()
    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'reset_password',
      modulo:       'utilizadores',
      detalhe:      `Reset para ${target.nome} (${target.email})`,
    })
    res.json({ message: `Password de ${target.nome} reposta com sucesso` })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao repor password', error: err })
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
