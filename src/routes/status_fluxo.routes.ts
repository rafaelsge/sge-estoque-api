import { Router } from 'express';
import {
  listar,
  obter,
  cadastrarStatusFluxo,
} from '../controllers/status_fluxo.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: StatusFluxo
 *   description: Cadastro de status de fluxo por loja
 */

/**
 * @swagger
 * /status-fluxo:
 *   get:
 *     summary: Lista status de fluxo por loja
 *     tags: [StatusFluxo]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: ativo
 *         required: false
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista de status de fluxo
 */
router.get('/', listar);

/**
 * @swagger
 * /status-fluxo/{id}:
 *   get:
 *     summary: Busca um status de fluxo por id
 *     tags: [StatusFluxo]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status de fluxo encontrado
 *       404:
 *         description: Status de fluxo nao encontrado
 */
router.get('/:id', obter);

/**
 * @swagger
 * /status-fluxo/cadastrar:
 *   post:
 *     summary: Cadastra um ou varios status de fluxo
 *     tags: [StatusFluxo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/StatusFluxoInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/StatusFluxoInput'
 *           examples:
 *             unico:
 *               value:
 *                 cod_loja: 1
 *                 nome: "Em Preparo"
 *                 cor: "#FF8800"
 *                 ordem: 2
 *                 ativo: true
 *     responses:
 *       201:
 *         description: Status de fluxo processados com sucesso
 */
router.post('/cadastrar', cadastrarStatusFluxo);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     StatusFluxo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         nome:
 *           type: string
 *           example: "Em Preparo"
 *         cor:
 *           type: string
 *           example: "#FF8800"
 *         ordem:
 *           type: integer
 *           example: 2
 *         ativo:
 *           type: boolean
 *           example: true
 *     StatusFluxoInput:
 *       type: object
 *       required:
 *         - cod_loja
 *         - nome
 *         - cor
 *       properties:
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         nome:
 *           type: string
 *           example: "Em Preparo"
 *         cor:
 *           type: string
 *           example: "#FF8800"
 *         ordem:
 *           type: integer
 *           example: 2
 *         ativo:
 *           type: boolean
 *           example: true
 */
