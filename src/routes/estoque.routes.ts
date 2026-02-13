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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Estoque'
 *             examples:
 *               sucesso:
 *                 value:
 *                   id: 7
 *                   cod_loja: 1
 *                   cod_produto: 100
 *                   quantidade: 12.500
 *               semRegistro:
 *                 value:
 *                   cod_loja: 1
 *                   cod_produto: 100
 *                   quantidade: null
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Estoque'
 *             examples:
 *               sucesso:
 *                 value:
 *                   total: 2
 *                   data:
 *                     - id: 7
 *                       cod_loja: 1
 *                       cod_produto: 100
 *                       quantidade: 12.500
 *                     - id: 8
 *                       cod_loja: 1
 *                       cod_produto: 101
 *                       quantidade: 3.000
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
 *               - $ref: '#/components/schemas/EstoqueInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/EstoqueInput'
 *           examples:
 *             unico:
 *               value:
 *                 cod_loja: 1
 *                 cod_produto: 100
 *                 quantidade: 12.500
 *             lote:
 *               value:
 *                 - cod_loja: 1
 *                   cod_produto: 100
 *                   quantidade: 12.500
 *                 - cod_loja: 1
 *                   cod_produto: 101
 *                   quantidade: 3.000
 *     responses:
 *       201:
 *         description: Estoque processado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstoqueProcessamentoResponse'
 *             examples:
 *               sucesso:
 *                 value:
 *                   message: "Estoque processado com sucesso."
 *                   inseridos: 2
 *                   atualizados: 1
 *                   removidos: 0
 *       400:
 *         description: Dados invalidos
 *         content:
 *           application/json:
 *             examples:
 *               erro:
 *                 value:
 *                   error: "quantidade deve ser numerica."
 *                   index: 0
 */
router.post('/cadastrar', cadastrarEstoque);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Estoque:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 7
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         cod_produto:
 *           type: integer
 *           example: 100
 *         quantidade:
 *           type: number
 *           nullable: true
 *           example: 12.500
 *     EstoqueInput:
 *       type: object
 *       required:
 *         - cod_loja
 *         - cod_produto
 *         - quantidade
 *       properties:
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         cod_produto:
 *           type: integer
 *           example: 100
 *         quantidade:
 *           type: number
 *           example: 12.500
 *     EstoqueProcessamentoResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Estoque processado com sucesso."
 *         inseridos:
 *           type: integer
 *           example: 2
 *         atualizados:
 *           type: integer
 *           example: 1
 *         removidos:
 *           type: integer
 *           example: 0
 */
