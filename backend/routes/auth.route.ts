import { Router } from 'express'
import { register, login, logout, getMe, changePassword, resetPassword, recoverRequest, registerRequest } from '../controllers/auth.controller'
import { protect, authorize, AuthRequest } from '../middleWare/authMiddleware'
import { Response } from 'express'

const router = Router()

router.post('/register', register)
router.post('/login',    login)
router.get ('/me',       protect, (req, res) => getMe(req as AuthRequest, res as Response))

router.post('/recover-request',  recoverRequest)
router.post('/register-request', registerRequest)

router.post('/logout',
  protect,
  (req, res) => logout(req as AuthRequest, res as Response)
)

router.put('/change-password',
  protect,
  (req, res) => changePassword(req as AuthRequest, res as Response)
)

router.post('/reset-password/:userId',
  protect,
  authorize('administrador'),
  (req, res) => resetPassword(req as AuthRequest, res as Response)
)

export default router
