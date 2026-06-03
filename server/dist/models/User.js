"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.PERMISSIONS = {
    administrador: {
        utentes: ['create', 'read', 'update', 'delete'],
        requisicoes: ['create', 'read', 'update', 'delete'],
        colheita: ['create', 'read', 'update', 'delete'],
        analise: ['create', 'read', 'update', 'delete'],
        validacao: ['create', 'read', 'update', 'delete'],
        relatorios: ['create', 'read', 'update', 'delete'],
        financeiro: ['create', 'read', 'update', 'delete'],
        equipamentos: ['create', 'read', 'update', 'delete'],
        analytics: ['create', 'read', 'update', 'delete'],
        utilizadores: ['create', 'read', 'update', 'delete'],
        config: ['create', 'read', 'update', 'delete'],
    },
    tecnico: {
        utentes: ['read'],
        requisicoes: ['create', 'read', 'update'],
        colheita: ['create', 'read', 'update'],
        analise: ['create', 'read', 'update'],
        validacao: ['read', 'update'],
        equipamentos: ['create', 'read', 'update'],
        relatorios: ['read'],
        analytics: ['read'],
    },
    medico: {
        utentes: ['create', 'read', 'update'],
        requisicoes: ['create', 'read', 'update'],
        colheita: ['read'],
        analise: ['read'],
        validacao: ['create', 'read', 'update'],
        relatorios: ['create', 'read', 'update'],
        analytics: ['read'],
    },
    enfermeiro: {
        utentes: ['read', 'update'],
        requisicoes: ['create', 'read'],
        colheita: ['create', 'read', 'update'],
    },
    financeiro: {
        utentes: ['read'],
        requisicoes: ['read'],
        financeiro: ['create', 'read', 'update'],
        relatorios: ['read'],
        analytics: ['read'],
    },
    utente: {
        utentes: ['read'],
        requisicoes: ['read'],
        relatorios: ['read'],
        financeiro: ['read'],
    },
};
const UserSchema = new mongoose_1.Schema({
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
        type: String,
        enum: ['administrador', 'tecnico', 'medico', 'enfermeiro', 'financeiro', 'utente'],
        default: 'tecnico',
    },
    ativo: { type: Boolean, default: true },
    avatar: { type: String },
    telefone: { type: String },
    departamento: { type: String },
    ultimoLogin: { type: Date },
    utenteRef: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Utente' },
}, { timestamps: true });
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return bcryptjs_1.default.compare(enteredPassword, this.password);
};
UserSchema.methods.hasPermission = function (module, action) {
    const perms = exports.PERMISSIONS[this.role];
    return perms[module]?.includes(action) ?? false;
};
exports.default = mongoose_1.default.model('User', UserSchema);
