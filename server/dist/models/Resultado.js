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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const AssinaturaSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    nome: { type: String, required: true },
    dataHora: { type: Date, required: true },
    observacoes: { type: String },
}, { _id: false });
const ResultadoSchema = new mongoose_1.Schema({
    codigoResultado: { type: String, required: true, unique: true },
    amostra: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Amostra', required: true },
    codigoAmostra: { type: String, required: true },
    requisicao: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero: { type: String, required: true },
    utente: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome: { type: String, required: true },
    analise: {
        codigo: { type: String, required: true },
        nome: { type: String, required: true },
        categoria: { type: String, required: true },
    },
    equipamento: { type: String },
    valor: { type: String },
    unidade: { type: String },
    refMin: { type: Number },
    refMax: { type: Number },
    flag: { type: String, enum: ['pendente', 'normal', 'alto', 'baixo', 'critico_alto', 'critico_baixo'], default: 'pendente' },
    estado: { type: String, enum: ['pendente', 'em_processamento', 'resultado_disponivel', 'validado_tecnico', 'validado_medico'], default: 'pendente' },
    observacoes: { type: String },
    validacaoTecnica: { type: AssinaturaSchema },
    validacaoMedica: { type: AssinaturaSchema },
    relatorioEmitido: { type: Boolean, default: false },
    relatorioDataHora: { type: Date },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
ResultadoSchema.index({ estado: 1, createdAt: -1 });
ResultadoSchema.index({ amostra: 1 });
ResultadoSchema.index({ flag: 1 });
exports.default = mongoose_1.default.model('Resultado', ResultadoSchema);
