import { Router } from 'express'
import { getMyNotifications, markRead, markAllRead } from '../controllers/notificationController'
import { protect } from '../middleware/authMiddleware'

const router = Router()
router.use(protect)

router.get('/',              getMyNotifications)
router.put('/read-all',      markAllRead)
router.put('/:id/read',      markRead)

export default router
