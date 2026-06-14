import Notification, { NotifTipo } from '../models/notification.model'
import User from '../models/user.model'
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
  } catch (err) {
    console.error('[notify] notifyUtenteByRef falhou:', err)
  }
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
  } catch (err) {
    console.error('[notify] notifyUser falhou:', err)
  }
}
