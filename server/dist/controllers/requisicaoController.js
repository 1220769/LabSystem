"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = exports.cancelRequisicao = exports.updateRequisicao = exports.createRequisicao = exports.getRequisicaoById = exports.getRequisicoes = void 0;
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
const getRequisicoes = async (req, res) => {
    try {
        const { estado, search, urgente, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (estado && estado !== 'todas')
            filter.estado = estado;
        if (urgente === 'true')
            filter.urgente = true;
        if (search) {
            filter.$or = [
                { numeroRequisicao: { $regex: search, $options: 'i' } },
                { utenteNome: { $regex: search, $options: 'i' } },
                { medicoSolicitante: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Requisicao_1.default.countDocuments(filter);
        const requisicoes = await Requisicao_1.default.find(filter)
            .sort({ urgente: -1, createdAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        res.json({ data: requisicoes, total, page: +page, pages: Math.ceil(total / +limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter requisições', error: err });
    }
};
exports.getRequisicoes = getRequisicoes;
const getRequisicaoById = async (req, res) => {
    try {
        const r = await Requisicao_1.default.findById(req.params.id);
        if (!r)
            return res.status(404).json({ message: 'Requisição não encontrada' });
        res.json(r);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter requisição', error: err });
    }
};
exports.getRequisicaoById = getRequisicaoById;
const createRequisicao = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const count = await Requisicao_1.default.countDocuments({ numeroRequisicao: { $regex: `^REQ-${year}` } });
        const numeroRequisicao = `REQ-${year}-${String(count + 1).padStart(4, '0')}`;
        const requisicao = await Requisicao_1.default.create({
            ...req.body,
            numeroRequisicao,
            createdBy: req.user._id,
        });
        res.status(201).json(requisicao);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao criar requisição', error: err });
    }
};
exports.createRequisicao = createRequisicao;
const updateRequisicao = async (req, res) => {
    try {
        const allowed = ['urgente', 'prioridade', 'estado', 'observacoes', 'medicoSolicitante', 'analises', 'prescricaoRef'];
        const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const requisicao = await Requisicao_1.default.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!requisicao)
            return res.status(404).json({ message: 'Requisição não encontrada' });
        res.json(requisicao);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao actualizar requisição', error: err });
    }
};
exports.updateRequisicao = updateRequisicao;
const cancelRequisicao = async (req, res) => {
    try {
        const requisicao = await Requisicao_1.default.findByIdAndUpdate(req.params.id, { estado: 'cancelada' }, { new: true });
        if (!requisicao)
            return res.status(404).json({ message: 'Requisição não encontrada' });
        res.json({ message: 'Requisição cancelada', requisicao });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao cancelar requisição', error: err });
    }
};
exports.cancelRequisicao = cancelRequisicao;
const getStats = async (_req, res) => {
    try {
        const [pendente, em_curso, concluida, cancelada, urgentes] = await Promise.all([
            Requisicao_1.default.countDocuments({ estado: 'pendente' }),
            Requisicao_1.default.countDocuments({ estado: 'em_curso' }),
            Requisicao_1.default.countDocuments({ estado: 'concluida' }),
            Requisicao_1.default.countDocuments({ estado: 'cancelada' }),
            Requisicao_1.default.countDocuments({ estado: { $ne: 'cancelada' }, urgente: true }),
        ]);
        res.json({ pendente, em_curso, concluida, cancelada, urgentes });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter estatísticas', error: err });
    }
};
exports.getStats = getStats;
