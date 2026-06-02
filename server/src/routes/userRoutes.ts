import { Router } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getMyPermissions,
} from '../controllers/userController'
import { protect, authorize } from '../middleWare/authMiddleware'

const router = Router()

router.use(protect)

router.get('/permissions/me', getMyPermissions)
router.get('/',     authorize('administrador'), getUsers)
router.get('/:id',  authorize('administrador'), getUserById)
router.post('/',    authorize('administrador'), createUser)
router.put('/:id',  authorize('administrador'), updateUser)
router.delete('/:id', authorize('administrador'), deactivateUser)

export default router
