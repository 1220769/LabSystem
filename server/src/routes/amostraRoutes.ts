import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import {
  getAmostras, getAmostraById, createAmostra, updateAmostra, getStats,
  atribuirEnfermeiro, atribuirTecnico,
} from '../controllers/amostraController'

const router = Router()
router.use(protect)

router.get('/stats', getStats)
router.get('/',      getAmostras)
router.get('/:id',   getAmostraById)

router.post('/', authorize('administrador','tecnico','enfermeiro'), createAmostra)
router.put('/:id', authorize('administrador','tecnico','enfermeiro'), updateAmostra)

router.patch('/:id/atribuir-enfermeiro', authorize('administrador'), atribuirEnfermeiro)
router.patch('/:id/atribuir-tecnico',    authorize('administrador'), atribuirTecnico)

export default router
