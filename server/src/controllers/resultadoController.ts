import { Response } from 'express'
import Resultado from '../models/Resultado'
import Amostra   from '../models/Amostra'
import Requisicao from '../models/Requisicao'
import { AuthRequest } from '../middleware/authMiddleware'
import { notifyUtenteByRef } from '../utils/createNotification'

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
    const { estado, categoria, search, utente, flagIn, page = 1, limit = 50 } = req.query
    const filter: any = {}

    if (estado && estado !== 'todas')       filter.estado = estado
    if (categoria && categoria !== 'todas') filter['analise.categoria'] = categoria
    if (utente)  filter.utente = utente
    if (flagIn)  filter.flag   = { $in: (flagIn as string).split(',') }
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

export const validarTecnico = async (req: AuthRequest, res: Response) => {
  try {
    const { observacoes } = req.body
    const resultado = await Resultado.findById(req.params.id)
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    if (resultado.estado !== 'resultado_disponivel') return res.status(400).json({ message: 'Resultado não está disponível para validação técnica' })

    resultado.estado = 'validado_tecnico'
    resultado.validacaoTecnica = {
      userId: req.user!._id as any,
      nome:   req.user!.nome,
      dataHora: new Date(),
      observacoes,
    }
    await resultado.save()
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar tecnicamente', error: err })
  }
}

export const validarMedico = async (req: AuthRequest, res: Response) => {
  try {
    const { observacoes, emitirRelatorio } = req.body
    const resultado = await Resultado.findById(req.params.id)
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    if (resultado.estado !== 'validado_tecnico') return res.status(400).json({ message: 'Resultado não está validado tecnicamente' })

    resultado.estado = 'validado_medico'
    resultado.validacaoMedica = {
      userId: req.user!._id as any,
      nome:   req.user!.nome,
      dataHora: new Date(),
      observacoes,
    }
    if (emitirRelatorio) {
      resultado.relatorioEmitido  = true
      resultado.relatorioDataHora = new Date()
    }
    await resultado.save()

    // notificar utente: resultado disponível
    const isCritico = ['critico_alto','critico_baixo'].includes(resultado.flag)
    notifyUtenteByRef(
      resultado.utente,
      isCritico ? 'critico' : 'resultado',
      isCritico ? `Resultado crítico: ${resultado.analise.nome}` : `Novo resultado: ${resultado.analise.nome}`,
      isCritico
        ? `O resultado de ${resultado.analise.nome} requer atenção — valor crítico. Consulte o seu médico.`
        : `O resultado de ${resultado.analise.nome} já está disponível no seu portal.`,
      'resultados'
    )

    // se todos os resultados da requisição estão validados → concluir requisição
    try {
      const porValidar = await Resultado.countDocuments({
        requisicao: resultado.requisicao,
        estado: { $ne: 'validado_medico' },
      })
      if (porValidar === 0) {
        await Requisicao.findByIdAndUpdate(resultado.requisicao, { estado: 'concluida' })
        // notificar utente: requisição concluída
        notifyUtenteByRef(
          resultado.utente,
          'requisicao',
          'Requisição concluída',
          `A requisição ${resultado.requisicaoNumero} foi concluída. Pode consultar todos os resultados no portal.`,
          'requisicoes'
        )
      }
    } catch { /* não bloquear a validação se esta verificação falhar */ }

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar médicamente', error: err })
  }
}

export const emitirRelatorio = async (req: AuthRequest, res: Response) => {
  try {
    const resultado = await Resultado.findByIdAndUpdate(
      req.params.id,
      { relatorioEmitido: true, relatorioDataHora: new Date() },
      { new: true }
    )
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao emitir relatório', error: err })
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
    const [pendente, em_processamento, disponivel, validado_tecnico, validado_medico, criticos, criticosPorValidar] = await Promise.all([
      Resultado.countDocuments({ estado: 'pendente' }),
      Resultado.countDocuments({ estado: 'em_processamento' }),
      Resultado.countDocuments({ estado: 'resultado_disponivel' }),
      Resultado.countDocuments({ estado: 'validado_tecnico' }),
      Resultado.countDocuments({ estado: 'validado_medico' }),
      Resultado.countDocuments({ flag: { $in: ['critico_alto','critico_baixo'] }, estado: 'resultado_disponivel' }),
      Resultado.countDocuments({ flag: { $in: ['critico_alto','critico_baixo'] }, estado: { $in: ['resultado_disponivel','validado_tecnico'] } }),
    ])
    res.json({ pendente, em_processamento, disponivel, validado_tecnico, validado_medico, criticos, criticosPorValidar })
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
