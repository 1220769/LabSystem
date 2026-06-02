import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export type UserRole =
  | 'administrador'
  | 'tecnico'
  | 'medico'
  | 'enfermeiro'
  | 'financeiro'
  | 'utente'

export type Action = 'create' | 'read' | 'update' | 'delete'

export type Module =
  | 'utentes'
  | 'requisicoes'
  | 'colheita'
  | 'analise'
  | 'validacao'
  | 'relatorios'
  | 'financeiro'
  | 'equipamentos'
  | 'analytics'
  | 'utilizadores'
  | 'config'

export const PERMISSIONS: Record<UserRole, Partial<Record<Module, Action[]>>> = {
  administrador: {
    utentes:      ['create','read','update','delete'],
    requisicoes:  ['create','read','update','delete'],
    colheita:     ['create','read','update','delete'],
    analise:      ['create','read','update','delete'],
    validacao:    ['create','read','update','delete'],
    relatorios:   ['create','read','update','delete'],
    financeiro:   ['create','read','update','delete'],
    equipamentos: ['create','read','update','delete'],
    analytics:    ['create','read','update','delete'],
    utilizadores: ['create','read','update','delete'],
    config:       ['create','read','update','delete'],
  },
  tecnico: {
    utentes:      ['read'],
    requisicoes:  ['create','read','update'],
    colheita:     ['create','read','update'],
    analise:      ['create','read','update'],
    validacao:    ['read','update'],
    equipamentos: ['create','read','update'],
    relatorios:   ['read'],
    analytics:    ['read'],
  },
  medico: {
    utentes:      ['create','read','update'],
    requisicoes:  ['create','read','update'],
    colheita:     ['read'],
    analise:      ['read'],
    validacao:    ['create','read','update'],
    relatorios:   ['create','read','update'],
    analytics:    ['read'],
  },
  enfermeiro: {
    utentes:      ['read','update'],
    requisicoes:  ['create','read'],
    colheita:     ['create','read','update'],
  },
  financeiro: {
    financeiro:   ['create','read','update','delete'],
    relatorios:   ['read'],
    analytics:    ['create','read','update'],
    utentes:      ['read'],
  },
  utente: {
    utentes:      ['read'],
    requisicoes:  ['read'],
    relatorios:   ['read'],
    financeiro:   ['read'],
  },
}

export interface IUser extends Document {
  nome: string
  email: string
  password: string
  role: UserRole
  ativo: boolean
  avatar?: string
  telefone?: string
  departamento?: string
  ultimoLogin?: Date
  utenteRef?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
  matchPassword(enteredPassword: string): Promise<boolean>
  hasPermission(module: Module, action: Action): boolean
}

const UserSchema = new Schema<IUser>(
  {
    nome:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true },
    password:     { type: String, required: true, minlength: 6 },
    role:         {
      type: String,
      enum: ['administrador','tecnico','medico','enfermeiro','financeiro','utente'],
      default: 'tecnico',
    },
    ativo:        { type: Boolean, default: true },
    avatar:       { type: String },
    telefone:     { type: String },
    departamento: { type: String },
    ultimoLogin:  { type: Date },
    utenteRef:    { type: Schema.Types.ObjectId, ref: 'Utente' },
  },
  { timestamps: true }
)

UserSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  return bcrypt.compare(enteredPassword, this.password)
}

UserSchema.methods.hasPermission = function (module: Module, action: Action): boolean {
  const perms = PERMISSIONS[this.role as UserRole]
  return perms[module]?.includes(action) ?? false
}

export default mongoose.model<IUser>('User', UserSchema)