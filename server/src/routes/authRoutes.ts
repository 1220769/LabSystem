import { Router } from 'express'
import { register, login, getMe } from '../controllers/authController'
import { protect, AuthRequest } from '../middleware/authMiddleware'
import { Response } from 'express'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', protect, (req, res) => getMe(req as AuthRequest, res as Response))

export default router