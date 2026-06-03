"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const generateToken = (id) => jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const DEMO_USERS = {
    'medico@labsystem.pt': { nome: 'Dr. Joao Costa', password: 'medico123', role: 'medico' },
    'tecnico@labsystem.pt': { nome: 'Tecnico Laboratorio', password: 'tecnico123', role: 'tecnico' },
    'enfermeiro@labsystem.pt': { nome: 'Enfermeiro Principal', password: 'enfermeiro123', role: 'enfermeiro' },
    'financeiro@labsystem.pt': { nome: 'Financeiro Principal', password: 'financeiro123', role: 'financeiro' },
    'utente@labsystem.pt': { nome: 'Utente Demo', password: 'utente123', role: 'utente' },
    'admin@labsystem.pt': { nome: 'Administrador', password: 'admin123', role: 'administrador' },
};
async function ensureDemoUser(email, password) {
    const normalizedEmail = email.toLowerCase().trim();
    const demo = DEMO_USERS[normalizedEmail];
    if (!demo || password !== demo.password)
        return null;
    const hashedPassword = await bcryptjs_1.default.hash(password, await bcryptjs_1.default.genSalt(10));
    return User_1.default.findOneAndUpdate({ email: normalizedEmail }, {
        $set: {
            nome: demo.nome,
            email: normalizedEmail,
            password: hashedPassword,
            role: demo.role,
            ativo: true,
        },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
const register = async (req, res) => {
    try {
        const { nome, email, password, role } = req.body;
        const existe = await User_1.default.findOne({ email });
        if (existe)
            return res.status(400).json({ message: 'Email já registado' });
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await User_1.default.create({ nome, email, password: hashedPassword, role });
        res.status(201).json({
            _id: user._id,
            nome: user.nome,
            email: user.email,
            role: user.role,
            token: generateToken(user._id.toString()),
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao registar', error: err });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email ?? '').toLowerCase().trim();
        const normalizedPassword = String(password ?? '');
        const demoUser = await ensureDemoUser(normalizedEmail, normalizedPassword);
        const user = demoUser ?? await User_1.default.findOne({ email: normalizedEmail });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }
        if (!user.ativo) {
            return res.status(403).json({ message: 'Conta desactivada' });
        }
        user.ultimoLogin = new Date();
        await user.save();
        res.json({
            _id: user._id,
            nome: user.nome,
            email: user.email,
            role: user.role,
            token: generateToken(user._id.toString()),
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao autenticar', error: err });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: 'Não autenticado' });
    res.json({
        _id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
    });
};
exports.getMe = getMe;
