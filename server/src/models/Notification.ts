import mongoose, { Document, Schema } from 'mongoose'

export type NotifTipo = 'resultado' | 'critico' | 'requisicao' | 'fatura'

export interface INotification extends Document {
  user:      mongoose.Types.ObjectId
  tipo:      NotifTipo
  titulo:    string
  mensagem:  string
  lida:      boolean
  link?:     string
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    user:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tipo:     { type: String, enum: ['resultado','critico','requisicao','fatura'], required: true },
    titulo:   { type: String, required: true },
    mensagem: { type: String, required: true },
    lida:     { type: Boolean, default: false },
    link:     { type: String },
  },
  { timestamps: true }
)

export default mongoose.model<INotification>('Notification', NotificationSchema)
