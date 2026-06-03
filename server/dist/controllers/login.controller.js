"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.login = exports.getMe = void 0;
var authController_1 = require("./authController");
Object.defineProperty(exports, "getMe", { enumerable: true, get: function () { return authController_1.getMe; } });
Object.defineProperty(exports, "login", { enumerable: true, get: function () { return authController_1.login; } });
Object.defineProperty(exports, "register", { enumerable: true, get: function () { return authController_1.register; } });
