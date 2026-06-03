"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
const Amostra_1 = __importDefault(require("../models/Amostra"));
const Resultado_1 = __importDefault(require("../models/Resultado"));
const Fatura_1 = __importDefault(require("../models/Fatura"));
async function getDashboard(_req, res) {
    try {
        const now = new Date();
        const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const semana = new Date(hoje);
        semana.setDate(hoje.getDate() - 7);
        const mes = new Date(now.getFullYear(), now.getMonth(), 1);
        const [reqHoje, reqSemana, reqMes, amostrasHoje, amostrasEstado, resultadoFlag, resultadoCategoria, validadosHoje, criticosPorValidar, topAnalises, finEstado, pipeline,] = await Promise.all([
            Requisicao_1.default.countDocuments({ createdAt: { $gte: hoje } }),
            Requisicao_1.default.countDocuments({ createdAt: { $gte: semana } }),
            Requisicao_1.default.countDocuments({ createdAt: { $gte: mes } }),
            Amostra_1.default.countDocuments({ createdAt: { $gte: hoje } }),
            Amostra_1.default.aggregate([{ $group: { _id: '$estado', count: { $sum: 1 } } }]),
            Resultado_1.default.aggregate([{ $group: { _id: '$flag', count: { $sum: 1 } } }]),
            Resultado_1.default.aggregate([{ $group: { _id: '$analise.categoria', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            Resultado_1.default.countDocuments({
                estado: { $in: ['validado_tecnico', 'validado_medico'] },
                updatedAt: { $gte: hoje },
            }),
            Resultado_1.default.countDocuments({
                flag: { $in: ['critico_alto', 'critico_baixo'] },
                estado: { $nin: ['validado_tecnico', 'validado_medico'] },
            }),
            Resultado_1.default.aggregate([
                { $group: { _id: '$analise.codigo', nome: { $first: '$analise.nome' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 8 },
            ]),
            Fatura_1.default.aggregate([
                { $group: { _id: '$estado', count: { $sum: 1 }, valor: { $sum: '$valorLiquido' } } },
            ]),
            Resultado_1.default.aggregate([
                { $group: { _id: '$estado', count: { $sum: 1 } } },
            ]),
        ]);
        res.json({
            requisicoes: { hoje: reqHoje, semana: reqSemana, mes: reqMes },
            amostras: { hoje: amostrasHoje, porEstado: amostrasEstado },
            resultados: {
                porFlag: resultadoFlag,
                porCategoria: resultadoCategoria,
                validadosHoje,
                criticosPorValidar,
            },
            topAnalises,
            financeiro: finEstado,
            pipeline,
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao gerar dashboard' });
    }
}
