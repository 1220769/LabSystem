import { Router } from 'express'
import { getAnamneses } from '../controllers/anamnese.controller'
import { verifyToken } from '../auth/verifyToken'
import { checkRole } from '../middleWare/checkRole'

const router = Router()

router.get('/', verifyToken, checkRole('administrador', 'medico'), getAnamneses)

export default router
