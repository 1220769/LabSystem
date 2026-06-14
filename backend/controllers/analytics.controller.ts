import { Response } from 'express'
import { AuthRequest as Request } from '../middleWare/authMiddleware'
import Requisicao from '../models/requisicao.model'
import Amostra    from '../models/amostra.model'
import Resultado  from '../models/resultado.model'
import Fatura     from '../models/fatura.model'

export async function getDashboard(_req: Request, res: Response) {
  try {
    const now   = new Date()
    const hoje  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const semana = new Date(hoje); semana.setDate(hoje.getDate() - 7)
    const mes    = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      reqHoje, reqSemana, reqMes,
      amostrasHoje, amostrasEstado,
      resultadoFlag, resultadoCategoria,
      validadosHoje, criticosPorValidar,
      topAnalises,
      finEstado,
      pipeline,
      requisicoesPorDia,
    ] = await Promise.all([
      Requisicao.countDocuments({ createdAt: { $gte: hoje } }),
      Requisicao.countDocuments({ createdAt: { $gte: semana } }),
      Requisicao.countDocuments({ createdAt: { $gte: mes } }),
      Amostra.countDocuments({ createdAt: { $gte: hoje } }),
      Amostra.aggregate([{ $group: { _id: '$estado', count: { $sum: 1 } } }]),
      Resultado.aggregate([{ $group: { _id: '$flag', count: { $sum: 1 } } }]),
      Resultado.aggregate([{ $group: { _id: '$analise.categoria', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Resultado.countDocuments({
        estado: { $in: ['validado_tecnico','validado_medico'] },
        updatedAt: { $gte: hoje },
      }),
      Resultado.countDocuments({
        flag: { $in: ['critico_alto','critico_baixo'] },
        estado: { $nin: ['validado_tecnico','validado_medico'] },
      }),
      Resultado.aggregate([
        { $group: { _id: '$analise.codigo', nome: { $first: '$analise.nome' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Fatura.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 }, valor: { $sum: '$valorLiquido' } } },
      ]),
      Resultado.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 } } },
      ]),
      Requisicao.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 86400_000) } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
    ])

    res.json({
      requisicoes: { hoje: reqHoje, semana: reqSemana, mes: reqMes },
      amostras:    { hoje: amostrasHoje, porEstado: amostrasEstado },
      resultados:  {
        porFlag: resultadoFlag,
        porCategoria: resultadoCategoria,
        validadosHoje,
        criticosPorValidar,
      },
      topAnalises,
      financeiro: finEstado,
      pipeline,
      requisicoesPorDia,
    })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao gerar dashboard' })
  }
}
