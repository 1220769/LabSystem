import { Response } from 'express'
import Amostra    from '../models/Amostra'
import Resultado  from '../models/Resultado'
import Requisicao from '../models/Requisicao'
import User from '../models/User'
import { AuthRequest } from '../middleware/authMiddleware'
import { escapeRegex } from '../utils/escapeRegex'
import { notifyUser } from '../utils/createNotification'

export const getAmostras = async (req: AuthRequest, res: Response) => {
  try {
    const { estado, tipoColheita, search, page = 1, limit = 20, atribuidoA } = req.query
    const filter: Record<string, unknown> = {}

    if (estado && estado !== 'todas')             filter.estado = estado
    if (tipoColheita && tipoColheita !== 'todas') filter.tipoColheita = tipoColheita
    // filtro por atribuição: enfermeiro ou técnico
    if (atribuidoA === 'enfermeiro') filter.enfermeiroAtribuido = req.user!._id
    if (atribuidoA === 'tecnico')    filter.tecnicoAtribuido    = req.user!._id
    if (search) {
      const s = escapeRegex(search as string)
      filter.$or = [
        { codigoAmostra:    { $regex: s, $options: 'i' } },
        { utenteNome:       { $regex: s, $options: 'i' } },
        { requisicaoNumero: { $regex: s, $options: 'i' } },
      ]
    }

    const total    = await Amostra.countDocuments(filter)
    const amostras = await Amostra.find(filter)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: amostras, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter amostras', error: err })
  }
}

export const getAmostraById = async (req: AuthRequest, res: Response) => {
  try {
    const amostra = await Amostra.findById(req.params.id)
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })
    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter amostra', error: err })
  }
}

export const createAmostra = async (req: AuthRequest, res: Response) => {
  try {
    const year  = new Date().getFullYear()
    const count = await Amostra.countDocuments({ codigoAmostra: { $regex: `^AM-${year}` } })
    const codigoAmostra = `AM-${year}-${String(count + 1).padStart(4, '0')}`

    // presencial → colhida e entregue no mesmo acto; domiciliária → aguarda_colheita até ser feita
    const estadoInicial = req.body.tipoColheita === 'domiciliaria' ? 'aguarda_colheita' : 'recebida'

    const amostra = await Amostra.create({
      ...req.body,
      codigoAmostra,
      estado:              estadoInicial,
      enfermeiroAtribuido: req.user!._id,
      enfermeiroNome:      req.user!.nome,
      createdBy:           req.user!._id,
    })

    // requisição passa a em_curso quando a amostra é registada
    await Requisicao.findByIdAndUpdate(req.body.requisicao, { estado: 'em_curso' }).catch(() => {})

    // se ficou logo recebida (colheita presencial), gerar worklist para o técnico
    if (estadoInicial === 'recebida') {
      gerarWorklistAutomatico(String(amostra._id), req.user!._id as import('mongoose').Types.ObjectId).catch(() => {})
    }

    res.status(201).json(amostra)
  } catch (err: unknown) {
    res.status(500).json({ message: 'Erro ao criar amostra', error: err })
  }
}

async function gerarWorklistAutomatico(amostraId: string, userId: import('mongoose').Types.ObjectId) {
  const amostra = await Amostra.findById(amostraId)
  if (!amostra) return

  const requisicao = await Requisicao.findById(amostra.requisicao)
  if (!requisicao) return

  const year = new Date().getFullYear()

  for (const analise of requisicao.analises) {
    const existe = await Resultado.findOne({ amostra: amostra._id, 'analise.codigo': analise.codigo })
    if (existe) continue

    const count = await Resultado.countDocuments({ codigoResultado: { $regex: `^RES-${year}` } })
    await Resultado.create({
      codigoResultado:  `RES-${year}-${String(count + 1).padStart(4, '0')}`,
      amostra:          amostra._id,
      codigoAmostra:    amostra.codigoAmostra,
      requisicao:       requisicao._id,
      requisicaoNumero: requisicao.numeroRequisicao,
      utente:           amostra.utente,
      utenteNome:       amostra.utenteNome,
      analise,
      flag:             'pendente',
      estado:           'pendente',
      createdBy:        userId,
    })
  }
}

export const updateAmostra = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['estado', 'tubos', 'tecnico', 'temperatura', 'dataHoraColheita', 'motivoRejeicao', 'observacoes']
    const update  = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    )

    const anterior = await Amostra.findById(req.params.id).select('estado')
    const amostra  = await Amostra.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })

    // ponto 1: receber amostra → gerar worklist automaticamente
    if (update.estado === 'recebida' && anterior?.estado !== 'recebida') {
      gerarWorklistAutomatico(String(amostra._id), req.user!._id as import('mongoose').Types.ObjectId).catch(() => {})
    }

    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar amostra', error: err })
  }
}

// PATCH /api/amostras/:id/atribuir-enfermeiro — admin atribui colheita a enfermeiro
export const atribuirEnfermeiro = async (req: AuthRequest, res: Response) => {
  try {
    const { enfermeiroId } = req.body
    const enfermeiro = await User.findById(enfermeiroId).select('nome role')
    if (!enfermeiro || enfermeiro.role !== 'enfermeiro') {
      return res.status(400).json({ message: 'Utilizador não é enfermeiro' })
    }
    const amostra = await Amostra.findByIdAndUpdate(
      req.params.id,
      { enfermeiroAtribuido: enfermeiroId, enfermeiroNome: enfermeiro.nome },
      { new: true }
    )
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })

    notifyUser(enfermeiroId, 'requisicao',
      'Colheita atribuída',
      `Foi-lhe atribuída a colheita ${amostra.codigoAmostra} do utente ${amostra.utenteNome}.`,
      'colheita'
    )
    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atribuir enfermeiro', error: err })
  }
}

// PATCH /api/amostras/:id/atribuir-tecnico — admin atribui amostra a técnico
export const atribuirTecnico = async (req: AuthRequest, res: Response) => {
  try {
    const { tecnicoId } = req.body
    const tecnico = await User.findById(tecnicoId).select('nome role')
    if (!tecnico || tecnico.role !== 'tecnico') {
      return res.status(400).json({ message: 'Utilizador não é técnico' })
    }
    const amostra = await Amostra.findByIdAndUpdate(
      req.params.id,
      { tecnicoAtribuido: tecnicoId, tecnicoNome: tecnico.nome },
      { new: true }
    )
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })

    notifyUser(tecnicoId, 'resultado',
      'Amostra atribuída para análise',
      `A amostra ${amostra.codigoAmostra} do utente ${amostra.utenteNome} foi-lhe atribuída para processamento.`,
      'analise'
    )
    res.json(amostra)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atribuir técnico', error: err })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [aguarda, colhida, em_transito, recebida, domiciliarias] = await Promise.all([
      Amostra.countDocuments({ estado: 'aguarda_colheita' }),
      Amostra.countDocuments({ estado: 'colhida' }),
      Amostra.countDocuments({ estado: 'em_transito' }),
      Amostra.countDocuments({ estado: 'recebida' }),
      Amostra.countDocuments({ tipoColheita: 'domiciliaria', estado: { $in: ['aguarda_colheita','colhida','em_transito'] } }),
    ])
    res.json({ aguarda, colhida, em_transito, recebida, domiciliarias })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: err })
  }
}
