import { Router } from 'express'
import { getMe, login, register } from '../controllers/login.controller'
import { verifyToken } from '../auth/verifyToken'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', verifyToken, getMe)

export default router
