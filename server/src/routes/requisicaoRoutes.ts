import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  getRequisicoes, getRequisicaoById, createRequisicao,
  updateRequisicao, cancelRequisicao, getStats,
} from '../controllers/requisicaoController'

const router = Router()

router.use(protect)

router.get('/stats', getStats)
router.get('/',      getRequisicoes)
router.get('/:id',   getRequisicaoById)

router.post('/',   authorize('administrador','tecnico','medico','enfermeiro'), createRequisicao)
router.put('/:id', authorize('administrador','tecnico','medico'),              updateRequisicao)
router.delete('/:id', authorize('administrador','medico'),                    cancelRequisicao)

export default router
