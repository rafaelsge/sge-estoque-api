import { Router } from 'express';
import { getEstoqueAtual, getEstoque, cadastrarEstoque } from '../controllers/estoque.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Estoque
 *   description: Endpoints para consulta de estoque
 */

/**
 * @swagger
 * /estoque/atual:
 *   get:
 *     summary: Consulta o estoque de um produto especifico
 *     tags: [Estoque]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_produto
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Registro de estoque
 */
router.get('/atual', getEstoqueAtual);

/**
 * @swagger
 * /estoque:
 *   get:
 *     summary: Lista estoque por loja
 *     tags: [Estoque]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_produto
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de estoque
 */
router.get('/', getEstoque);

/**
 * @swagger
 * /estoque/cadastrar:
 *   post:
 *     summary: Cadastra ou atualiza um ou varios registros de estoque
 *     tags: [Estoque]
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
 *         description: Estoque processado com sucesso
 *       400:
 *         description: Dados invalidos
 */
router.post('/cadastrar', cadastrarEstoque);

export default router;
