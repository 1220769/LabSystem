import { Request, Response } from 'express'
import AuditLog from '../models/auditLog.model'
import User from '../models/user.model'

export const getLogs = async (req: Request, res: Response) => {
  try {
    const page  = parseInt(req.query.page as string)  || 1
    const limit = parseInt(req.query.limit as string) || 50
    const filter: Record<string, unknown> = {}
    if (req.query.modulo)     filter.modulo     = req.query.modulo
    if (req.query.utilizador) filter.utilizador = new RegExp(req.query.utilizador as string, 'i')
    const [data, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter),
    ])
    res.json({ data, total, page, pages: Math.ceil(total / limit) })
  } catch { res.status(500).json({ message: 'Erro' }) }
}

export const getSessoes = async (_req: Request, res: Response) => {
  try {
    const users = await User.find({ ativo: true }).select('nome email role ultimoLogin').sort({ ultimoLogin: -1 }).limit(30)
    res.json({ data: users })
  } catch { res.status(500).json({ message: 'Erro' }) }
}

export const getAuditStats = async (_req: Request, res: Response) => {
  try {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const [total, hoje_count, users] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: hoje } }),
      User.countDocuments({ ativo: true }),
    ])
    res.json({ totalEventos: total, eventosHoje: hoje_count, sessoesAtivas: users })
  } catch { res.status(500).json({ message: 'Erro' }) }
}

/* helper para registar eventos — importar nos outros controllers */
export const registarEvento = async (
  utilizador: string,
  acao: string,
  modulo: string,
  detalhe?: string,
  ip?: string,
  utilizadorId?: string,
) => {
  try {
    await AuditLog.create({ utilizador, acao, modulo, detalhe, ip, utilizadorId })
  } catch { /* silencioso — auditoria não deve quebrar fluxo principal */ }
}
