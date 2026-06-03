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
const LinhaFaturaSchema = new mongoose_1.Schema({
    codigo: { type: String, required: true },
    descricao: { type: String, required: true },
    preco: { type: Number, required: true },
}, { _id: false });
const FaturaSchema = new mongoose_1.Schema({
    numeroFatura: { type: String, required: true, unique: true },
    requisicao: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero: { type: String, required: true },
    utente: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome: { type: String, required: true },
    tipo: { type: String, enum: ['particular', 'sns', 'seguradora'], required: true },
    seguradora: { type: String },
    linhas: { type: [LinhaFaturaSchema], default: [] },
    valorBruto: { type: Number, required: true, default: 0 },
    percentComparticipacao: { type: Number, required: true, default: 0 },
    valorComparticipado: { type: Number, required: true, default: 0 },
    valorLiquido: { type: Number, required: true, default: 0 },
    estado: { type: String, enum: ['rascunho', 'emitida', 'paga', 'anulada'], default: 'rascunho' },
    referenciaPagamento: { type: String },
    observacoes: { type: String },
    dataEmissao: { type: Date },
    dataPagamento: { type: Date },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
FaturaSchema.index({ estado: 1, createdAt: -1 });
FaturaSchema.index({ utente: 1 });
FaturaSchema.index({ requisicao: 1 });
exports.default = mongoose_1.default.model('Fatura', FaturaSchema);
