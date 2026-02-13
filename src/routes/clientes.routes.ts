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
 *                     $ref: '#/components/schemas/Cliente'
 *             examples:
 *               sucesso:
 *                 summary: Exemplo de retorno
 *                 value:
 *                   total: 1
 *                   data:
 *                     - id: 10
 *                       cod_loja: 1
 *                       codigo: 2001
 *                       nome: "Mercadinho Central"
 *                       documento: "12345678000199"
 *                       telefone: "11999990000"
 *                       email: "compras@mercadinho.com"
 *                       ativo: true
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
 *               - $ref: '#/components/schemas/ClienteInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/ClienteInput'
 *           examples:
 *             unico:
 *               summary: Cadastro de um cliente
 *               value:
 *                 cod_loja: 1
 *                 codigo: 2001
 *                 nome: "Mercadinho Central"
 *                 documento: "12345678000199"
 *                 telefone: "11999990000"
 *                 email: "compras@mercadinho.com"
 *                 ativo: true
 *             lote:
 *               summary: Cadastro em lote
 *               value:
 *                 - cod_loja: 1
 *                   codigo: 2001
 *                   nome: "Mercadinho Central"
 *                   ativo: true
 *                 - cod_loja: 1
 *                   codigo: 2002
 *                   nome: "Padaria Nova Era"
 *                   ativo: true
 *     responses:
 *       201:
 *         description: Clientes processados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClienteProcessamentoResponse'
 *             examples:
 *               sucesso:
 *                 value:
 *                   message: "Clientes processados com sucesso."
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
 *                   error: "codigo deve ser um numero valido."
 *                   index: 0
 */
router.post('/cadastrar', cadastrarCliente);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Cliente:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         codigo:
 *           type: integer
 *           example: 2001
 *         nome:
 *           type: string
 *           example: "Mercadinho Central"
 *         documento:
 *           type: string
 *           nullable: true
 *           example: "12345678000199"
 *         telefone:
 *           type: string
 *           nullable: true
 *           example: "11999990000"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "compras@mercadinho.com"
 *         ativo:
 *           type: boolean
 *           example: true
 *     ClienteInput:
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
 *           example: 2001
 *         nome:
 *           type: string
 *           example: "Mercadinho Central"
 *         documento:
 *           type: string
 *           nullable: true
 *           example: "12345678000199"
 *         telefone:
 *           type: string
 *           nullable: true
 *           example: "11999990000"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "compras@mercadinho.com"
 *         ativo:
 *           type: boolean
 *           example: true
 *     ClienteProcessamentoResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Clientes processados com sucesso."
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
