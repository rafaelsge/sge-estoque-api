"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = __importDefault(require("./server"));
require("dotenv/config");
const PORT = process.env.PORT || 3001;
server_1.default.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});
