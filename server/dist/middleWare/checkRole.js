"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = void 0;
var authMiddleware_1 = require("./authMiddleware");
Object.defineProperty(exports, "checkRole", { enumerable: true, get: function () { return authMiddleware_1.authorize; } });
