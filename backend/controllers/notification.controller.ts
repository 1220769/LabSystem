import { Response } from 'express'
import Notification from '../models/notification.model'
import { AuthRequest } from '../middleWare/authMiddleware'

// GET /api/notifications — lista as notificações do utilizador autenticado
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    const notifications = await Notification.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(limit)
    const unread = await Notification.countDocuments({ user: req.user!._id, lida: false })
    res.json({ data: notifications, unread })
  } catch {
    res.status(500).json({ message: 'Erro ao obter notificações' })
  }
}

// PUT /api/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { lida: true }
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ message: 'Erro ao marcar notificação' })
  }
}

// PUT /api/notifications/read-all
export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany({ user: req.user!._id, lida: false }, { lida: true })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ message: 'Erro ao marcar notificações' })
  }
}
