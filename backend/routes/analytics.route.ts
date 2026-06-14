import { Router } from 'express'
import { protect } from '../middleWare/authMiddleware'
import { getDashboard } from '../controllers/analytics.controller'

const router = Router()
router.use(protect)
router.get('/dashboard', getDashboard)

export default router
