"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategorias = exports.getStats = exports.updateResultado = exports.emitirRelatorio = exports.validarMedico = exports.validarTecnico = exports.getResultadoById = exports.getResultados = exports.gerarWorklist = void 0;
const Resultado_1 = __importDefault(require("../models/Resultado"));
const Amostra_1 = __importDefault(require("../models/Amostra"));
const Requisicao_1 = __importDefault(require("../models/Requisicao"));
/* auto-generated when amostra → recebida */
const gerarWorklist = async (req, res) => {
    try {
        const amostra = await Amostra_1.default.findById(req.params.amostraId);
        if (!amostra)
            return res.status(404).json({ message: 'Amostra não encontrada' });
        if (amostra.estado !== 'recebida')
            return res.status(400).json({ message: 'Amostra não está recebida' });
        const requisicao = await Requisicao_1.default.findById(amostra.requisicao);
        if (!requisicao)
            return res.status(404).json({ message: 'Requisição não encontrada' });
        const year = new Date().getFullYear();
        const created = [];
        for (const analise of requisicao.analises) {
            const exists = await Resultado_1.default.findOne({ amostra: amostra._id, 'analise.codigo': analise.codigo });
            if (exists)
                continue;
            const count = await Resultado_1.default.countDocuments({ codigoResultado: { $regex: `^RES-${year}` } });
            const codigoResultado = `RES-${year}-${String(count + 1).padStart(4, '0')}`;
            const r = await Resultado_1.default.create({
                codigoResultado,
                amostra: amostra._id,
                codigoAmostra: amostra.codigoAmostra,
                requisicao: requisicao._id,
                requisicaoNumero: requisicao.numeroRequisicao,
                utente: amostra.utente,
                utenteNome: amostra.utenteNome,
                analise,
                flag: 'pendente',
                estado: 'pendente',
                createdBy: req.user._id,
            });
            created.push(r);
        }
        res.status(201).json({ created: created.length, resultados: created });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao gerar worklist', error: err });
    }
};
exports.gerarWorklist = gerarWorklist;
const getResultados = async (req, res) => {
    try {
        const { estado, categoria, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (estado && estado !== 'todas')
            filter.estado = estado;
        if (categoria && categoria !== 'todas')
            filter['analise.categoria'] = categoria;
        if (search) {
            filter.$or = [
                { codigoResultado: { $regex: search, $options: 'i' } },
                { utenteNome: { $regex: search, $options: 'i' } },
                { codigoAmostra: { $regex: search, $options: 'i' } },
                { 'analise.nome': { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Resultado_1.default.countDocuments(filter);
        const resultados = await Resultado_1.default.find(filter)
            .sort({ 'analise.categoria': 1, createdAt: -1 })
            .skip((+page - 1) * +limit)
            .limit(+limit);
        res.json({ data: resultados, total, page: +page, pages: Math.ceil(total / +limit) });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter resultados', error: err });
    }
};
exports.getResultados = getResultados;
const getResultadoById = async (req, res) => {
    try {
        const r = await Resultado_1.default.findById(req.params.id);
        if (!r)
            return res.status(404).json({ message: 'Resultado não encontrado' });
        res.json(r);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter resultado', error: err });
    }
};
exports.getResultadoById = getResultadoById;
const validarTecnico = async (req, res) => {
    try {
        const { observacoes } = req.body;
        const resultado = await Resultado_1.default.findById(req.params.id);
        if (!resultado)
            return res.status(404).json({ message: 'Resultado não encontrado' });
        if (resultado.estado !== 'resultado_disponivel')
            return res.status(400).json({ message: 'Resultado não está disponível para validação técnica' });
        resultado.estado = 'validado_tecnico';
        resultado.validacaoTecnica = {
            userId: req.user._id,
            nome: req.user.nome,
            dataHora: new Date(),
            observacoes,
        };
        await resultado.save();
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao validar tecnicamente', error: err });
    }
};
exports.validarTecnico = validarTecnico;
const validarMedico = async (req, res) => {
    try {
        const { observacoes, emitirRelatorio } = req.body;
        const resultado = await Resultado_1.default.findById(req.params.id);
        if (!resultado)
            return res.status(404).json({ message: 'Resultado não encontrado' });
        if (resultado.estado !== 'validado_tecnico')
            return res.status(400).json({ message: 'Resultado não está validado tecnicamente' });
        resultado.estado = 'validado_medico';
        resultado.validacaoMedica = {
            userId: req.user._id,
            nome: req.user.nome,
            dataHora: new Date(),
            observacoes,
        };
        if (emitirRelatorio) {
            resultado.relatorioEmitido = true;
            resultado.relatorioDataHora = new Date();
        }
        await resultado.save();
        // ponto 2: se todos os resultados da requisição estão validados → concluir requisição
        try {
            const porValidar = await Resultado_1.default.countDocuments({
                requisicao: resultado.requisicao,
                estado: { $ne: 'validado_medico' },
            });
            if (porValidar === 0) {
                await Requisicao_1.default.findByIdAndUpdate(resultado.requisicao, { estado: 'concluida' });
            }
        }
        catch { /* não bloquear a validação se esta verificação falhar */ }
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao validar médicamente', error: err });
    }
};
exports.validarMedico = validarMedico;
const emitirRelatorio = async (req, res) => {
    try {
        const resultado = await Resultado_1.default.findByIdAndUpdate(req.params.id, { relatorioEmitido: true, relatorioDataHora: new Date() }, { new: true });
        if (!resultado)
            return res.status(404).json({ message: 'Resultado não encontrado' });
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao emitir relatório', error: err });
    }
};
exports.emitirRelatorio = emitirRelatorio;
const updateResultado = async (req, res) => {
    try {
        const allowed = ['valor', 'unidade', 'refMin', 'refMax', 'flag', 'estado', 'equipamento', 'observacoes'];
        const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const resultado = await Resultado_1.default.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!resultado)
            return res.status(404).json({ message: 'Resultado não encontrado' });
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao actualizar resultado', error: err });
    }
};
exports.updateResultado = updateResultado;
const getStats = async (_req, res) => {
    try {
        const [pendente, em_processamento, disponivel, validado_tecnico, validado_medico, criticos, criticosPorValidar] = await Promise.all([
            Resultado_1.default.countDocuments({ estado: 'pendente' }),
            Resultado_1.default.countDocuments({ estado: 'em_processamento' }),
            Resultado_1.default.countDocuments({ estado: 'resultado_disponivel' }),
            Resultado_1.default.countDocuments({ estado: 'validado_tecnico' }),
            Resultado_1.default.countDocuments({ estado: 'validado_medico' }),
            Resultado_1.default.countDocuments({ flag: { $in: ['critico_alto', 'critico_baixo'] }, estado: 'resultado_disponivel' }),
            Resultado_1.default.countDocuments({ flag: { $in: ['critico_alto', 'critico_baixo'] }, estado: { $in: ['resultado_disponivel', 'validado_tecnico'] } }),
        ]);
        res.json({ pendente, em_processamento, disponivel, validado_tecnico, validado_medico, criticos, criticosPorValidar });
    }
    catch (err) {
        res.status(500).json({ message: 'Erro ao obter estatísticas', error: err });
    }
};
exports.getStats = getStats;
const getCategorias = async (_req, res) => {
    try {
        const cats = await Resultado_1.default.distinct('analise.categoria');
        res.json(cats);
    }
    catch (err) {
        res.status(500).json({ message: 'Erro', error: err });
    }
};
exports.getCategorias = getCategorias;
