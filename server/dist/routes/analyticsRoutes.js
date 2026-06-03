"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.protect);
router.get('/dashboard', analyticsController_1.getDashboard);
exports.default = router;
