"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
var authMiddleware_1 = require("../middleWare/authMiddleware");
Object.defineProperty(exports, "verifyToken", { enumerable: true, get: function () { return authMiddleware_1.protect; } });
