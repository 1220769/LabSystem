import { Response } from 'express'
import Utente from '../models/Utente'
import { AuthRequest } from '../middleware/authMiddleware'

// GET /api/utentes
export const getUtentes = async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query
    const filter: any = { ativo: true }
    if (search) {
      filter.$or = [
        { nome:           { $regex: search, $options: 'i' } },
        { numeroProcesso: { $regex: search, $options: 'i' } },
        { nif:            { $regex: search, $options: 'i' } },
        { sns:            { $regex: search, $options: 'i' } },
      ]
    }
    const total   = await Utente.countDocuments(filter)
    const utentes = await Utente.find(filter)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: utentes, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter utentes', error: err })
  }
}

// GET /api/utentes/:id
export const getUtenteById = async (req: AuthRequest, res: Response) => {
  try {
    const utente = await Utente.findById(req.params.id)
    if (!utente) return res.status(404).json({ message: 'Utente não encontrado' })
    res.json(utente)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter utente', error: err })
  }
}

// POST /api/utentes
export const createUtente = async (req: AuthRequest, res: Response) => {
  try {
    const utente = await Utente.create(req.body)
    res.status(201).json(utente)
  } catch (err: any) {
    if (err.code === 11000) {
      const campo = Object.keys(err.keyPattern)[0]
      return res.status(400).json({ message: `${campo} já existe` })
    }
    res.status(500).json({ message: 'Erro ao criar utente', error: err })
  }
}

// PUT /api/utentes/:id
export const updateUtente = async (req: AuthRequest, res: Response) => {
  try {
    const utente = await Utente.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    if (!utente) return res.status(404).json({ message: 'Utente não encontrado' })
    res.json(utente)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar utente', error: err })
  }
}

// DELETE /api/utentes/:id (soft delete)
export const deleteUtente = async (req: AuthRequest, res: Response) => {
  try {
    const utente = await Utente.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    )
    if (!utente) return res.status(404).json({ message: 'Utente não encontrado' })
    res.json({ message: 'Utente desactivado com sucesso' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao desactivar utente', error: err })
  }
}