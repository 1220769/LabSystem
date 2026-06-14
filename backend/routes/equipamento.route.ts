import { Router } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import {
  getEquipamentos, createEquipamento, updateEquipamento,
  getReagentes,    createReagente,    updateReagente,
  getManutencoes,  createManutencao,  resolverManutencao,
  getStats,
} from '../controllers/equipamento.controller'

const router = Router()
router.use(protect)

const isTecnico = authorize('administrador', 'tecnico')

router.get('/stats',              isTecnico, getStats)
router.get('/equipamentos',       isTecnico, getEquipamentos)
router.post('/equipamentos',      isTecnico, createEquipamento)
router.patch('/equipamentos/:id', isTecnico, updateEquipamento)

router.get('/reagentes',          isTecnico, getReagentes)
router.post('/reagentes',         isTecnico, createReagente)
router.patch('/reagentes/:id',    isTecnico, updateReagente)

router.get('/manutencoes',        isTecnico, getManutencoes)
router.post('/manutencoes',       isTecnico, createManutencao)
router.patch('/manutencoes/:id/resolver', isTecnico, resolverManutencao)

export default router
