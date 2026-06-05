import { Router } from 'express'
import {
  getUsers,
  getUserById,
  getUserByUtente,
  createUser,
  updateUser,
  deactivateUser,
  deleteUserPermanent,
  getMyPermissions,
  getStats,
} from '../controllers/userController'
import { protect, authorize } from '../middleware/authMiddleware'

const router = Router()

router.use(protect)

router.get('/permissions/me',          getMyPermissions)
router.get('/stats',                   authorize('administrador'), getStats)
router.get('/by-utente/:utenteId',     authorize('administrador'), getUserByUtente)
router.get('/',                        authorize('administrador'), getUsers)
router.get('/:id',                     authorize('administrador'), getUserById)
router.post('/',    authorize('administrador'), createUser)
router.put('/:id',  authorize('administrador'), updateUser)
router.delete('/:id',           authorize('administrador'), deactivateUser)
router.delete('/:id/permanent', authorize('administrador'), deleteUserPermanent)

export default router
