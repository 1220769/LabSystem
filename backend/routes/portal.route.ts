import { Router } from 'express'
import { protect, authorize } from '../middleWare/authMiddleware'
import { getPerfil, updatePerfil, getRequisicoes, getResultados, getResultadosByRequisicao, getFaturas, getSummary, linkUtente } from '../controllers/portal.controller'

const router = Router()
router.use(protect)
router.use(authorize('utente', 'administrador'))

router.get('/summary',     getSummary)
router.post('/link',       linkUtente)
router.get('/perfil',                          getPerfil)
router.put('/perfil',                          updatePerfil)
router.get('/requisicoes',                     getRequisicoes)
router.get('/resultados',                      getResultados)
router.get('/resultados/req/:reqNumero',        getResultadosByRequisicao)
router.get('/faturas',                         getFaturas)

export default router
