import { Router } from 'express'
import {
  getUtentes,
  getUtenteById,
  createUtente,
  updateUtente,
  deleteUtente,
} from '../controllers/utenteController'
import { protect, authorize, checkPermission } from '../middleware/authMiddleware'  


const router = Router()

router.use(protect)

router.get('/',     getUtentes)
router.get('/:id',  getUtenteById)
router.post('/',    authorize('administrador','tecnico','medico','enfermeiro'), createUtente)
router.put('/:id',  authorize('administrador','tecnico','medico'), updateUtente)
router.delete('/:id', authorize('administrador'), deleteUtente)

export default router