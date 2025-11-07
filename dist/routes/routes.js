"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const produtos_controller_1 = require("../controllers/produtos.controller");
const router = express_1.default.Router();
router.get('/produtos/search', produtos_controller_1.searchProduto);
router.get('/eans', produtos_controller_1.listarEans);
exports.default = router;
