"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerfil = getPerfil;
exports.getRequisicoes = getRequisicoes;
exports.getResultados = getResultados;
exports.updatePerfil = updatePerfil;
exports.getResultadosByRequisicao = getResultadosByRequisicao;
exports.getFaturas = getFaturas;
exports.linkUtente = linkUtente;
exports.getSummary = getSummary;
const Utente_1 = __importDefault(require("../models/Utente"));
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
const Resultado_1 = __importDefault(require("../models/Resultado"));
const Fatura_1 = __importDefault(require("../models/Fatura"));
const User_1 = __importDefault(require("../models/User"));
function utenteId(req) {
    return req.user?.utenteRef;
}
async function getPerfil(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.status(404).json({ message: 'Sem registo de utente associado a esta conta' });
        const utente = await Utente_1.default.findById(id);
        if (!utente)
            return res.status(404).json({ message: 'Utente não encontrado' });
        res.json(utente);
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter perfil' });
    }
}
async function getRequisicoes(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.json({ data: [], total: 0 });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 10;
        const total = await Requisicao_1.default.countDocuments({ utente: id });
        const data = await Requisicao_1.default.find({ utente: id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        res.json({ data, total, page, pages: Math.ceil(total / limit) });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter requisições' });
    }
}
async function getResultados(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.json({ data: [], total: 0 });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 20;
        const flagFilter = req.query.flagFilter;
        const flagCondition = { estado: 'validado_medico' };
        if (flagFilter === 'normal')
            flagCondition.flag = 'normal';
        if (flagFilter === 'alterado')
            flagCondition.flag = { $in: ['alto', 'baixo'] };
        if (flagFilter === 'critico')
            flagCondition.flag = { $in: ['critico_alto', 'critico_baixo'] };
        const filter = { utente: id, ...flagCondition };
        const total = await Resultado_1.default.countDocuments(filter);
        const data = await Resultado_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        res.json({ data, total, page, pages: Math.ceil(total / limit) });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter resultados' });
    }
}
async function updatePerfil(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.status(404).json({ message: 'Sem registo clínico associado' });
        const allowed = ['contacto', 'email', 'morada', 'medico'];
        const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const utente = await Utente_1.default.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        if (!utente)
            return res.status(404).json({ message: 'Utente não encontrado' });
        res.json(utente);
    }
    catch {
        res.status(500).json({ message: 'Erro ao actualizar perfil' });
    }
}
async function getResultadosByRequisicao(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.json({ data: [] });
        const data = await Resultado_1.default.find({
            utente: id,
            requisicaoNumero: req.params.reqNumero,
            estado: 'validado_medico',
        }).sort({ 'analise.categoria': 1 });
        res.json({ data });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter resultados' });
    }
}
async function getFaturas(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.json({ data: [], total: 0 });
        const total = await Fatura_1.default.countDocuments({ utente: id, estado: { $ne: 'anulada' } });
        const data = await Fatura_1.default.find({ utente: id, estado: { $ne: 'anulada' } })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ data, total });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter faturas' });
    }
}
async function linkUtente(req, res) {
    try {
        const { nif, sns } = req.body;
        if (!nif && !sns)
            return res.status(400).json({ message: 'Indique NIF ou Nº SNS' });
        const filter = {};
        if (nif)
            filter.nif = nif.trim();
        else if (sns)
            filter.sns = sns.trim();
        const utente = await Utente_1.default.findOne(filter);
        if (!utente)
            return res.status(404).json({ message: 'Nenhum registo clínico encontrado com esses dados' });
        await User_1.default.findByIdAndUpdate(req.user._id, { utenteRef: utente._id });
        res.json({ message: 'Conta ligada com sucesso', utente: { nome: utente.nome, sns: utente.sns } });
    }
    catch {
        res.status(500).json({ message: 'Erro ao ligar conta' });
    }
}
async function getSummary(req, res) {
    try {
        const id = utenteId(req);
        if (!id)
            return res.json({ requisicoes: 0, resultados: 0, faturasPendentes: 0, criticos: 0 });
        const [requisicoes, resultados, faturasPendentes, criticos] = await Promise.all([
            Requisicao_1.default.countDocuments({ utente: id }),
            Resultado_1.default.countDocuments({ utente: id, estado: 'validado_medico' }),
            Fatura_1.default.countDocuments({ utente: id, estado: 'emitida' }),
            Resultado_1.default.countDocuments({ utente: id, flag: { $in: ['critico_alto', 'critico_baixo'] }, estado: 'validado_medico' }),
        ]);
        res.json({ requisicoes, resultados, faturasPendentes, criticos });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter resumo' });
    }
}
