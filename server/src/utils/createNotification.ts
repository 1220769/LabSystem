import Notification, { NotifTipo } from '../models/Notification'
import User from '../models/User'
import mongoose from 'mongoose'

export async function notifyUtenteByRef(
  utenteId: mongoose.Types.ObjectId | string,
  tipo: NotifTipo,
  titulo: string,
  mensagem: string,
  link?: string
) {
  try {
    const user = await User.findOne({ utenteRef: utenteId, ativo: true }).select('_id')
    if (!user) return
    await Notification.create({ user: user._id, tipo, titulo, mensagem, link })
  } catch { /* não bloquear o fluxo principal */ }
}

export async function notifyUser(
  userId: mongoose.Types.ObjectId | string,
  tipo: NotifTipo,
  titulo: string,
  mensagem: string,
  link?: string
) {
  try {
    await Notification.create({ user: userId, tipo, titulo, mensagem, link })
  } catch { /* não bloquear o fluxo principal */ }
}
