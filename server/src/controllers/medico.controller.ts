import { Request, Response } from 'express'

export const getMedicos = async (_req: Request, res: Response) => {
  res.json({ data: [], message: 'Modulo de medicos preparado para implementacao.' })
}
