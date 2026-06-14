import { Response } from 'express'
import Resultado from '../models/resultado.model'
import Amostra   from '../models/amostra.model'
import Requisicao from '../models/requisicao.model'
import Fatura from '../models/fatura.model'
import User from '../models/user.model'
import { AuthRequest } from '../middleWare/authMiddleware'
import { notifyUtenteByRef, notifyUser } from '../utils/createNotification'
import { escapeRegex } from '../utils/escapeRegex'
import { registarEvento } from '../utils/registarEvento'
import { buildResultadosXml, validateResultadosXml, parseResultadosXml } from '../utils/xmlResultado'

/* auto-generated when amostra → recebida */
export const gerarWorklist = async (req: AuthRequest, res: Response) => {
  try {
    const amostra = await Amostra.findById(req.params.amostraId)
    if (!amostra) return res.status(404).json({ message: 'Amostra não encontrada' })
    if (amostra.estado !== 'recebida') return res.status(400).json({ message: 'Amostra não está recebida' })

    const requisicao = await Requisicao.findById(amostra.requisicao)
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })

    const year = new Date().getFullYear()

    // 1 query para saber quais análises já têm resultado nesta amostra
    const codigosAnalisesExistentes = await Resultado
      .find({ amostra: amostra._id }, { 'analise.codigo': 1 })
      .lean()
      .then(rs => new Set(rs.map(r => r.analise.codigo)))

    const analisesNovas = requisicao.analises.filter(a => !codigosAnalisesExistentes.has(a.codigo))
    if (analisesNovas.length === 0) {
      return res.status(200).json({ created: 0, resultados: [] })
    }

    // 1 query para obter o contador actual e gerar códigos sequenciais
    const baseCount = await Resultado.countDocuments({ codigoResultado: { $regex: `^RES-${year}` } })

    const docs = analisesNovas.map((analise, i) => ({
      codigoResultado:  `RES-${year}-${String(baseCount + i + 1).padStart(4, '0')}`,
      amostra:          amostra._id,
      codigoAmostra:    amostra.codigoAmostra,
      requisicao:       requisicao._id,
      requisicaoNumero: requisicao.numeroRequisicao,
      utente:           amostra.utente,
      utenteNome:       amostra.utenteNome,
      analise,
      flag:      'pendente',
      estado:    'pendente',
      createdBy: req.user!._id,
    }))

    const created = await Resultado.insertMany(docs)

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
      const s = escapeRegex(search as string)
      filter.$or = [
        { codigoResultado:    { $regex: s, $options: 'i' } },
        { utenteNome:         { $regex: s, $options: 'i' } },
        { codigoAmostra:      { $regex: s, $options: 'i' } },
        { 'analise.nome':     { $regex: s, $options: 'i' } },
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
    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'validacao_tecnica',
      modulo:       'resultados',
      detalhe:      `${resultado.codigoResultado} — ${resultado.analise.nome}`,
    })
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

    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         isCritico ? 'validacao_medica_critico' : 'validacao_medica',
      modulo:       'resultados',
      detalhe:      `${resultado.codigoResultado} — ${resultado.analise.nome} [${resultado.flag}]`,
    })

    // melhoria 3: notificar directamente o médico se resultado crítico
    if (isCritico) {
      try {
        const req = await Requisicao.findById(resultado.requisicao).select('createdBy numeroRequisicao')
        if (req && req.createdBy.toString() !== resultado.createdBy?.toString()) {
          notifyUser(
            req.createdBy,
            'critico',
            `Resultado crítico — ${resultado.analise.nome}`,
            `Resultado crítico validado na requisição ${resultado.requisicaoNumero}. Valor: ${resultado.valor ?? '—'} ${resultado.unidade ?? ''}. Reveja o portal.`,
            'validacao'
          )
        }
      } catch { /* não bloquear */ }
    }

    // se todos os resultados da requisição estão validados → concluir requisição
    try {
      const porValidar = await Resultado.countDocuments({
        requisicao: resultado.requisicao,
        estado: { $nin: ['validado_medico', 'rejeitado'] },
      })
      if (porValidar === 0) {
        await Requisicao.findByIdAndUpdate(resultado.requisicao, { estado: 'concluida' })
        notifyUtenteByRef(
          resultado.utente,
          'requisicao',
          'Resultados disponíveis',
          `Todos os resultados da requisição ${resultado.requisicaoNumero} foram validados. Consulte o seu portal.`,
          'resultados'
        )
      }
    } catch { /* não bloquear */ }

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar médicamente', error: err })
  }
}

