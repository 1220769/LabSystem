import mongoose, { Schema } from 'mongoose'

const AnamneseSchema = new Schema(
  {
    utente: { type: Schema.Types.ObjectId, ref: 'Utente' },
    observacoes: { type: String, trim: true },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model('Anamnese', AnamneseSchema)
