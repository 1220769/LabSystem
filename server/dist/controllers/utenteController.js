"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUtente = exports.updateUtente = exports.createUtente = exports.getUtenteById = exports.getUtentes = void 0;
const Utente_1 = __importDefault(require("../models/Utente"));
// GET /api/utentes
const getUtentes = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const filter = { ativo: true };
        if (search) {
            filter.$or = [
                { nome: { $regex: search, $options: 'i' } },
                { numeroProcesso: { $regex: search, $options: 'i' } },
                { nif: { $regex: search, $options: 'i' } },
                { sns: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Utente_1.default.countDocuments(filter);
        const utentes = await Utente_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        res.json({ data: utentes, total, page: +page, pages: Math.ceil(total / +limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter utentes', error: err });
    }
};
exports.getUtentes = getUtentes;
// GET /api/utentes/:id
const getUtenteById = async (req, res) => {
    try {
        const utente = await Utente_1.default.findById(req.params.id);
        if (!utente)
            return res.status(404).json({ message: 'Utente não encontrado' });
        res.json(utente);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter utente', error: err });
    }
};
exports.getUtenteById = getUtenteById;
// POST /api/utentes
const createUtente = async (req, res) => {
    try {
        const utente = await Utente_1.default.create(req.body);
        res.status(201).json(utente);
    }
    catch (err) {
        if (err.code === 11000) {
            const campo = Object.keys(err.keyPattern)[0];
            const label = { nif: 'NIF', sns: 'Nº SNS', numeroProcesso: 'Nº processo' };
            return res.status(400).json({ message: `${label[campo] ?? campo} já existe na base de dados` });
        }
        if (err.name === 'ValidationError') {
            const msgs = Object.values(err.errors).map((e) => e.message).join('; ');
            return res.status(400).json({ message: msgs });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: `Campo inválido: ${err.path}` });
        }
        res.status(500).json({ message: 'Erro ao criar utente' });
    }
};
exports.createUtente = createUtente;
// PUT /api/utentes/:id
const updateUtente = async (req, res) => {
    try {
        const utente = await Utente_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!utente)
            return res.status(404).json({ message: 'Utente não encontrado' });
        res.json(utente);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao actualizar utente', error: err });
    }
};
exports.updateUtente = updateUtente;
// DELETE /api/utentes/:id (soft delete)
const deleteUtente = async (req, res) => {
    try {
        const utente = await Utente_1.default.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
        if (!utente)
            return res.status(404).json({ message: 'Utente não encontrado' });
        res.json({ message: 'Utente desactivado com sucesso' });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao desactivar utente', error: err });
    }
};
exports.deleteUtente = deleteUtente;
