import mongoose, { Schema, Document } from 'mongoose'

export interface IEquipamento extends Document {
  nome: string
  tipo: string
  numeroSerie: string
  fabricante?: string
  localizacao?: string
  estado: 'operacional' | 'manutencao' | 'avariado' | 'calibracao'
  dataUltimaCalibração?: Date
  proximaCalibração?: Date
  createdAt: Date
}

export interface IReagente extends Document {
  nome: string
  codigo: string
  lote: string
  validade: Date
  quantidadeAtual: number
  quantidadeMinima: number
  unidade: string
  fabricante?: string
  localizacao?: string
  createdAt: Date
}

export interface IManutencao extends Document {
  equipamento: mongoose.Types.ObjectId
  equipamentoNome: string
  tipo: 'preventiva' | 'corretiva'
  descricao: string
  tecnico: string
  data: Date
  duracaoHoras?: number
  resolvido: boolean
  createdAt: Date
}

const EquipamentoSchema = new Schema<IEquipamento>({
  nome:                { type: String, required: true },
  tipo:                { type: String, required: true },
  numeroSerie:         { type: String, required: true },
  fabricante:          { type: String },
  localizacao:         { type: String },
  estado:              { type: String, enum: ['operacional','manutencao','avariado','calibracao'], default: 'operacional' },
  dataUltimaCalibração:{ type: Date },
  proximaCalibração:   { type: Date },
}, { timestamps: true })

const ReagenteSchema = new Schema<IReagente>({
  nome:             { type: String, required: true },
  codigo:           { type: String, required: true },
  lote:             { type: String, required: true },
  validade:         { type: Date, required: true },
  quantidadeAtual:  { type: Number, required: true, default: 0 },
  quantidadeMinima: { type: Number, required: true, default: 0 },
  unidade:          { type: String, required: true, default: 'un' },
  fabricante:       { type: String },
  localizacao:      { type: String },
}, { timestamps: true })

const ManutencaoSchema = new Schema<IManutencao>({
  equipamento:     { type: Schema.Types.ObjectId, ref: 'Equipamento', required: true },
  equipamentoNome: { type: String, required: true },
  tipo:            { type: String, enum: ['preventiva','corretiva'], required: true },
  descricao:       { type: String, required: true },
  tecnico:         { type: String, required: true },
  data:            { type: Date, required: true, default: Date.now },
  duracaoHoras:    { type: Number },
  resolvido:       { type: Boolean, default: false },
}, { timestamps: true })

export const Equipamento = mongoose.model<IEquipamento>('Equipamento', EquipamentoSchema)
export const Reagente    = mongoose.model<IReagente>('Reagente', ReagenteSchema)
export const Manutencao  = mongoose.model<IManutencao>('Manutencao', ManutencaoSchema)
