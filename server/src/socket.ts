import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

let io: SocketServer | null = null

export function initSocket(httpServer: HttpServer) {
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',').map(o => o.trim())

  io = new SocketServer(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  })

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('sem token'))
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string }
      socket.data.userId = payload.id
      next()
    } catch {
      next(new Error('token inválido'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string
    // cada utilizador entra na sua própria sala
    socket.join(`user:${userId}`)
    socket.on('disconnect', () => {})
  })

  return io
}

export function emitToUser(
  userId: mongoose.Types.ObjectId | string,
  event: string,
  payload: unknown
) {
  io?.to(`user:${userId.toString()}`).emit(event, payload)
}
