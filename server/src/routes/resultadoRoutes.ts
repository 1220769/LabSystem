import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  gerarWorklist, getResultados, getResultadoById,
  updateResultado, getStats, getCategorias,
  validarTecnico, validarMedico, validarRequisicaoMedico,
  emitirRelatorio, rejeitarResultado,
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

router.post('/:id/validar-tecnico',
  authorize('administrador','tecnico'),
  validarTecnico
)

router.post('/:id/validar-medico',
  authorize('administrador','medico'),
  validarMedico
)

// deve vir antes de /:id para não ser capturado como ObjectId
router.post('/requisicao/:reqNumero/validar-medico',
  authorize('administrador','medico'),
  validarRequisicaoMedico
)

router.post('/:id/emitir-relatorio',
  authorize('administrador','medico','tecnico'),
  emitirRelatorio
)

router.post('/:id/rejeitar',
  authorize('administrador','medico'),
  rejeitarResultado
)

export default router
