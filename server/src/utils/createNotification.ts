import Notification, { NotifTipo } from '../models/Notification'
import User from '../models/User'
import mongoose from 'mongoose'
import { emitToUser } from '../socket'

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
    const notif = await Notification.create({ user: user._id, tipo, titulo, mensagem, link })
    emitToUser(user._id, 'notification', notif.toJSON())
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
    const notif = await Notification.create({ user: userId, tipo, titulo, mensagem, link })
    emitToUser(userId, 'notification', notif.toJSON())
  } catch (err) {
    console.error('[notify] notifyUser falhou:', err)
  }
}