// Validação médica em bloco — todos os resultados de uma requisição de uma vez
export const validarRequisicaoMedico = async (req: AuthRequest, res: Response) => {
  try {
    const { reqNumero } = req.params
    const { observacoes } = req.body

    const pendentes = await Resultado.find({
      requisicaoNumero: reqNumero,
      estado: 'validado_tecnico',
    })

    if (pendentes.length === 0) {
      return res.status(404).json({ message: 'Sem resultados por validar nesta requisição' })
    }

    const agora = new Date()
    const validacaoMedica = {
      userId:      req.user!._id,
      nome:        req.user!.nome,
      dataHora:    agora,
      observacoes: observacoes || undefined,
    }

    await Resultado.updateMany(
      { requisicaoNumero: reqNumero, estado: 'validado_tecnico' },
      { $set: { estado: 'validado_medico', validacaoMedica, relatorioEmitido: true, relatorioDataHora: agora } }
    )

    // marcar requisição como concluída
    const requisicao = await Requisicao.findOneAndUpdate(
      { numeroRequisicao: reqNumero },
      { estado: 'concluida' },
      { new: true }
    )

    // uma única notificação ao utente
    if (requisicao) {
      notifyUtenteByRef(
        pendentes[0].utente,
        'requisicao',
        'Resultados disponíveis',
        `Todos os resultados da requisição ${reqNumero} foram validados. Consulte o seu portal.`,
        'resultados'
      )
    }

    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'validacao_medica_bulk',
      modulo:       'resultados',
      detalhe:      `Requisição ${reqNumero} — ${pendentes.length} resultado(s) validados em bloco`,
    })

    res.json({ validated: pendentes.length, reqNumero })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar requisição', error: err })
  }
}

// melhoria 2: rejeição de resultado pelo médico
export const rejeitarResultado = async (req: AuthRequest, res: Response) => {
  try {
    const { motivo } = req.body
    if (!motivo?.trim()) return res.status(400).json({ message: 'Motivo de rejeição obrigatório' })

    const resultado = await Resultado.findById(req.params.id)
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    if (!['validado_tecnico', 'resultado_disponivel'].includes(resultado.estado)) {
      return res.status(400).json({ message: 'Só é possível rejeitar resultados disponíveis ou validados tecnicamente' })
    }

    resultado.estado   = 'rejeitado'
    resultado.rejeicao = {
      userId:   req.user!._id as any,
      nome:     req.user!.nome,
      dataHora: new Date(),
      motivo,
    }
    await resultado.save()
    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'rejeicao_resultado',
      modulo:       'resultados',
      detalhe:      `${resultado.codigoResultado} — motivo: ${motivo}`,
    })

    // notificar o técnico que inseriu o resultado
    notifyUser(
      resultado.createdBy,
      'resultado',
      `Resultado rejeitado — ${resultado.analise.nome}`,
      `O resultado ${resultado.codigoResultado} foi rejeitado. Motivo: ${motivo}. Por favor reveja e reinsira.`,
      'analise'
    )

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao rejeitar resultado', error: err })
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

    // se o técnico re-submete um resultado rejeitado, volta a disponível e limpa rejeição
    const atual = await Resultado.findById(req.params.id).select('estado')
    if (atual?.estado === 'rejeitado' && update.valor !== undefined) {
      update.estado   = 'resultado_disponivel'
      ;(update as any).$unset = { rejeicao: 1 }
    }

    const resultado = await Resultado.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    )
    if (!resultado) return res.status(404).json({ message: 'Resultado não encontrado' })
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar resultado', error: err })
  }
}

/* ───────────────────────────────────────────────
   EXPORTAR resultados em XML (conforme resultado.xsd)
   ─────────────────────────────────────────────── */
export const exportResultadosXml = async (_req: AuthRequest, res: Response) => {
  try {
    const resultados = await Resultado.find().sort({ createdAt: -1 }).limit(2000)
    const xml = buildResultadosXml(resultados)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition',
      `attachment; filename="resultados-${new Date().toISOString().slice(0, 10)}.xml"`)
    res.send(xml)
  } catch {
    res.status(500).json({ message: 'Erro ao exportar XML' })
  }
}

/* ───────────────────────────────────────────────
   IMPORTAR resultados a partir de XML
   1) validar contra o XSD → inválido devolve 422 + lista de erros
   2) só depois grava (atualização por código de resultado)
   ─────────────────────────────────────────────── */
