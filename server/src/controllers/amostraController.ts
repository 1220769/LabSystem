import { Response } from 'express'
import Amostra from '../models/Amostra'
import { AuthRequest } from '../middleware/authMiddleware'

export const getAmostras = async (req: AuthRequest, res: Response) => {
  try {
    const { estado, tipoColheita, search, page = 1, limit = 20 } = req.query
    const filter: any = {}

    if (estado && estado !== 'todas')           filter.estado = estado
    if (tipoColheita && tipoColheita !== 'todas') filter.tipoColheita = tipoColheita
    if (search) {
      filter.$or = [
        { codigoAmostra:    { $regex: search, $options: 'i' } },
        { utenteNome:       { $regex: search, $options: 'i' } },
        { requisicaoNumero: { $regex: search, $options: 'i' } },
      ]
    }

    const total    = await Amostra.countDocuments(filter)
    const amostras = await Amostra.find(filter)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: amostras, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter amostras', error: err })
  }
}

export const getAmostraById = async (req: AuthRequest, res: Response) => {
  try {
    const amostra = await Amostra.findById(req.params.id)
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })
    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter amostra', error: err })
  }
}

export const createAmostra = async (req: AuthRequest, res: Response) => {
  try {
    const year  = new Date().getFullYear()
    const count = await Amostra.countDocuments({ codigoAmostra: { $regex: `^AM-${year}` } })
    const codigoAmostra = `AM-${year}-${String(count + 1).padStart(4, '0')}`

    const amostra = await Amostra.create({
      ...req.body,
      codigoAmostra,
      createdBy: req.user!._id,
    })

    res.status(201).json(amostra)
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao criar amostra', error: err })
  }
}

export const updateAmostra = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['estado', 'tubos', 'tecnico', 'temperatura', 'dataHoraColheita', 'motivoRejeicao', 'observacoes']
    const update  = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    )

    const amostra = await Amostra.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })
    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar amostra', error: err })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [aguarda, colhida, em_transito, recebida, domiciliarias] = await Promise.all([
      Amostra.countDocuments({ estado: 'aguarda_colheita' }),
      Amostra.countDocuments({ estado: 'colhida' }),
      Amostra.countDocuments({ estado: 'em_transito' }),
      Amostra.countDocuments({ estado: 'recebida' }),
      Amostra.countDocuments({ tipoColheita: 'domiciliaria', estado: { $in: ['aguarda_colheita','colhida','em_transito'] } }),
    ])
    res.json({ aguarda, colhida, em_transito, recebida, domiciliarias })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: err })
  }
}
