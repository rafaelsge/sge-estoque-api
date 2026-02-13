import { Router } from 'express';
import { receberPedido } from '../controllers/pedidos.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: Endpoints para envio de pedidos
 */

/**
 * @swagger
 * /pedidos/enviar:
 *   post:
 *     summary: Registra um pedido com itens
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cod_loja
 *               - itens
 *             properties:
 *               cod_loja:
 *                 type: integer
 *               cod_usuario:
 *                 type: integer
 *               cod_cliente:
 *                 type: integer
 *               cod_cond_pagto:
 *                 type: integer
 *               total_pedido:
 *                 type: number
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Pedido registrado
 */
router.post('/enviar', receberPedido);

export default router;
