import { Router } from 'express'
import { protect } from '../middleware/authMiddleware'
import { getDashboard } from '../controllers/analyticsController'

const router = Router()
router.use(protect)
router.get('/dashboard', getDashboard)

export default router
