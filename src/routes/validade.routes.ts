import { Router } from 'express';
import {
  cadastrarProdutoValidade,
  inativarValidade,
  listarValidadesProximas,
} from '../controllers/validade.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Validades
 *   description: Endpoints para controle de validade de produtos pereciveis
 */

/**
 * @swagger
 * /validade/cadastrar:
 *   post:
 *     summary: Cadastra um ou varios lotes de validade
 *     tags: [Validades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/ProdutoValidadeInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProdutoValidadeInput'
 *           examples:
 *             exemploLote:
 *               summary: Cadastro em lote
 *               value:
 *                 - cod_produto: 100
 *                   cod_loja: 1
 *                   vencimento: "2026-03-15"
 *                   ativo: 1
 *                 - cod_produto: 101
 *                   cod_loja: 1
 *                   vencimento: "2026-03-20"
 *     responses:
 *       201:
 *         description: Lotes cadastrados com sucesso
 *       400:
 *         description: Dados invalidos
 */
router.post('/cadastrar', cadastrarProdutoValidade);

/**
 * @swagger
 * /validade/proximos:
 *   get:
 *     summary: Lista produtos com validades proximas
 *     tags: [Validades]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Codigo da loja
 *       - in: query
 *         name: dias
 *         required: false
 *         schema:
 *           type: integer
 *         description: Quantidade de dias a partir de hoje (se omitido, retorna todos os vencimentos ativos)
 *       - in: query
 *         name: cod_produto
 *         required: false
 *         schema:
 *           type: integer
 *         description: Codigo do produto (se informado, filtra pelo produto da loja)
 *     responses:
 *       200:
 *         description: Lista de lotes com validade proxima
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
 *                     $ref: '#/components/schemas/ProdutoValidade'
 */
router.get('/proximos', listarValidadesProximas);

/**
 * @swagger
 * /validade/inativar:
 *   patch:
 *     summary: Inativa um lote de validade pelo ID
 *     tags: [Validades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Lote inativado com sucesso
 *       400:
 *         description: Dados invalidos
 *       404:
 *         description: Lote nao encontrado
 */
router.patch('/inativar', inativarValidade);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ProdutoValidade:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID interno do lote de validade
 *         cod_produto:
 *           type: integer
 *           description: Codigo ERP do produto
 *         cod_loja:
 *           type: integer
 *           description: Codigo da loja
 *         vencimento:
 *           type: string
 *           format: date
 *           example: "2026-03-15"
 *         ativo:
 *           type: integer
 *           example: 1
 *
 *     ProdutoValidadeInput:
 *       type: object
 *       required:
 *         - cod_produto
 *         - cod_loja
 *         - vencimento
 *       properties:
 *         cod_produto:
 *           type: integer
 *           example: 100
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         vencimento:
 *           type: string
 *           format: date
 *           example: "2026-03-15"
 *         ativo:
 *           type: integer
 *           example: 1
 */
