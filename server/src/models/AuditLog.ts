import mongoose, { Schema, Document } from 'mongoose'

export interface IAuditLog extends Document {
  utilizador: string
  utilizadorId?: mongoose.Types.ObjectId
  acao: string
  modulo: string
  detalhe?: string
  ip?: string
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>({
  utilizador:   { type: String, required: true },
  utilizadorId: { type: Schema.Types.ObjectId, ref: 'User' },
  acao:         { type: String, required: true },
  modulo:       { type: String, required: true },
  detalhe:      { type: String },
  ip:           { type: String },
}, { timestamps: true })

AuditLogSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.__v; return ret }
})

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
