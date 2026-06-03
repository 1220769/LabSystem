import { Response } from 'express'
import Requisicao from '../models/Requisicao'
import { AuthRequest } from '../middleware/authMiddleware'

export const getRequisicoes = async (req: AuthRequest, res: Response) => {
  try {
    const { estado, search, urgente, medicoId, page = 1, limit = 20 } = req.query
    const filter: any = {}

    if (estado && estado !== 'todas') filter.estado = estado
    if (urgente === 'true')           filter.urgente = true
    // medicoId=mine → requisições criadas pelo médico autenticado
    if (medicoId === 'mine') filter.createdBy = req.user!._id
    else if (medicoId)       filter.createdBy = medicoId
    if (search) {
      filter.$or = [
        { numeroRequisicao:  { $regex: search, $options: 'i' } },
        { utenteNome:        { $regex: search, $options: 'i' } },
        { medicoSolicitante: { $regex: search, $options: 'i' } },
      ]
    }

    const total       = await Requisicao.countDocuments(filter)
    const requisicoes = await Requisicao.find(filter)
      .sort({ urgente: -1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: requisicoes, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter requisições', error: err })
  }
}

export const getRequisicaoById = async (req: AuthRequest, res: Response) => {
  try {
    const r = await Requisicao.findById(req.params.id)
    if (!r) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json(r)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter requisição', error: err })
  }
}

export const createRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const year  = new Date().getFullYear()
    const count = await Requisicao.countDocuments({ numeroRequisicao: { $regex: `^REQ-${year}` } })
    const numeroRequisicao = `REQ-${year}-${String(count + 1).padStart(4, '0')}`

    const requisicao = await Requisicao.create({
      ...req.body,
      numeroRequisicao,
      createdBy: req.user!._id,
    })
    res.status(201).json(requisicao)
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao criar requisição', error: err })
  }
}

export const updateRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['urgente','prioridade','estado','observacoes','medicoSolicitante','analises','prescricaoRef']
    const update  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

    const requisicao = await Requisicao.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json(requisicao)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar requisição', error: err })
  }
}

export const cancelRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const requisicao = await Requisicao.findByIdAndUpdate(req.params.id, { estado: 'cancelada' }, { new: true })
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json({ message: 'Requisição cancelada', requisicao })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cancelar requisição', error: err })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [pendente, em_curso, concluida, cancelada, urgentes] = await Promise.all([
      Requisicao.countDocuments({ estado: 'pendente' }),
      Requisicao.countDocuments({ estado: 'em_curso' }),
      Requisicao.countDocuments({ estado: 'concluida' }),
      Requisicao.countDocuments({ estado: 'cancelada' }),
      Requisicao.countDocuments({ estado: { $ne: 'cancelada' }, urgente: true }),
    ])
    res.json({ pendente, em_curso, concluida, cancelada, urgentes })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: err })
  }
}
