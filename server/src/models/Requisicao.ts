import mongoose, { Document, Schema } from 'mongoose'

export interface IAnalise {
  codigo: string
  nome: string
  categoria: string
}

export interface IRequisicao extends Document {
  numeroRequisicao: string
  utente: mongoose.Types.ObjectId
  utenteNome: string
  utenteProcesso: string
  medicoSolicitante: string
  analises: IAnalise[]
  urgente: boolean
  prioridade: 'normal' | 'urgente' | 'stat'
  estado: 'pendente' | 'em_curso' | 'concluida' | 'cancelada'
  prescricaoRef?: string
  observacoes?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AnaliseSchema = new Schema<IAnalise>({
  codigo:    { type: String, required: true },
  nome:      { type: String, required: true },
  categoria: { type: String, required: true },
}, { _id: false })

const RequisicaoSchema = new Schema<IRequisicao>(
  {
    numeroRequisicao:  { type: String, required: true, unique: true },
    utente:            { type: Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome:        { type: String, required: true },
    utenteProcesso:    { type: String, required: true },
    medicoSolicitante: { type: String, required: true },
    analises:          {
      type: [AnaliseSchema],
      required: true,
      validate: [(a: IAnalise[]) => a.length > 0, 'Mínimo 1 análise'],
    },
    urgente:       { type: Boolean, default: false },
    prioridade:    { type: String, enum: ['normal','urgente','stat'], default: 'normal' },
    estado:        { type: String, enum: ['pendente','em_curso','concluida','cancelada'], default: 'pendente' },
    prescricaoRef: { type: String },
    observacoes:   { type: String },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

RequisicaoSchema.index({ estado: 1, createdAt: -1 })
RequisicaoSchema.index({ utente: 1 })

export default mongoose.model<IRequisicao>('Requisicao', RequisicaoSchema)
