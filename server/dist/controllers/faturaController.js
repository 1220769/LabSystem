"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFaturas = getFaturas;
exports.getFaturaById = getFaturaById;
exports.createFatura = createFatura;
exports.updateFatura = updateFatura;
exports.getStats = getStats;
exports.getRequisicoesSemFatura = getRequisicoesSemFatura;
const Fatura_1 = __importDefault(require("../models/Fatura"));
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
function nextNumero(last, prefix) {
    if (!last)
        return `${prefix}-${new Date().getFullYear()}-0001`;
    const parts = last.split('-');
    const n = parseInt(parts[parts.length - 1], 10) + 1;
    return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}
async function getFaturas(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const estado = req.query.estado;
        const search = req.query.search;
        const filter = {};
        if (estado && estado !== 'todas')
            filter.estado = estado;
        if (search) {
            filter.$or = [
                { numeroFatura: { $regex: search, $options: 'i' } },
                { utenteNome: { $regex: search, $options: 'i' } },
                { requisicaoNumero: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Fatura_1.default.countDocuments(filter);
        const faturas = await Fatura_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        res.json({ data: faturas, total, page, pages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao listar faturas' });
    }
}
async function getFaturaById(req, res) {
    try {
        const fatura = await Fatura_1.default.findById(req.params.id);
        if (!fatura)
            return res.status(404).json({ message: 'Fatura não encontrada' });
        res.json(fatura);
    }
    catch {
        res.status(500).json({ message: 'Erro ao buscar fatura' });
    }
}
async function createFatura(req, res) {
    try {
        const last = await Fatura_1.default.findOne().sort({ createdAt: -1 }).select('numeroFatura');
        const numeroFatura = nextNumero(last?.numeroFatura ?? null, 'FAT');
        const fatura = new Fatura_1.default({
            ...req.body,
            numeroFatura,
            createdBy: req.user._id,
        });
        await fatura.save();
        res.status(201).json(fatura);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar fatura';
        res.status(400).json({ message: msg });
    }
}
async function updateFatura(req, res) {
    try {
        const fatura = await Fatura_1.default.findById(req.params.id);
        if (!fatura)
            return res.status(404).json({ message: 'Fatura não encontrada' });
        if (fatura.estado === 'anulada')
            return res.status(400).json({ message: 'Fatura anulada não pode ser alterada' });
        const { estado } = req.body;
        if (estado === 'emitida' && fatura.estado === 'rascunho') {
            fatura.estado = 'emitida';
            fatura.dataEmissao = new Date();
        }
        else if (estado === 'paga' && fatura.estado === 'emitida') {
            fatura.estado = 'paga';
            fatura.dataPagamento = new Date();
            if (req.body.referenciaPagamento)
                fatura.referenciaPagamento = req.body.referenciaPagamento;
        }
        else if (estado === 'anulada') {
            fatura.estado = 'anulada';
        }
        else {
            const allowed = ['linhas', 'valorBruto', 'percentComparticipacao', 'valorComparticipado', 'valorLiquido', 'observacoes', 'tipo', 'seguradora'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    fatura[key] = req.body[key];
            }
        }
        await fatura.save();
        res.json(fatura);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao atualizar fatura';
        res.status(400).json({ message: msg });
    }
}
async function getStats(_req, res) {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const [faturacaoMes, recebidoMes, porEstado] = await Promise.all([
            Fatura_1.default.aggregate([
                { $match: { createdAt: { $gte: start }, estado: { $ne: 'anulada' } } },
                { $group: { _id: null, total: { $sum: '$valorLiquido' } } },
            ]),
            Fatura_1.default.aggregate([
                { $match: { estado: 'paga', dataPagamento: { $gte: start } } },
                { $group: { _id: null, total: { $sum: '$valorLiquido' } } },
            ]),
            Fatura_1.default.aggregate([
                { $group: { _id: '$estado', count: { $sum: 1 }, valor: { $sum: '$valorLiquido' } } },
            ]),
        ]);
        res.json({
            faturacaoMes: faturacaoMes[0]?.total ?? 0,
            recebidoMes: recebidoMes[0]?.total ?? 0,
            porEstado,
        });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter estatísticas' });
    }
}
async function getRequisicoesSemFatura(_req, res) {
    try {
        const faturadas = await Fatura_1.default.distinct('requisicao', { estado: { $ne: 'anulada' } });
        const requisicoes = await Requisicao_1.default.find({
            _id: { $nin: faturadas },
            estado: { $in: ['pendente', 'em_curso', 'concluida'] },
        })
            .select('numeroRequisicao utente utenteNome analises')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ data: requisicoes });
    }
    catch {
        res.status(500).json({ message: 'Erro ao listar requisições' });
    }
}