export const importResultadosXml = async (req: AuthRequest, res: Response) => {
  try {
    const xml = typeof req.body === 'string' ? req.body : ''
    if (!xml.trim()) return res.status(400).json({ message: 'Corpo XML em falta.' })

    // 1) VALIDAR ANTES de gravar — protege a base de dados
    const { valid, errors } = await validateResultadosXml(xml)
    if (!valid) {
      return res.status(422).json({ message: 'XML inválido — não foi importado nada.', errors })
    }

    // 2) importar (atualização por codigoResultado)
    const itens = parseResultadosXml(xml)
    let atualizados = 0
    const ignorados: string[] = []

    for (const it of itens) {
      const r = await Resultado.findOne({ codigoResultado: it.codigoResultado })
      if (!r) { ignorados.push(it.codigoResultado); continue }

      if (it.valor != null)       r.valor = it.valor
      if (it.unidade != null)     r.unidade = it.unidade
      r.flag   = it.flag as any
      r.estado = it.estado as any
      if (it.observacoes != null) r.observacoes = it.observacoes

      await r.save()
      atualizados++
    }

    res.json({
      message:       'Importação concluída.',
      total:         itens.length,
      atualizadas:   atualizados,
      ignoradas:     ignorados.length,
      ignoradasNums: ignorados,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao importar XML'
    res.status(400).json({ message: msg })
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

    // nº de REQUISIÇÕES totalmente prontas para validação médica
    // (todos os resultados em validado_tecnico) — alinha o contador do médico
    // com a lista mostrada em /resultados/requisicoes-prontas
    const reqsProntas = await Resultado.aggregate([
      { $group: {
          _id:     '$requisicaoNumero',
          total:   { $sum: 1 },
          prontos: { $sum: { $cond: [{ $eq: ['$estado', 'validado_tecnico'] }, 1, 0] } },
      }},
      { $match: { $expr: { $eq: ['$total', '$prontos'] } } },
      { $count: 'n' },
    ])
    const reqsValidadoTecnico = reqsProntas[0]?.n ?? 0

    // nº de REQUISIÇÕES com análises por inserir (≥1 resultado pendente) —
    // alinha o contador "para analisar" com a lista agrupada do técnico
    const reqsPend = await Resultado.aggregate([
      { $match: { estado: 'pendente' } },
      { $group: { _id: '$requisicaoNumero' } },
      { $count: 'n' },
    ])
    const reqsPendentes = reqsPend[0]?.n ?? 0

    // nº de REQUISIÇÕES totalmente prontas para validação técnica
    // (todos os resultados em resultado_disponivel) — alinha "aguardam validação"
    const reqsDisp = await Resultado.aggregate([
      { $group: {
          _id:     '$requisicaoNumero',
          total:   { $sum: 1 },
          prontos: { $sum: { $cond: [{ $eq: ['$estado', 'resultado_disponivel'] }, 1, 0] } },
      }},
      { $match: { $expr: { $eq: ['$total', '$prontos'] } } },
      { $count: 'n' },
    ])
    const reqsDisponiveis = reqsDisp[0]?.n ?? 0

    res.json({ pendente, em_processamento, disponivel, validado_tecnico, validado_medico, criticos, criticosPorValidar, reqsValidadoTecnico, reqsPendentes, reqsDisponiveis })
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

// Devolve requisições onde TODOS os resultados têm o estado indicado
// usado pelo técnico (resultado_disponivel) e médico (validado_tecnico)
export const getRequisicoesProntas = async (req: AuthRequest, res: Response) => {
  try {
    const { estado } = req.query as { estado?: string }
    if (!estado) return res.status(400).json({ message: 'Parâmetro estado obrigatório' })

    const grupos = await Resultado.aggregate([
      {
        $group: {
          _id:        '$requisicaoNumero',
          total:      { $sum: 1 },
          prontos:    { $sum: { $cond: [{ $eq: ['$estado', estado] }, 1, 0] } },
          utenteNome: { $first: '$utenteNome' },
          utente:     { $first: '$utente' },
          createdAt:  { $first: '$createdAt' },
          items:      { $push: '$$ROOT' },
        },
      },
      // apenas requisições onde TODOS os resultados estão no estado pedido
      { $match: { $expr: { $eq: ['$total', '$prontos'] } } },
      { $sort:  { createdAt: 1 } },
    ])

    res.json({ data: grupos })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter requisições prontas', error: err })
  }
}

// Validação técnica em bloco — todos os resultados de uma requisição de uma vez
export const validarRequisicaoTecnico = async (req: AuthRequest, res: Response) => {
  try {
    const { reqNumero } = req.params
    const { observacoes } = req.body

    const pendentes = await Resultado.find({
      requisicaoNumero: reqNumero,
      estado:           'resultado_disponivel',
    })
    if (pendentes.length === 0) {
      return res.status(404).json({ message: 'Sem resultados disponíveis para validação técnica nesta requisição' })
    }

    const validacaoTecnica = {
      userId:      req.user!._id,
      nome:        req.user!.nome,
      dataHora:    new Date(),
      observacoes: observacoes || undefined,
    }

    await Resultado.updateMany(
      { requisicaoNumero: reqNumero, estado: 'resultado_disponivel' },
      { $set: { estado: 'validado_tecnico', validacaoTecnica } }
    )

    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'validacao_tecnica_bulk',
      modulo:       'resultados',
      detalhe:      `Requisição ${reqNumero} — ${pendentes.length} resultado(s) validados tecnicamente`,
    })

    res.json({ validated: pendentes.length, reqNumero })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao validar tecnicamente', error: err })
  }
}
