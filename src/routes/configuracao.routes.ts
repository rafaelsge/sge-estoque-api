import { Router } from 'express';
import {
  cadastrarConfiguracao,
  buscarConfiguracao,
  atualizarValorConfiguracao,
} from '../controllers/configuracao.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Configuracoes
 *   description: Endpoints para configuracoes da aplicacao
 */

/**
 * @swagger
 * /configuracao/cadastrar:
 *   post:
 *     summary: Cadastra uma ou varias configuracoes
 *     tags: [Configuracoes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/ConfiguracaoInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/ConfiguracaoInput'
 *           examples:
 *             exemplo:
 *               summary: Cadastro de configuracao
 *               value:
 *                 codigo: 10
 *                 cod_loja: 1
 *                 nome: "dias_alerta_vencimento"
 *                 valor: "30"
 *     responses:
 *       201:
 *         description: Configuracao(oes) cadastrada(s) com sucesso
 *       400:
 *         description: Dados invalidos
 */
router.post('/cadastrar', cadastrarConfiguracao);

/**
 * @swagger
 * /configuracao/buscar:
 *   get:
 *     summary: Busca o valor de uma configuracao
 *     tags: [Configuracoes]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Codigo da loja
 *       - in: query
 *         name: codigo
 *         required: true
 *         schema:
 *           type: integer
 *         description: Codigo da configuracao
 *     responses:
 *       200:
 *         description: Valor da configuracao
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valor:
 *                   type: string
 *                   example: "30"
 *       404:
 *         description: Configuracao nao encontrada
 */
router.get('/buscar', buscarConfiguracao);

/**
 * @swagger
 * /configuracao/alterar:
 *   put:
 *     summary: Atualiza o valor de uma configuracao
 *     tags: [Configuracoes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cod_loja
 *               - codigo
 *               - valor
 *             properties:
 *               cod_loja:
 *                 type: integer
 *                 example: 1
 *               codigo:
 *                 type: integer
 *                 example: 10
 *               valor:
 *                 type: string
 *                 example: "45"
 *     responses:
 *       200:
 *         description: Configuracao atualizada com sucesso
 *       400:
 *         description: Dados invalidos
 *       404:
 *         description: Configuracao nao encontrada
 */
router.put('/alterar', atualizarValorConfiguracao);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Configuracao:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID interno autoincrementado
 *         codigo:
 *           type: integer
 *           description: Codigo da configuracao
 *         cod_loja:
 *           type: integer
 *           description: Codigo da loja
 *         nome:
 *           type: string
 *           example: "dias_alerta_vencimento"
 *         valor:
 *           type: string
 *           example: "30"
 *
 *     ConfiguracaoInput:
 *       type: object
 *       required:
 *         - codigo
 *         - cod_loja
 *         - valor
 *       properties:
 *         codigo:
 *           type: integer
 *           example: 10
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         nome:
 *           type: string
 *           example: "dias_alerta_vencimento"
 *         valor:
 *           type: string
 *           example: "30"
 */
