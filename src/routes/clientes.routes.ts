import { Router } from 'express';
import { buscarPorNome } from '../controllers/clientes.controller';

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

export default router;
