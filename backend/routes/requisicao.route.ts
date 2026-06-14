import { Router, text } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import {
  getRequisicoes, getRequisicaoById, createRequisicao,
  updateRequisicao, cancelRequisicao, getStats,
  exportRequisicoesXml, importRequisicoesXml,
} from '../controllers/requisicao.controller'

const router = Router()

router.use(protect)

router.get('/stats',      getStats)
router.get('/export/xml', exportRequisicoesXml)
router.post('/import/xml', authorize('administrador', 'tecnico'),
                           text({ type: ['application/xml', 'text/xml', 'text/plain'], limit: '5mb' }),
                           importRequisicoesXml)
router.get('/',      getRequisicoes)
router.get('/:id',   getRequisicaoById)

router.post('/',   authorize('administrador','tecnico','medico','enfermeiro','utente'), createRequisicao)
router.put('/:id', authorize('administrador','tecnico','medico'),              updateRequisicao)
router.delete('/:id', authorize('administrador','medico'),                    cancelRequisicao)

export default router
