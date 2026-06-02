import { Request, Response } from 'express'

export const getAnamneses = async (_req: Request, res: Response) => {
  res.json({ data: [], message: 'Modulo de anamnese preparado para implementacao.' })
}
