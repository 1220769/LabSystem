import AuditLog from '../models/auditLog.model'
import mongoose from 'mongoose'

export async function registarEvento(opts: {
  utilizador: string
  utilizadorId?: mongoose.Types.ObjectId | string
  acao: string
  modulo: string
  detalhe?: string
  ip?: string
}) {
  try {
    await AuditLog.create(opts)
  } catch {
    // nunca bloquear o fluxo principal por falha de auditoria
  }
}
