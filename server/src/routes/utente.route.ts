import { Router } from 'express'
import {
  createUtente,
  deleteUtente,
  getUtenteById,
  getUtentes,
  updateUtente,
} from '../controllers/utente.controller'
import { verifyToken } from '../auth/verifyToken'
import { checkRole } from '../middleware/checkRole'

const router = Router()

router.use(verifyToken)

router.get('/', checkRole('administrador', 'tecnico', 'medico', 'enfermeiro', 'utente'), getUtentes)
router.get('/:id', checkRole('administrador', 'tecnico', 'medico', 'enfermeiro', 'utente'), getUtenteById)
router.post('/', checkRole('administrador', 'tecnico', 'medico'), createUtente)
router.put('/:id', checkRole('administrador', 'tecnico', 'medico', 'enfermeiro'), updateUtente)
router.delete('/:id', checkRole('administrador'), deleteUtente)

export default router
