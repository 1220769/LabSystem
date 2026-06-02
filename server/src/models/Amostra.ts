import mongoose, { Document, Schema } from 'mongoose'

export type TipoTubo = 'edta' | 'citrato' | 'gel' | 'heparina' | 'urina' | 'outro'
export type EstadoAmostra = 'aguarda_colheita' | 'colhida' | 'em_transito' | 'recebida' | 'rejeitada'
export type TipoColheita = 'presencial' | 'domiciliaria'

export interface ITubo {
  tipo: TipoTubo
  analises: string[]
  coletado: boolean
}

export interface IAmostra extends Document {
  codigoAmostra: string
  requisicao: mongoose.Types.ObjectId
  requisicaoNumero: string
  utente: mongoose.Types.ObjectId
  utenteNome: string
  utenteProcesso: string
  tubos: ITubo[]
  tipoColheita: TipoColheita
  moradaColheita?: string
  dataHoraColheita?: Date
  tecnico?: string
  temperatura?: number
  estado: EstadoAmostra
  motivoRejeicao?: string
  observacoes?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const TuboSchema = new Schema<ITubo>({
  tipo:     { type: String, enum: ['edta','citrato','gel','heparina','urina','outro'], required: true },
  analises: [{ type: String }],
  coletado: { type: Boolean, default: false },
}, { _id: false })

const AmostraSchema = new Schema<IAmostra>(
  {
    codigoAmostra:    { type: String, required: true, unique: true },
    requisicao:       { type: Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero: { type: String, required: true },
    utente:           { type: Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome:       { type: String, required: true },
    utenteProcesso:   { type: String, required: true },
    tubos:            { type: [TuboSchema], required: true },
    tipoColheita:     { type: String, enum: ['presencial','domiciliaria'], default: 'presencial' },
    moradaColheita:   { type: String },
    dataHoraColheita: { type: Date },
    tecnico:          { type: String },
    temperatura:      { type: Number },
    estado:           { type: String, enum: ['aguarda_colheita','colhida','em_transito','recebida','rejeitada'], default: 'aguarda_colheita' },
    motivoRejeicao:   { type: String },
    observacoes:      { type: String },
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

AmostraSchema.index({ estado: 1, createdAt: -1 })
AmostraSchema.index({ requisicao: 1 })

export default mongoose.model<IAmostra>('Amostra', AmostraSchema)
