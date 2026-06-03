"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Não autorizado — token em falta' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await User_1.default.findById(decoded.id).select('-password');
        if (!user || !user.ativo) {
            return res.status(401).json({ message: 'Utilizador inactivo ou inexistente' });
        }
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};
exports.protect = protect;
const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Sem permissão para este recurso' });
    }
    next();
};
exports.authorize = authorize;
const checkPermission = (module, action) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
    }
    if (!req.user.hasPermission(module, action)) {
        return res.status(403).json({
            message: `Sem permissão: ${action} em ${module}`
        });
    }
    next();
};
exports.checkPermission = checkPermission;
