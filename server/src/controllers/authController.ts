import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User, { IUser } from '../models/User'
import bcrypt from 'bcryptjs'

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: '7d' })

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
    const user = await User.findOne({ email })
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }
    if (String(user.role) === 'financeiro') {
      return res.status(403).json({ message: 'O financeiro e gerido pelo administrador' })
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
