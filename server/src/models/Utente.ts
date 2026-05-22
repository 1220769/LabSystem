import mongoose, { Document, Schema } from 'mongoose'

export interface IUtente extends Document {
  numeroProcesso: string
  nome: string
  dataNascimento: Date
  genero: 'masculino' | 'feminino' | 'outro'
  nif: string
  sns: string
  contacto: string
  email?: string
  morada: {
    rua: string
    codigoPostal: string
    localidade: string
  }
  medico?: string
  observacoes?: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

const UtenteSchema = new Schema<IUtente>(
  {
    numeroProcesso: { type: String, required: true, unique: true },
    nome:           { type: String, required: true, trim: true },
    dataNascimento: { type: Date, required: true },
    genero:         { type: String, enum: ['masculino','feminino','outro'], required: true },
    nif:            { type: String, required: true, unique: true },
    sns:            { type: String, required: true, unique: true },
    contacto:       { type: String, required: true },
    email:          { type: String, lowercase: true },
    morada: {
      rua:          { type: String, required: true },
      codigoPostal: { type: String, required: true },
      localidade:   { type: String, required: true },
    },
    medico:       { type: String },
    observacoes:  { type: String },
    ativo:        { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model<IUtente>('Utente', UtenteSchema)