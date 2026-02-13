import { Router } from 'express';
import { listar, obter } from '../controllers/condicao_pagamento.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: CondicaoPagamento
 *   description: Endpoints para consulta de condicoes de pagamento
 */

/**
 * @swagger
 * /condicao-pagamento:
 *   get:
 *     summary: Lista condicoes de pagamento por loja
 *     tags: [CondicaoPagamento]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de condicoes
 */
router.get('/', listar);

/**
 * @swagger
 * /condicao-pagamento/{id}:
 *   get:
 *     summary: Busca uma condicao de pagamento por id
 *     tags: [CondicaoPagamento]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Condicao encontrada
 *       404:
 *         description: Condicao nao encontrada
 */
router.get('/:id', obter);

export default router;
