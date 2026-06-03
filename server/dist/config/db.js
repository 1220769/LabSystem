"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    mongoose_1.default.connection.on('connected', () => {
        console.log('MongoDB conectado!');
    });
    mongoose_1.default.connection.on('error', (err) => {
        console.log('MongoDB erro:', err.message);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        console.log('MongoDB desligado — a reconectar...');
    });
    await mongoose_1.default.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 60000,
        heartbeatFrequencyMS: 2000,
    });
};
exports.connectDB = connectDB;
