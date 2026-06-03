"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const medico_controller_1 = require("../controllers/medico.controller");
const verifyToken_1 = require("../auth/verifyToken");
const checkRole_1 = require("../middleWare/checkRole");
const router = (0, express_1.Router)();
router.get('/', verifyToken_1.verifyToken, (0, checkRole_1.checkRole)('administrador', 'medico'), medico_controller_1.getMedicos);
exports.default = router;
