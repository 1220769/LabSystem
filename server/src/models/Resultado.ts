import mongoose, { Document, Schema } from 'mongoose'

export type FlagResultado = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
export type EstadoResultado = 'pendente' | 'em_processamento' | 'resultado_disponivel'

export interface IResultado extends Document {
  codigoResultado: string
  amostra: mongoose.Types.ObjectId
  codigoAmostra: string
  requisicao: mongoose.Types.ObjectId
  requisicaoNumero: string
  utente: mongoose.Types.ObjectId
  utenteNome: string
  analise: { codigo: string; nome: string; categoria: string }
  equipamento?: string
  valor?: string
  unidade?: string
  refMin?: number
  refMax?: number
  flag: FlagResultado
  estado: EstadoResultado
  observacoes?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ResultadoSchema = new Schema<IResultado>(
  {
    codigoResultado:  { type: String, required: true, unique: true },
    amostra:          { type: Schema.Types.ObjectId, ref: 'Amostra', required: true },
    codigoAmostra:    { type: String, required: true },
    requisicao:       { type: Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero: { type: String, required: true },
    utente:           { type: Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome:       { type: String, required: true },
    analise: {
      codigo:    { type: String, required: true },
      nome:      { type: String, required: true },
      categoria: { type: String, required: true },
    },
    equipamento: { type: String },
    valor:       { type: String },
    unidade:     { type: String },
    refMin:      { type: Number },
    refMax:      { type: Number },
    flag:        { type: String, enum: ['pendente','normal','alto','baixo','critico_alto','critico_baixo'], default: 'pendente' },
    estado:      { type: String, enum: ['pendente','em_processamento','resultado_disponivel'], default: 'pendente' },
    observacoes: { type: String },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

ResultadoSchema.index({ estado: 1, createdAt: -1 })
ResultadoSchema.index({ amostra: 1 })
ResultadoSchema.index({ flag: 1 })

export default mongoose.model<IResultado>('Resultado', ResultadoSchema)
