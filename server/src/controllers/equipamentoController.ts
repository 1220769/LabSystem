import { Request, Response } from 'express'
import { Equipamento, Reagente, Manutencao } from '../models/Equipamento'

/* ── Equipamentos ── */
export const getEquipamentos = async (_req: Request, res: Response) => {
  try {
    const data = await Equipamento.find().sort({ nome: 1 })
    res.json({ data, total: data.length })
  } catch { res.status(500).json({ message: 'Erro ao obter equipamentos' }) }
}

export const createEquipamento = async (req: Request, res: Response) => {
  try {
    const eq = await Equipamento.create(req.body)
    res.status(201).json(eq)
  } catch { res.status(500).json({ message: 'Erro ao criar equipamento' }) }
}

export const updateEquipamento = async (req: Request, res: Response) => {
  try {
    const eq = await Equipamento.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!eq) return res.status(404).json({ message: 'Não encontrado' })
    res.json(eq)
  } catch { res.status(500).json({ message: 'Erro ao actualizar' }) }
}

/* ── Reagentes ── */
export const getReagentes = async (_req: Request, res: Response) => {
  try {
    const data = await Reagente.find().sort({ nome: 1 })
    const alertas = data.filter(r => r.quantidadeAtual <= r.quantidadeMinima).length
    res.json({ data, total: data.length, alertas })
  } catch { res.status(500).json({ message: 'Erro ao obter reagentes' }) }
}

export const createReagente = async (req: Request, res: Response) => {
  try {
    const r = await Reagente.create(req.body)
    res.status(201).json(r)
  } catch { res.status(500).json({ message: 'Erro ao criar reagente' }) }
}

export const updateReagente = async (req: Request, res: Response) => {
  try {
    const r = await Reagente.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!r) return res.status(404).json({ message: 'Não encontrado' })
    res.json(r)
  } catch { res.status(500).json({ message: 'Erro ao actualizar' }) }
}

/* ── Manutenção ── */
export const getManutencoes = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {}
    if (req.query.equipamento) filter.equipamento = req.query.equipamento
    const data = await Manutencao.find(filter).sort({ data: -1 }).limit(50)
    res.json({ data, total: data.length })
  } catch { res.status(500).json({ message: 'Erro ao obter manutenções' }) }
}

export const createManutencao = async (req: Request, res: Response) => {
  try {
    const m = await Manutencao.create(req.body)
    if (req.body.tipo === 'corretiva') {
      await Equipamento.findByIdAndUpdate(req.body.equipamento, { estado: 'manutencao' })
    }
    res.status(201).json(m)
  } catch { res.status(500).json({ message: 'Erro ao registar manutenção' }) }
}

export const resolverManutencao = async (req: Request, res: Response) => {
  try {
    const m = await Manutencao.findByIdAndUpdate(req.params.id, { resolvido: true }, { new: true })
    if (!m) return res.status(404).json({ message: 'Não encontrado' })
    await Equipamento.findByIdAndUpdate(m.equipamento, { estado: 'operacional' })
    res.json(m)
  } catch { res.status(500).json({ message: 'Erro ao resolver' }) }
}

/* ── Stats ── */
export const getStats = async (_req: Request, res: Response) => {
  try {
    const [eqs, reagentes, manut] = await Promise.all([
      Equipamento.find(),
      Reagente.find(),
      Manutencao.find({ resolvido: false }),
    ])
    const proximaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    res.json({
      operacionais:      eqs.filter(e => e.estado === 'operacional').length,
      emManutencao:      eqs.filter(e => e.estado === 'manutencao' || e.estado === 'avariado').length,
      calibracoesBreve:  eqs.filter(e => e.proximaCalibração && e.proximaCalibração <= proximaSemana).length,
      reagentesAlerta:   reagentes.filter(r => r.quantidadeAtual <= r.quantidadeMinima).length,
      manutencoesPendentes: manut.length,
    })
  } catch { res.status(500).json({ message: 'Erro' }) }
}
