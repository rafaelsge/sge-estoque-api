
const express=require('express');
/**
 * @swagger
 * tags:
 *   name: Estoque
 *   description: Rotas de Estoque
 */
const r=express.Router();
const c=require('../controllers/estoque.controller');
/**
 * @swagger
 * /api/estoque/atual:
 *   get:
 *     summary: GET /atual em Estoque
 *     tags: [Estoque]
 *     responses:
 *       200:
 *         description: Sucesso
 */
r.get('/atual',c.getEstoqueAtual);
module.exports=r;


r.get('/',c.getEstoque);
module.exports=r;