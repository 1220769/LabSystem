import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/user.model'
import type { IUser, Module, Action } from '../models/user.model'

interface JwtPayload { id: string; tokenVersion?: number }

export interface AuthRequest extends Request {
  user?: IUser
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Não autorizado — token em falta' })
  }
  try {
    const token   = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
    const user    = await User.findById(decoded.id).select('-password')
    if (!user || !user.ativo) {
      return res.status(401).json({ message: 'Utilizador inactivo ou inexistente' })
    }
    // verificar que o token não foi invalidado por logout
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Sessão expirada — faça login novamente' })
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}

export const authorize = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Sem permissão para este recurso' })
    }
    next()
  }

export const checkPermission = (module: Module, action: Action) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' })
    }
    if (!req.user.hasPermission(module, action)) {
      return res.status(403).json({
        message: `Sem permissão: ${action} em ${module}`
      })
    }
    next()
  }