import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import { getAmostras, getAmostraById, createAmostra, updateAmostra, getStats } from '../controllers/amostraController'

const router = Router()

router.use(protect)

router.get('/stats', getStats)
router.get('/',      getAmostras)
router.get('/:id',   getAmostraById)

router.post('/',
  authorize('administrador', 'tecnico', 'enfermeiro'),
  createAmostra
)

router.put('/:id',
  authorize('administrador', 'tecnico', 'enfermeiro'),
  updateAmostra
)

export default router
