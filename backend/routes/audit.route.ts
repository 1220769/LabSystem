import { Router } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import { getLogs, getSessoes, getAuditStats } from '../controllers/audit.controller'

const router = Router()
router.use(protect, authorize('administrador'))

router.get('/logs',   getLogs)
router.get('/sessoes', getSessoes)
router.get('/stats',  getAuditStats)

export default router
