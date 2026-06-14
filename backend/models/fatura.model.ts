import mongoose, { Document, Schema } from 'mongoose'

export type TipoFatura   = 'particular' | 'sns' | 'seguradora'
export type EstadoFatura = 'rascunho' | 'emitida' | 'paga' | 'anulada'

export interface ILinhaFatura {
  codigo: string
  descricao: string
  preco: number
}

export interface IFatura extends Document {
  numeroFatura: string
  requisicao: mongoose.Types.ObjectId
  requisicaoNumero: string
  utente: mongoose.Types.ObjectId
  utenteNome: string
  tipo: TipoFatura
  seguradora?: string
  linhas: ILinhaFatura[]
  valorBruto: number
  percentComparticipacao: number
  valorComparticipado: number
  valorLiquido: number
  estado: EstadoFatura
  referenciaPagamento?: string
  observacoes?: string
  dataEmissao?: Date
  dataPagamento?: Date
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const LinhaFaturaSchema = new Schema<ILinhaFatura>(
  {
    codigo:    { type: String, required: true },
    descricao: { type: String, required: true },
    preco:     { type: Number, required: true },
  },
  { _id: false }
)

const FaturaSchema = new Schema<IFatura>(
  {
    numeroFatura:           { type: String, required: true, unique: true },
    requisicao:             { type: Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero:       { type: String, required: true },
    utente:                 { type: Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome:             { type: String, required: true },
    tipo:                   { type: String, enum: ['particular','sns','seguradora'], required: true },
    seguradora:             { type: String },
    linhas:                 { type: [LinhaFaturaSchema], default: [] },
    valorBruto:             { type: Number, required: true, default: 0 },
    percentComparticipacao: { type: Number, required: true, default: 0 },
    valorComparticipado:    { type: Number, required: true, default: 0 },
    valorLiquido:           { type: Number, required: true, default: 0 },
    estado:                 { type: String, enum: ['rascunho','emitida','paga','anulada'], default: 'rascunho' },
    referenciaPagamento:    { type: String },
    observacoes:            { type: String },
    dataEmissao:            { type: Date },
    dataPagamento:          { type: Date },
    createdBy:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

FaturaSchema.index({ estado: 1, createdAt: -1 })
FaturaSchema.index({ utente: 1 })
FaturaSchema.index({ requisicao: 1 })

export default mongoose.model<IFatura>('Fatura', FaturaSchema)
