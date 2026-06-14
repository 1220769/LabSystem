import { Router } from 'express'
import { getMyNotifications, markRead, markAllRead } from '../controllers/notification.controller'
import { protect } from '../middleWare/authMiddleware'

const router = Router()
router.use(protect)

router.get('/',              getMyNotifications)
router.put('/read-all',      markAllRead)
router.put('/:id/read',      markRead)

export default router
