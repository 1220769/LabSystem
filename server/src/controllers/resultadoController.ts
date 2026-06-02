import { Response } from 'express'
import Resultado from '../models/Resultado'
import Amostra   from '../models/Amostra'
import Requisicao from '../models/Requisicao'
import { AuthRequest } from '../middleware/authMiddleware'

/* auto-generated when amostra → recebida */
export const gerarWorklist = async (req: AuthRequest, res: Response) => {
  try {
    const amostra = await Amostra.findById(req.params.amostraId)
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })
    if (amostra.estado !== 'recebida') return res.status(400).json({ message: 'Amostra não está recebida' })

    const requisicao = await Requisicao.findById(amostra.requisicao)
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })

    const year  = new Date().getFullYear()
    const created = []

    for (const analise of requisicao.analises) {
      const exists = await Resultado.findOne({ amostra: amostra._id, 'analise.codigo': analise.codigo })
      if (exists) continue

      const count = await Resultado.countDocuments({ codigoResultado: { $regex: `^RES-${year}` } })
      const codigoResultado = `RES-${year}-${String(count + 1).padStart(4, '0')}`

      const r = await Resultado.create({
        codigoResultado,
        amostra:          amostra._id,
        codigoAmostra:    amostra.codigoAmostra,
        requisicao:       requisicao._id,
        requisicaoNumero: requisicao.numeroRequisicao,
        utente:           amostra.utente,
        utenteNome:       amostra.utenteNome,
        analise,
        flag:   'pendente',
        estado: 'pendente',
        createdBy: req.user!._id,
      })
      created.push(r)
    }

    res.status(201).json({ created: created.length, resultados: created })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao gerar worklist', error: err })
  }
}

export const getResultados = async (req: AuthRequest, res: Response) => {
  try {
    const { estado, categoria, search, page = 1, limit = 50 } = req.query
    const filter: any = {}

    if (estado && estado !== 'todas')       filter.estado = estado
    if (categoria && categoria !== 'todas') filter['analise.categoria'] = categoria
    if (search) {
      filter.$or = [
        { codigoResultado:    { $regex: search, $options: 'i' } },
        { utenteNome:         { $regex: search, $options: 'i' } },
        { codigoAmostra:      { $regex: search, $options: 'i' } },
        { 'analise.nome':     { $regex: search, $options: 'i' } },
      ]
    }

    const total      = await Resultado.countDocuments(filter)
    const resultados = await Resultado.find(filter)
      .sort({ 'analise.categoria': 1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: resultados, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter resultados', error: err })
  }
}

export const getResultadoById = async (req: AuthRequest, res: Response) => {
  try {
    const r = await Resultado.findById(req.params.id)
    if (!r) return res.status(404).json({ message: 'Resultado não encontrado' })
    res.json(r)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter resultado', error: err })
  }
}

export const updateResultado = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['valor','unidade','refMin','refMax','flag','estado','equipamento','observacoes']
    const update  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

    const resultado = await Resultado.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar resultado', error: err })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [pendente, em_processamento, disponivel, criticos] = await Promise.all([
      Resultado.countDocuments({ estado: 'pendente' }),
      Resultado.countDocuments({ estado: 'em_processamento' }),
      Resultado.countDocuments({ estado: 'resultado_disponivel' }),
      Resultado.countDocuments({ flag: { $in: ['critico_alto','critico_baixo'] }, estado: 'resultado_disponivel' }),
    ])
    res.json({ pendente, em_processamento, disponivel, criticos })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: err })
  }
}

export const getCategorias = async (_req: AuthRequest, res: Response) => {
  try {
    const cats = await Resultado.distinct('analise.categoria')
    res.json(cats)
  } catch (err) {
    res.status(500).json({ message: 'Erro', error: err })
  }
}
