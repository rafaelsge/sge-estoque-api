
const express=require('express');
/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: Rotas de Pedidos
 */
const r=express.Router();
const c=require('../controllers/pedidos.controller');
/**
 * @swagger
 * /api/pedidos/enviar:
 *   post:
 *     summary: POST /enviar em Pedidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Sucesso
 */
r.post('/enviar',c.receberPedido);
module.exports=r;