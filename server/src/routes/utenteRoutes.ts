import { Router } from 'express'
import {
  getUtentes,
  getUtenteById,
  createUtente,
  updateUtente,
  deleteUtente,
  atribuirMedico,
} from '../controllers/utenteController'
import { protect, authorize } from '../middleware/authMiddleware'


const router = Router()

router.use(protect)

router.get('/',     getUtentes)
router.get('/:id',  getUtenteById)
router.post('/',    authorize('administrador','tecnico','medico','enfermeiro'), createUtente)
router.put('/:id',  authorize('administrador','tecnico','medico'), updateUtente)
router.delete('/:id',              authorize('administrador'), deleteUtente)
router.patch('/:id/atribuir-medico', authorize('administrador'), atribuirMedico)

export default router
