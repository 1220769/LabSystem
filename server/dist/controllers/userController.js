"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPermissions = exports.getStats = exports.deactivateUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const User_2 = require("../models/User");
// GET /api/users — só admin
const getUsers = async (req, res) => {
    try {
        const { role, ativo, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (ativo !== undefined)
            filter.ativo = ativo === 'true';
        if (search)
            filter.$or = [
                { nome: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        const total = await User_1.default.countDocuments(filter);
        const users = await User_1.default.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        res.json({ data: users, total, page: +page, pages: Math.ceil(total / +limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter utilizadores', error: err });
    }
};
exports.getUsers = getUsers;
// GET /api/users/:id
const getUserById = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select('-password');
        if (!user)
            return res.status(404).json({ message: 'Utilizador não encontrado' });
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter utilizador', error: err });
    }
};
exports.getUserById = getUserById;
// POST /api/users — só admin
const createUser = async (req, res) => {
    try {
        const { nome, email, password, role, telefone, departamento, utenteRef } = req.body;
        const existe = await User_1.default.findOne({ email });
        if (existe)
            return res.status(400).json({ message: 'Email já registado' });
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await User_1.default.create({
            nome, email, password: hashedPassword,
            role, telefone, departamento,
            ...(utenteRef ? { utenteRef } : {}),
        });
        const { password: _, ...userWithoutPassword } = user.toObject();
        res.status(201).json(userWithoutPassword);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao criar utilizador', error: err });
    }
};
exports.createUser = createUser;
// PUT /api/users/:id
const updateUser = async (req, res) => {
    try {
        const { password, ...rest } = req.body;
        const updateData = { ...rest };
        if (password) {
            const salt = await bcryptjs_1.default.genSalt(10);
            updateData.password = await bcryptjs_1.default.hash(password, salt);
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
        if (!user)
            return res.status(404).json({ message: 'Utilizador não encontrado' });
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao actualizar utilizador', error: err });
    }
};
exports.updateUser = updateUser;
// DELETE /api/users/:id — soft delete, só admin
const deactivateUser = async (req, res) => {
    try {
        if (req.user?._id.toString() === req.params.id) {
            return res.status(400).json({ message: 'Não podes desactivar a tua própria conta' });
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true }).select('-password');
        if (!user)
            return res.status(404).json({ message: 'Utilizador não encontrado' });
        res.json({ message: 'Utilizador desactivado', user });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao desactivar utilizador', error: err });
    }
};
exports.deactivateUser = deactivateUser;
// GET /api/users/stats — totais por role e estado
const getStats = async (_req, res) => {
    try {
        const [porRole, ativos, inativos] = await Promise.all([
            User_1.default.aggregate([
                { $group: { _id: '$role', total: { $sum: 1 }, ativos: { $sum: { $cond: ['$ativo', 1, 0] } } } },
                { $sort: { total: -1 } },
            ]),
            User_1.default.countDocuments({ ativo: true }),
            User_1.default.countDocuments({ ativo: false }),
        ]);
        res.json({ total: ativos + inativos, ativos, inativos, porRole });
    }
    catch {
        res.status(500).json({ message: 'Erro ao obter estatísticas' });
    }
};
exports.getStats = getStats;
// GET /api/users/permissions — devolve mapa de permissões do utilizador actual
const getMyPermissions = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Não autenticado' });
    res.json({
        role: req.user.role,
        permissions: User_2.PERMISSIONS[req.user.role],
    });
};
exports.getMyPermissions = getMyPermissions;
