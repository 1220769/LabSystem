import { Router, text } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import {
  getFaturas,
  getFaturaById,
  createFatura,
  updateFatura,
  getStats,
  getRequisicoesSemFatura,
  exportFaturasXml,
  importFaturasXml,
} from '../controllers/fatura.controller'

const router = Router()

router.use(protect)

router.get('/',                  getFaturas)
router.get('/stats',             getStats)
router.get('/requisicoes-livres', getRequisicoesSemFatura)
router.get('/export/xml',        exportFaturasXml)
router.post('/import/xml',       authorize('administrador'),
                                 text({ type: ['application/xml', 'text/xml', 'text/plain'], limit: '5mb' }),
                                 importFaturasXml)
router.get('/:id',               getFaturaById)
router.post('/',                 authorize('administrador'), createFatura)
router.patch('/:id',             authorize('administrador'), updateFatura)

export default router
