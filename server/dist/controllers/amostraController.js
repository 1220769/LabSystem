"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = exports.updateAmostra = exports.createAmostra = exports.getAmostraById = exports.getAmostras = void 0;
const Amostra_1 = __importDefault(require("../models/Amostra"));
const Resultado_1 = __importDefault(require("../models/Resultado"));
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
const getAmostras = async (req, res) => {
    try {
        const { estado, tipoColheita, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (estado && estado !== 'todas')
            filter.estado = estado;
        if (tipoColheita && tipoColheita !== 'todas')
            filter.tipoColheita = tipoColheita;
        if (search) {
            filter.$or = [
                { codigoAmostra: { $regex: search, $options: 'i' } },
                { utenteNome: { $regex: search, $options: 'i' } },
                { requisicaoNumero: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Amostra_1.default.countDocuments(filter);
        const amostras = await Amostra_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        res.json({ data: amostras, total, page: +page, pages: Math.ceil(total / +limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter amostras', error: err });
    }
};
exports.getAmostras = getAmostras;
const getAmostraById = async (req, res) => {
    try {
        const amostra = await Amostra_1.default.findById(req.params.id);
        if (!amostra)
            return res.status(404).json({ message: 'Amostra não encontrada' });
        res.json(amostra);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter amostra', error: err });
    }
};
exports.getAmostraById = getAmostraById;
const createAmostra = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const count = await Amostra_1.default.countDocuments({ codigoAmostra: { $regex: `^AM-${year}` } });
        const codigoAmostra = `AM-${year}-${String(count + 1).padStart(4, '0')}`;
        const amostra = await Amostra_1.default.create({
            ...req.body,
            codigoAmostra,
            createdBy: req.user._id,
        });
        // requisição passa a em_curso quando a amostra é registada
        await Requisicao_1.default.findByIdAndUpdate(req.body.requisicao, { estado: 'em_curso' }).catch(() => { });
        res.status(201).json(amostra);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao criar amostra', error: err });
    }
};
exports.createAmostra = createAmostra;
async function gerarWorklistAutomatico(amostraId, userId) {
    const amostra = await Amostra_1.default.findById(amostraId);
    if (!amostra)
        return;
    const requisicao = await Requisicao_1.default.findById(amostra.requisicao);
    if (!requisicao)
        return;
    const year = new Date().getFullYear();
    for (const analise of requisicao.analises) {
        const existe = await Resultado_1.default.findOne({ amostra: amostra._id, 'analise.codigo': analise.codigo });
        if (existe)
            continue;
        const count = await Resultado_1.default.countDocuments({ codigoResultado: { $regex: `^RES-${year}` } });
        await Resultado_1.default.create({
            codigoResultado: `RES-${year}-${String(count + 1).padStart(4, '0')}`,
            amostra: amostra._id,
            codigoAmostra: amostra.codigoAmostra,
            requisicao: requisicao._id,
            requisicaoNumero: requisicao.numeroRequisicao,
            utente: amostra.utente,
            utenteNome: amostra.utenteNome,
            analise,
            flag: 'pendente',
            estado: 'pendente',
            createdBy: userId,
        });
    }
}
const updateAmostra = async (req, res) => {
    try {
        const allowed = ['estado', 'tubos', 'tecnico', 'temperatura', 'dataHoraColheita', 'motivoRejeicao', 'observacoes'];
        const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const anterior = await Amostra_1.default.findById(req.params.id).select('estado');
        const amostra = await Amostra_1.default.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!amostra)
            return res.status(404).json({ message: 'Amostra não encontrada' });
        // ponto 1: receber amostra → gerar worklist automaticamente
        if (update.estado === 'recebida' && anterior?.estado !== 'recebida') {
            gerarWorklistAutomatico(String(amostra._id), req.user._id).catch(() => { });
        }
        res.json(amostra);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao actualizar amostra', error: err });
    }
};
exports.updateAmostra = updateAmostra;
const getStats = async (_req, res) => {
    try {
        const [aguarda, colhida, em_transito, recebida, domiciliarias] = await Promise.all([
            Amostra_1.default.countDocuments({ estado: 'aguarda_colheita' }),
            Amostra_1.default.countDocuments({ estado: 'colhida' }),
            Amostra_1.default.countDocuments({ estado: 'em_transito' }),
            Amostra_1.default.countDocuments({ estado: 'recebida' }),
            Amostra_1.default.countDocuments({ tipoColheita: 'domiciliaria', estado: { $in: ['aguarda_colheita', 'colhida', 'em_transito'] } }),
        ]);
        res.json({ aguarda, colhida, em_transito, recebida, domiciliarias });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter estatísticas', error: err });
    }
};
exports.getStats = getStats;
