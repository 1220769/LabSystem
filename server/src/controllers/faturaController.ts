import { Response } from 'express'
import Fatura from '../models/Fatura'
import Requisicao from '../models/Requisicao'
import { AuthRequest as Request } from '../middleware/authMiddleware'
import { notifyUtenteByRef } from '../utils/createNotification'
import { escapeRegex } from '../utils/escapeRegex'

function nextNumero(last: string | null, prefix: string): string {
  if (!last) return `${prefix}-${new Date().getFullYear()}-0001`
  const parts = last.split('-')
  const n = parseInt(parts[parts.length - 1], 10) + 1
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
}

export async function getFaturas(req: Request, res: Response) {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string)  || 1)
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 20)
    const estado = req.query.estado as string | undefined
    const search = req.query.search as string | undefined

    const filter: Record<string, unknown> = {}
    if (estado && estado !== 'todas') filter.estado = estado
    if (search) {
      const s = escapeRegex(search)
      filter.$or = [
        { numeroFatura:     { $regex: s, $options: 'i' } },
        { utenteNome:       { $regex: s, $options: 'i' } },
        { requisicaoNumero: { $regex: s, $options: 'i' } },
      ]
    }

    const total   = await Fatura.countDocuments(filter)
    const faturas = await Fatura.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    res.json({ data: faturas, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar faturas' })
  }
}

export async function getFaturaById(req: Request, res: Response) {
  try {
    const fatura = await Fatura.findById(req.params.id)
    if (!fatura) return res.status(404).json({ message: 'Fatura não encontrada' })
    res.json(fatura)
  } catch {
    res.status(500).json({ message: 'Erro ao buscar fatura' })
  }
}

export async function createFatura(req: Request, res: Response) {
  try {
    const last = await Fatura.findOne().sort({ createdAt: -1 }).select('numeroFatura')
    const numeroFatura = nextNumero(last?.numeroFatura ?? null, 'FAT')

    const fatura = new Fatura({
      ...req.body,
      numeroFatura,
      createdBy: req.user!._id,
    })
    await fatura.save()
    res.status(201).json(fatura)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar fatura'
    res.status(400).json({ message: msg })
  }
}

export async function updateFatura(req: Request, res: Response) {
  try {
    const fatura = await Fatura.findById(req.params.id)
    if (!fatura) return res.status(404).json({ message: 'Fatura não encontrada' })
    if (fatura.estado === 'anulada') return res.status(400).json({ message: 'Fatura anulada não pode ser alterada' })

    const { estado } = req.body

    if (estado === 'emitida' && fatura.estado === 'rascunho') {
      fatura.estado      = 'emitida'
      fatura.dataEmissao = new Date()
      // notificar utente: nova fatura
      if (fatura.utente) {
        const valor = fatura.valorLiquido?.toFixed(2) ?? '—'
        notifyUtenteByRef(
          fatura.utente as any,
          'fatura',
          `Nova fatura: ${fatura.numeroFatura}`,
          `Foi emitida uma fatura no valor de €${valor}. Consulte os detalhes e a referência de pagamento no portal.`,
          'faturas'
        )
      }
    } else if (estado === 'paga' && fatura.estado === 'emitida') {
      fatura.estado        = 'paga'
      fatura.dataPagamento = new Date()
      if (req.body.referenciaPagamento) fatura.referenciaPagamento = req.body.referenciaPagamento
    } else if (estado === 'anulada') {
      fatura.estado = 'anulada'
    } else {
      const allowed = ['linhas','valorBruto','percentComparticipacao','valorComparticipado','valorLiquido','observacoes','tipo','seguradora']
      for (const key of allowed) {
        if (req.body[key] !== undefined) (fatura as unknown as Record<string, unknown>)[key] = req.body[key]
      }
    }

    await fatura.save()
    res.json(fatura)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar fatura'
    res.status(400).json({ message: msg })
  }
}

export async function getStats(_req: Request, res: Response) {
  try {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)

    const [faturacaoMes, recebidoMes, porEstado] = await Promise.all([
      Fatura.aggregate([
        { $match: { createdAt: { $gte: start }, estado: { $ne: 'anulada' } } },
        { $group: { _id: null, total: { $sum: '$valorLiquido' } } },
      ]),
      Fatura.aggregate([
        { $match: { estado: 'paga', dataPagamento: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$valorLiquido' } } },
      ]),
      Fatura.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 }, valor: { $sum: '$valorLiquido' } } },
      ]),
    ])

    res.json({
      faturacaoMes: faturacaoMes[0]?.total ?? 0,
      recebidoMes:  recebidoMes[0]?.total  ?? 0,
      porEstado,
    })
  } catch {
    res.status(500).json({ message: 'Erro ao obter estatísticas' })
  }
}

export async function getRequisicoesSemFatura(_req: Request, res: Response) {
  try {
    const faturadas = await Fatura.distinct('requisicao', { estado: { $ne: 'anulada' } })
    const requisicoes = await Requisicao.find({
      _id: { $nin: faturadas },
      estado: { $in: ['pendente', 'em_curso', 'concluida'] as const },
    })
      .select('numeroRequisicao utente utenteNome analises')
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ data: requisicoes })
  } catch {
    res.status(500).json({ message: 'Erro ao listar requisições' })
  }
}
