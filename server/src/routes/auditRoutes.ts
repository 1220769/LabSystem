import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import { getLogs, getSessoes, getAuditStats } from '../controllers/auditController'

const router = Router()
router.use(protect, authorize('administrador'))

router.get('/logs',   getLogs)
router.get('/sessoes', getSessoes)
router.get('/stats',  getAuditStats)

export default router
