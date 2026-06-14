import { Router, text } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import {
  gerarWorklist, getResultados, getResultadoById,
  updateResultado, getStats, getCategorias,
  validarTecnico, validarMedico,
  validarRequisicaoMedico, validarRequisicaoTecnico,
  getRequisicoesProntas,
  emitirRelatorio, rejeitarResultado,
  exportResultadosXml, importResultadosXml,
} from '../controllers/resultado.controller'

const router = Router()

router.use(protect)

router.get('/stats',      getStats)
router.get('/categorias', getCategorias)
// rotas estáticas antes de /:id para não serem capturadas como ObjectId
router.get('/requisicoes-prontas', getRequisicoesProntas)
router.get('/export/xml', exportResultadosXml)
router.post('/import/xml', authorize('administrador', 'tecnico'),
                           text({ type: ['application/xml', 'text/xml', 'text/plain'], limit: '5mb' }),
                           importResultadosXml)
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

// bulk — vêm antes de /:id
router.post('/requisicao/:reqNumero/validar-tecnico',
  authorize('administrador','tecnico'),
  validarRequisicaoTecnico
)

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
