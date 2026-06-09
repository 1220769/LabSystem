import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  getFaturas,
  getFaturaById,
  createFatura,
  updateFatura,
  getStats,
  getRequisicoesSemFatura,
} from '../controllers/faturaController'

const router = Router()

router.use(protect)

router.get('/',                  getFaturas)
router.get('/stats',             getStats)
router.get('/requisicoes-livres', getRequisicoesSemFatura)
router.get('/:id',               getFaturaById)
router.post('/',                 authorize('administrador'), createFatura)
router.patch('/:id',             authorize('administrador'), updateFatura)

export default router
