import { Response } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import { AuthRequest } from '../middleware/authMiddleware'
import { PERMISSIONS } from '../models/User'

// GET /api/users — só admin
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, ativo, search, page = 1, limit = 20 } = req.query
    const filter: any = {}
    if (role)   filter.role  = role
    if (ativo !== undefined) filter.ativo = ativo === 'true'
    if (search) filter.$or = [
      { nome:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)
    res.json({ data: users, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter utilizadores', error: err })
  }
}

// GET /api/users/:id
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter utilizador', error: err })
  }
}

// POST /api/users — só admin
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { nome, email, password, role, telefone, departamento } = req.body
    const existe = await User.findOne({ email })
    if (existe) return res.status(400).json({ message: 'Email já registado' })
    const salt           = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const user = await User.create({
      nome, email, password: hashedPassword,
      role, telefone, departamento,
    })
    const { password: _, ...userWithoutPassword } = user.toObject()
    res.status(201).json(userWithoutPassword)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar utilizador', error: err })
  }
}

// PUT /api/users/:id
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...rest } = req.body
    const updateData: any = { ...rest }
    if (password) {
      const salt = await bcrypt.genSalt(10)
      updateData.password = await bcrypt.hash(password, salt)
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password')
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar utilizador', error: err })
  }
}

// DELETE /api/users/:id — soft delete, só admin
export const deactivateUser = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Não podes desactivar a tua própria conta' })
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    ).select('-password')
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado' })
    res.json({ message: 'Utilizador desactivado', user })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao desactivar utilizador', error: err })
  }
}

// GET /api/users/permissions — devolve mapa de permissões do utilizador actual
export const getMyPermissions = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Não autenticado' })
  res.json({
    role: req.user.role,
    permissions: PERMISSIONS[req.user.role],
  })
}