const express = require('express');
const router = express.Router();
const controller = require('../controllers/condicao_pagamento.controller');

// GET /api/condpag?cod_loja=1
router.get('/', controller.listar);

// GET /api/condpag/123
router.get('/:id', controller.obter);

module.exports = router;
