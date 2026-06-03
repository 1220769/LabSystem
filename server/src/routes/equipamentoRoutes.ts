import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  getEquipamentos, createEquipamento, updateEquipamento,
  getReagentes,    createReagente,    updateReagente,
  getManutencoes,  createManutencao,  resolverManutencao,
  getStats,
} from '../controllers/equipamentoController'

const router = Router()
router.use(protect)

router.get('/stats',              getStats)
router.get('/equipamentos',       getEquipamentos)
router.post('/equipamentos',      authorize('administrador','tecnico'), createEquipamento)
router.patch('/equipamentos/:id', authorize('administrador','tecnico'), updateEquipamento)

router.get('/reagentes',          getReagentes)
router.post('/reagentes',         authorize('administrador','tecnico'), createReagente)
router.patch('/reagentes/:id',    authorize('administrador','tecnico'), updateReagente)

router.get('/manutencoes',        getManutencoes)
router.post('/manutencoes',       authorize('administrador','tecnico'), createManutencao)
router.patch('/manutencoes/:id/resolver', authorize('administrador','tecnico'), resolverManutencao)

export default router
