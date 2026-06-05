import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User, { IUser, type UserRole } from '../models/User'
import bcrypt from 'bcryptjs'
import { registarEvento } from '../utils/registarEvento'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MS   = 15 * 60 * 1000 // 15 minutos

const generateToken = (id: string, tokenVersion: number) =>
  jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET as string, { expiresIn: '7d' })

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
      token: generateToken(user._id.toString(), user.tokenVersion ?? 0),
    })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao registar', error: err })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const rawEmail    = String(req.body?.email    ?? '').toLowerCase().trim()
    const rawPassword = String(req.body?.password ?? '')

    // validação básica de input
    if (!rawEmail || !rawPassword) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }
    if (rawEmail.length > 254 || rawPassword.length > 128) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const demoUser = await ensureDemoUser(rawEmail, rawPassword)
    const user     = demoUser ?? await User.findOne({ email: rawEmail })

    // conta inexistente — resposta idêntica para não revelar se email existe
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    // conta desactivada
    if (!user.ativo) {
      return res.status(403).json({ message: 'Conta desactivada. Contacte o administrador.' })
    }

    // conta bloqueada por tentativas excessivas
    if (user.isLocked()) {
      const restam = Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000)
      registarEvento({
        utilizador: rawEmail, acao: 'login_bloqueado',
        modulo: 'auth', detalhe: `Conta bloqueada — ${restam}min restantes`, ip: req.ip,
      })
      return res.status(423).json({
        message: `Conta temporariamente bloqueada. Tente novamente em ${restam} minuto${restam !== 1 ? 's' : ''}.`,
      })
    }

    const passwordCorreta = await user.matchPassword(rawPassword)

    if (!passwordCorreta) {
      // incrementar tentativas
      user.loginAttempts = (user.loginAttempts ?? 0) + 1
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil     = new Date(Date.now() + LOCK_DURATION_MS)
        user.loginAttempts = 0
        registarEvento({
          utilizador: user.nome, utilizadorId: user._id as any,
          acao: 'conta_bloqueada', modulo: 'auth',
          detalhe: `Bloqueada após ${MAX_LOGIN_ATTEMPTS} tentativas falhadas`, ip: req.ip,
        })
      } else {
        registarEvento({
          utilizador: rawEmail, acao: 'login_falhado', modulo: 'auth',
          detalhe: `Tentativa ${user.loginAttempts}/${MAX_LOGIN_ATTEMPTS}`, ip: req.ip,
        })
      }
      await user.save()
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    // login bem-sucedido — resetar contadores
    user.loginAttempts = 0
    user.lockUntil     = undefined
    user.ultimoLogin   = new Date()
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
      _id:   user._id,
      nome:  user.nome,
      email: user.email,
      role:  user.role,
      token: generateToken(user._id.toString(), user.tokenVersion),
    })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao autenticar', error: err })
  }
}

// POST /api/auth/logout — invalida o token actual via tokenVersion
export const logout = async (req: Request & { user?: IUser }, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.user!._id, { $inc: { tokenVersion: 1 } })
    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'logout',
      modulo:       'auth',
      ip:           req.ip,
    })
    res.json({ message: 'Sessão terminada' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao terminar sessão', error: err })
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

// POST /api/auth/register-request — cria conta inactiva, aguarda aprovação do admin
export const registerRequest = async (req: Request, res: Response) => {
  try {
    const { nome, email, password, role } = req.body
    if (!nome || !email || !password || !role) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' })
    }
    const rolesPermitidos = ['medico','tecnico','enfermeiro','financeiro','utente']
    if (!rolesPermitidos.includes(role)) {
      return res.status(400).json({ message: 'Role inválido' })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password deve ter pelo menos 6 caracteres' })
    }

    const UserModel = (await import('../models/User')).default
    const existe = await UserModel.findOne({ email: String(email).toLowerCase().trim() })
    if (existe) return res.status(400).json({ message: 'Email já registado' })

    const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10))
    const user   = await UserModel.create({
      nome, email: String(email).toLowerCase().trim(),
      password: hashed, role, ativo: false,
    })

    // notificar admins
    const admins = await UserModel.find({ role: 'administrador', ativo: true }).select('_id')
    const { notifyUser: notify } = await import('../utils/createNotification')
    for (const admin of admins) {
      notify(admin._id, 'resultado',
        'Nova conta pendente de aprovação',
        `${nome} (${role}) solicitou acesso ao sistema. Aprove em Utilizadores.`,
        'utilizadores'
      )
    }

    registarEvento({
      utilizador: nome, utilizadorId: user._id as any,
      acao: 'registo_pendente', modulo: 'auth',
      detalhe: `${role} — ${email}`, ip: req.ip,
    })

    res.status(201).json({ message: 'Conta criada. Aguarde aprovação do administrador.' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar conta', error: err })
  }
}

// POST /api/auth/recover-request — auto-serviço: email + nome + nova password
export const recoverRequest = async (req: Request, res: Response) => {
  try {
    const email       = String(req.body?.email       ?? '').toLowerCase().trim()
    const nome        = String(req.body?.nome        ?? '').trim()
    const passwordNova = String(req.body?.passwordNova ?? '').trim()

    if (!email || !nome || !passwordNova) {
      return res.status(400).json({ message: 'Email, nome e nova password são obrigatórios' })
    }
    if (passwordNova.length < 6) {
      return res.status(400).json({ message: 'A nova password deve ter pelo menos 6 caracteres' })
    }

    const UserModel = (await import('../models/User')).default
    // verificar email + nome em conjunto (case-insensitive no nome)
    const user = await UserModel.findOne({
      email,
      ativo: true,
      nome: { $regex: `^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })

    // resposta sempre igual — não revelar se combinação existe
    const okMsg = { message: 'Password redefinida com sucesso. Pode fazer login.' }
    if (!user) return res.json(okMsg)

    user.password      = await bcrypt.hash(passwordNova, await bcrypt.genSalt(10))
    user.loginAttempts = 0
    user.lockUntil     = undefined
    user.tokenVersion  = (user.tokenVersion ?? 0) + 1
    await user.save()

    registarEvento({
      utilizador: user.nome, utilizadorId: user._id as any,
      acao: 'recuperacao_password_propria', modulo: 'auth', ip: req.ip,
    })

    res.json(okMsg)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao redefinir password', error: err })
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
