import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware'
import { getPerfil, getRequisicoes, getResultados, getFaturas, getSummary } from '../controllers/portalController'

const router = Router()
router.use(protect)
router.use(authorize('utente', 'administrador'))

router.get('/summary',     getSummary)
router.get('/perfil',      getPerfil)
router.get('/requisicoes', getRequisicoes)
router.get('/resultados',  getResultados)
router.get('/faturas',     getFaturas)

export default router
