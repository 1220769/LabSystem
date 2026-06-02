import { Router } from 'express'
import { getMedicos } from '../controllers/medico.controller'
import { verifyToken } from '../auth/verifyToken'
import { checkRole } from '../middleWare/checkRole'

const router = Router()

router.get('/', verifyToken, checkRole('administrador', 'medico'), getMedicos)

export default router
