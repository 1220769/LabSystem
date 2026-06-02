import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  gerarWorklist, getResultados, getResultadoById,
  updateResultado, getStats, getCategorias,
} from '../controllers/resultadoController'

const router = Router()

router.use(protect)

router.get('/stats',      getStats)
router.get('/categorias', getCategorias)
router.get('/',           getResultados)
router.get('/:id',        getResultadoById)

router.post('/worklist/:amostraId',
  authorize('administrador','tecnico'),
  gerarWorklist
)

router.put('/:id',
  authorize('administrador','tecnico'),
  updateResultado
)

export default router
