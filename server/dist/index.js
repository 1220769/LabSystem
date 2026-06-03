"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const utenteRoutes_1 = __importDefault(require("./routes/utenteRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const requisicaoRoutes_1 = __importDefault(require("./routes/requisicaoRoutes"));
const amostraRoutes_1 = __importDefault(require("./routes/amostraRoutes"));
const resultadoRoutes_1 = __importDefault(require("./routes/resultadoRoutes"));
const faturaRoutes_1 = __importDefault(require("./routes/faturaRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const portalRoutes_1 = __importDefault(require("./routes/portalRoutes"));
dotenv_1.default.config();
(0, db_1.connectDB)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({ origin: 'http://localhost:3000' }));
app.use(express_1.default.json());
app.use('/api/auth', authRoutes_1.default);
app.use('/api/utentes', utenteRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/requisicoes', requisicaoRoutes_1.default);
app.use('/api/amostras', amostraRoutes_1.default);
app.use('/api/resultados', resultadoRoutes_1.default);
app.use('/api/faturas', faturaRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/portal', portalRoutes_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`🧪 LabSystem API → http://localhost:${PORT}`);
});
