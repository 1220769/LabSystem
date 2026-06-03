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
const TuboSchema = new mongoose_1.Schema({
    tipo: { type: String, enum: ['edta', 'citrato', 'gel', 'heparina', 'urina', 'outro'], required: true },
    analises: [{ type: String }],
    coletado: { type: Boolean, default: false },
}, { _id: false });
const AmostraSchema = new mongoose_1.Schema({
    codigoAmostra: { type: String, required: true, unique: true },
    requisicao: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Requisicao', required: true },
    requisicaoNumero: { type: String, required: true },
    utente: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Utente', required: true },
    utenteNome: { type: String, required: true },
    utenteProcesso: { type: String, required: true },
    tubos: { type: [TuboSchema], required: true },
    tipoColheita: { type: String, enum: ['presencial', 'domiciliaria'], default: 'presencial' },
    moradaColheita: { type: String },
    dataHoraColheita: { type: Date },
    tecnico: { type: String },
    temperatura: { type: Number },
    estado: { type: String, enum: ['aguarda_colheita', 'colhida', 'em_transito', 'recebida', 'rejeitada'], default: 'aguarda_colheita' },
    motivoRejeicao: { type: String },
    observacoes: { type: String },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
AmostraSchema.index({ estado: 1, createdAt: -1 });
AmostraSchema.index({ requisicao: 1 });
exports.default = mongoose_1.default.model('Amostra', AmostraSchema);
