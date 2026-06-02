import { Response } from 'express'
import { AuthRequest } from '../middleware/authMiddleware'
import Utente     from '../models/Utente'
import Requisicao from '../models/Requisicao'
import Resultado  from '../models/Resultado'
import Fatura     from '../models/Fatura'

function utenteId(req: AuthRequest) {
  return req.user?.utenteRef
}

export async function getPerfil(req: AuthRequest, res: Response) {
  try {
    const id = utenteId(req)
    if (!id) return res.status(404).json({ message: 'Sem registo de utente associado a esta conta' })
    const utente = await Utente.findById(id)
    if (!utente) return res.status(404).json({ message: 'Utente não encontrado' })
    res.json(utente)
  } catch {
    res.status(500).json({ message: 'Erro ao obter perfil' })
  }
}

export async function getRequisicoes(req: AuthRequest, res: Response) {
  try {
    const id = utenteId(req)
    if (!id) return res.json({ data: [], total: 0 })
    const page  = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = 10
    const total = await Requisicao.countDocuments({ utente: id })
    const data  = await Requisicao.find({ utente: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
    res.json({ data, total, page, pages: Math.ceil(total / limit) })
  } catch {
    res.status(500).json({ message: 'Erro ao obter requisições' })
  }
}

export async function getResultados(req: AuthRequest, res: Response) {
  try {
    const id = utenteId(req)
    if (!id) return res.json({ data: [], total: 0 })
    const page  = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = 20
    const filter = { utente: id, estado: 'validado_medico' as const }
    const total  = await Resultado.countDocuments(filter)
    const data   = await Resultado.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
    res.json({ data, total, page, pages: Math.ceil(total / limit) })
  } catch {
    res.status(500).json({ message: 'Erro ao obter resultados' })
  }
}

export async function getFaturas(req: AuthRequest, res: Response) {
  try {
    const id = utenteId(req)
    if (!id) return res.json({ data: [], total: 0 })
    const total = await Fatura.countDocuments({ utente: id, estado: { $ne: 'anulada' } })
    const data  = await Fatura.find({ utente: id, estado: { $ne: 'anulada' } })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ data, total })
  } catch {
    res.status(500).json({ message: 'Erro ao obter faturas' })
  }
}

export async function getSummary(req: AuthRequest, res: Response) {
  try {
    const id = utenteId(req)
    if (!id) return res.json({ requisicoes: 0, resultados: 0, faturasPendentes: 0, criticos: 0 })
    const [requisicoes, resultados, faturasPendentes, criticos] = await Promise.all([
      Requisicao.countDocuments({ utente: id }),
      Resultado.countDocuments({ utente: id, estado: 'validado_medico' }),
      Fatura.countDocuments({ utente: id, estado: 'emitida' }),
      Resultado.countDocuments({ utente: id, flag: { $in: ['critico_alto','critico_baixo'] }, estado: 'validado_medico' }),
    ])
    res.json({ requisicoes, resultados, faturasPendentes, criticos })
  } catch {
    res.status(500).json({ message: 'Erro ao obter resumo' })
  }
}
