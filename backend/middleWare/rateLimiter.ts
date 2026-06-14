import type { Request, Response, NextFunction } from 'express'

const WINDOW_MS    = 15 * 60 * 1000
const MAX_REQUESTS = 10

interface Entry { count: number; resetAt: number }
const store = new Map<string, Entry>()

export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') { next(); return }

  const ip  = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    next()
    return
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ message: 'Demasiadas tentativas. Tente novamente em 15 minutos.' })
    return
  }

  next()
}
