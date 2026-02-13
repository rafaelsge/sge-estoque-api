
const express=require('express');
/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Rotas de Clientes
 */
const r=express.Router();
const c=require('../controllers/clientes.controller');
/**
 * @swagger
 * /api/clientes/search:
 *   get:
 *     summary: GET /search em Clientes
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Sucesso
 */
r.get('/search',c.buscarPorNome);
module.exports=r;