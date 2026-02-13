import { Router } from 'express';
import {
  listar,
  obter,
  cadastrarCondicaoPagamento,
} from '../controllers/condicao_pagamento.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: CondicaoPagamento
 *   description: Endpoints para consulta de condicoes de pagamento
 */

/**
 * @swagger
 * /condicao-pagamento:
 *   get:
 *     summary: Lista condicoes de pagamento por loja
 *     tags: [CondicaoPagamento]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de condicoes
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
 *                     $ref: '#/components/schemas/CondicaoPagamento'
 *             examples:
 *               sucesso:
 *                 value:
 *                   total: 2
 *                   data:
 *                     - id: 1
 *                       cod_loja: 1
 *                       codigo: 1
 *                       nome: "A Vista"
 *                       prazo_dias: 0
 *                       ativo: true
 *                     - id: 2
 *                       cod_loja: 1
 *                       codigo: 2
 *                       nome: "30 Dias"
 *                       prazo_dias: 30
 *                       ativo: true
 */
router.get('/', listar);

/**
 * @swagger
 * /condicao-pagamento/{id}:
 *   get:
 *     summary: Busca uma condicao de pagamento por id
 *     tags: [CondicaoPagamento]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Condicao encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CondicaoPagamento'
 *             examples:
 *               sucesso:
 *                 value:
 *                   id: 2
 *                   cod_loja: 1
 *                   codigo: 2
 *                   nome: "30 Dias"
 *                   prazo_dias: 30
 *                   ativo: true
 *       404:
 *         description: Condicao nao encontrada
 *         content:
 *           application/json:
 *             examples:
 *               erro:
 *                 value:
 *                   error: "Condicao de pagamento nao encontrada."
 */
router.get('/:id', obter);

/**
 * @swagger
 * /condicao-pagamento/cadastrar:
 *   post:
 *     summary: Cadastra uma ou varias condicoes de pagamento
 *     tags: [CondicaoPagamento]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/CondicaoPagamentoInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/CondicaoPagamentoInput'
 *           examples:
 *             unico:
 *               value:
 *                 cod_loja: 1
 *                 codigo: 2
 *                 nome: "30 Dias"
 *                 prazo_dias: 30
 *                 ativo: true
 *             lote:
 *               value:
 *                 - cod_loja: 1
 *                   codigo: 1
 *                   nome: "A Vista"
 *                   prazo_dias: 0
 *                 - cod_loja: 1
 *                   codigo: 2
 *                   nome: "30 Dias"
 *                   prazo_dias: 30
 *     responses:
 *       201:
 *         description: Condicoes processadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CondicaoPagamentoProcessamentoResponse'
 *             examples:
 *               sucesso:
 *                 value:
 *                   message: "Condicoes de pagamento processadas com sucesso."
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
 *                   error: "prazo_dias deve ser inteiro >= 0."
 *                   index: 0
 */
router.post('/cadastrar', cadastrarCondicaoPagamento);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     CondicaoPagamento:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 2
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         codigo:
 *           type: integer
 *           example: 2
 *         nome:
 *           type: string
 *           example: "30 Dias"
 *         prazo_dias:
 *           type: integer
 *           nullable: true
 *           example: 30
 *         ativo:
 *           type: boolean
 *           example: true
 *     CondicaoPagamentoInput:
 *       type: object
 *       required:
 *         - cod_loja
 *         - codigo
 *         - nome
 *       properties:
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         codigo:
 *           type: integer
 *           example: 2
 *         nome:
 *           type: string
 *           example: "30 Dias"
 *         prazo_dias:
 *           type: integer
 *           nullable: true
 *           example: 30
 *         ativo:
 *           type: boolean
 *           example: true
 *     CondicaoPagamentoProcessamentoResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Condicoes de pagamento processadas com sucesso."
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
