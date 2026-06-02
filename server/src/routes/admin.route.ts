import { Router } from 'express'
import {
  createUser,
  deactivateUser,
  getMyPermissions,
  getUserById,
  getUsers,
  updateUser,
} from '../controllers/admin.controller'
import { verifyToken } from '../auth/verifyToken'
import { checkRole } from '../middleWare/checkRole'

const router = Router()

router.use(verifyToken)

router.get('/permissions/me', getMyPermissions)
router.get('/', checkRole('administrador'), getUsers)
router.get('/:id', checkRole('administrador'), getUserById)
router.post('/', checkRole('administrador'), createUser)
router.put('/:id', checkRole('administrador'), updateUser)
router.delete('/:id', checkRole('administrador'), deactivateUser)

export default router
