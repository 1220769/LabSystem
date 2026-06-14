import { Response } from 'express'
import Requisicao from '../models/requisicao.model'
import Fatura     from '../models/fatura.model'
import User       from '../models/user.model'
import { AuthRequest } from '../middleWare/authMiddleware'
import { escapeRegex } from '../utils/escapeRegex'
import { notifyUser } from '../utils/createNotification'
import { registarEvento } from '../utils/registarEvento'
import { buildRequisicoesXml, validateRequisicoesXml, parseRequisicoesXml } from '../utils/xmlRequisicao'

export const getRequisicoes = async (req: AuthRequest, res: Response) => {
  try {
    const { estado, search, urgente, medicoId, utenteId, page = 1, limit = 20 } = req.query
    const filter: any = {}

    if (estado && estado !== 'todas') filter.estado = estado
    if (urgente === 'true')           filter.urgente = true
    if (medicoId === 'mine') filter.createdBy = req.user!._id
    else if (medicoId)       filter.createdBy = medicoId
    // utente só vê as suas requisições
    if (utenteId === 'mine') filter.utente = (req.user as any).utenteRef ?? null
    else if (utenteId)       filter.utente = utenteId

    if (search) {
      const s = escapeRegex(search as string)
      filter.$or = [
        { numeroRequisicao:  { $regex: s, $options: 'i' } },
        { utenteNome:        { $regex: s, $options: 'i' } },
        { medicoSolicitante: { $regex: s, $options: 'i' } },
      ]
    }

    const total       = await Requisicao.countDocuments(filter)
    const requisicoes = await Requisicao.find(filter)
      .sort({ urgente: -1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ data: requisicoes, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter requisições', error: err })
  }
}

export const getRequisicaoById = async (req: AuthRequest, res: Response) => {
  try {
    const r = await Requisicao.findById(req.params.id)
    if (!r) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json(r)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter requisição', error: err })
  }
}

export const createRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const year  = new Date().getFullYear()
    const count = await Requisicao.countDocuments({ numeroRequisicao: { $regex: `^REQ-${year}` } })
    const numeroRequisicao = `REQ-${year}-${String(count + 1).padStart(4, '0')}`

    const medicoSolicitante = req.body.medicoSolicitante
      || (req.user!.role === 'utente' ? 'Pedido próprio' : req.user!.nome)

    const requisicao = await Requisicao.create({
      ...req.body,
      numeroRequisicao,
      medicoSolicitante,
      createdBy: req.user!._id,
    })

    // criar rascunho de fatura imediatamente
    try {
      const fatCount = await Fatura.countDocuments({ numeroFatura: { $regex: `^FAT-${year}` } })
      const numeroFatura = `FAT-${year}-${String(fatCount + 1).padStart(4, '0')}`
      const linhas = (requisicao.analises ?? []).map((a: any) => ({
        codigo: a.codigo, descricao: a.nome, preco: 0,
      }))
      await Fatura.create({
        numeroFatura,
        requisicao:       requisicao._id,
        requisicaoNumero: requisicao.numeroRequisicao,
        utente:           requisicao.utente,
        utenteNome:       requisicao.utenteNome,
        tipo:             'particular',
        linhas,
        valorBruto: 0, percentComparticipacao: 0,
        valorComparticipado: 0, valorLiquido: 0,
        estado:    'rascunho',
        createdBy: req.user!._id,
      })
      // notificar administradores sobre nova requisição para faturar
      const admins = await User.find({ role: 'administrador', ativo: true }).select('_id')
      for (const a of admins) {
        notifyUser(a._id, 'fatura',
          'Nova requisição para faturar',
          `Requisição ${requisicao.numeroRequisicao} criada. Fatura ${numeroFatura} em rascunho aguarda preços.`,
          'financeiro'
        )
      }
    } catch { /* não bloquear */ }

    registarEvento({
      utilizador:   req.user!.nome,
      utilizadorId: req.user!._id as any,
      acao:         'criar_requisicao',
      modulo:       'requisicoes',
      detalhe:      `${requisicao.numeroRequisicao} — ${requisicao.utenteNome}`,
    })

    res.status(201).json(requisicao)
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao criar requisição', error: err })
  }
}

export const updateRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['urgente','prioridade','estado','observacoes','medicoSolicitante','analises','prescricaoRef']
    const update  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

    const requisicao = await Requisicao.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json(requisicao)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar requisição', error: err })
  }
}

export const cancelRequisicao = async (req: AuthRequest, res: Response) => {
  try {
    const requisicao = await Requisicao.findByIdAndUpdate(req.params.id, { estado: 'cancelada' }, { new: true })
    if (!requisicao) return res.status(404).json({ message: 'Requisição não encontrada' })
    res.json({ message: 'Requisição cancelada', requisicao })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cancelar requisição', error: err })
  }
}

/* ───────────────────────────────────────────────
   EXPORTAR requisições em XML (conforme requisicao.xsd)
   ─────────────────────────────────────────────── */
export const exportRequisicoesXml = async (_req: AuthRequest, res: Response) => {
  try {
    const requisicoes = await Requisicao.find().sort({ createdAt: -1 }).limit(1000)
    const xml = buildRequisicoesXml(requisicoes)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition',
      `attachment; filename="requisicoes-${new Date().toISOString().slice(0, 10)}.xml"`)
    res.send(xml)
  } catch {
    res.status(500).json({ message: 'Erro ao exportar XML' })
  }
}

/* ───────────────────────────────────────────────
   IMPORTAR requisições a partir de XML
   1) validar contra o XSD → inválido devolve 422 + lista de erros
   2) só depois grava (atualização por número de requisição)
   ─────────────────────────────────────────────── */
export const importRequisicoesXml = async (req: AuthRequest, res: Response) => {
  try {
    const xml = typeof req.body === 'string' ? req.body : ''
    if (!xml.trim()) return res.status(400).json({ message: 'Corpo XML em falta.' })

    // 1) VALIDAR ANTES de gravar — protege a base de dados
    const { valid, errors } = await validateRequisicoesXml(xml)
    if (!valid) {
      return res.status(422).json({ message: 'XML inválido — não foi importado nada.', errors })
    }

    // 2) importar (atualização por numeroRequisicao)
    const itens = parseRequisicoesXml(xml)
    let atualizadas = 0
    const ignoradas: string[] = []

    for (const it of itens) {
      const req_ = await Requisicao.findOne({ numeroRequisicao: it.numeroRequisicao })
      if (!req_) { ignoradas.push(it.numeroRequisicao); continue }

      req_.estado  = it.estado as any
      req_.urgente = it.urgente
      if (it.medico)      req_.medicoSolicitante = it.medico
      if (it.observacoes != null) req_.observacoes = it.observacoes

      await req_.save()
      atualizadas++
    }

    res.json({
      message:       'Importação concluída.',
      total:         itens.length,
      atualizadas,
      ignoradas:     ignoradas.length,
      ignoradasNums: ignoradas,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao importar XML'
    res.status(400).json({ message: msg })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [pendente, em_curso, concluida, cancelada, urgentes] = await Promise.all([
      Requisicao.countDocuments({ estado: 'pendente' }),
      Requisicao.countDocuments({ estado: 'em_curso' }),
      Requisicao.countDocuments({ estado: 'concluida' }),
      Requisicao.countDocuments({ estado: 'cancelada' }),
      Requisicao.countDocuments({ estado: { $ne: 'cancelada' }, urgente: true }),
    ])
    res.json({ pendente, em_curso, concluida, cancelada, urgentes })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter estatísticas', error: err })
  }
}
