"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eans_controller_1 = require("../controllers/eans.controller");
const router = (0, express_1.Router)();
router.get('/', eans_controller_1.listarEans); // GET /eans?cod_loja=1
exports.default = router;
