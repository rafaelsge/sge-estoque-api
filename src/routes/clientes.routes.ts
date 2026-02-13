import { Router } from 'express';
import { buscarPorNome, cadastrarCliente } from '../controllers/clientes.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Endpoints para consulta de clientes
 */

/**
 * @swagger
 * /clientes/search:
 *   get:
 *     summary: Busca clientes por nome
 *     tags: [Clientes]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
router.get('/search', buscarPorNome);

/**
 * @swagger
 * /clientes/cadastrar:
 *   post:
 *     summary: Cadastra um ou varios clientes
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *               - type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Clientes processados com sucesso
 *       400:
 *         description: Dados invalidos
 */
router.post('/cadastrar', cadastrarCliente);

export default router;
