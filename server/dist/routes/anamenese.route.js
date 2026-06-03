"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const anamnese_controller_1 = require("../controllers/anamnese.controller");
const verifyToken_1 = require("../auth/verifyToken");
const checkRole_1 = require("../middleWare/checkRole");
const router = (0, express_1.Router)();
router.get('/', verifyToken_1.verifyToken, (0, checkRole_1.checkRole)('administrador', 'medico'), anamnese_controller_1.getAnamneses);
exports.default = router;
