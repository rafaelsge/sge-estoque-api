"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lojas_controller_1 = require("../controllers/lojas.controller");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   name: Lojas
 *   description: Endpoints para gestão de lojas
 */
/**
 * @swagger
 * /lojas:
 *   get:
 *     summary: Lista todas as lojas cadastradas
 *     tags: [Lojas]
 *     responses:
 *       200:
 *         description: Lista de lojas
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
 *                     $ref: '#/components/schemas/Loja'
 */
router.get('/', lojas_controller_1.listarLojas);
/**
 * @swagger
 * /lojas/cadastrar:
 *   post:
 *     summary: Cadastra uma ou várias lojas
 *     tags: [Lojas]
 *     description: >
 *       Este endpoint permite cadastrar **uma loja única** ou **várias lojas em lote**.
 *       <br/><br/>
 *       O campo `codigo` representa o código ERP da loja.
 *       <br/>As demais tabelas se relacionam com `lojas.codigo`, não com o `id` interno.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/LojaInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/LojaInput'
 *           examples:
 *             exemploLote:
 *               summary: Cadastro em lote
 *               value:
 *                 - codigo: 3
 *                   nome: "Loja Centro Porto Alegre"
 *                   cidade: "Porto Alegre"
 *                 - codigo: 4
 *                   nome: "Loja 10 Porto Alegre"
 *                   cidade: "Porto Alegre"
 *     responses:
 *       201:
 *         description: Loja(s) cadastrada(s) com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/cadastrar', lojas_controller_1.cadastrarLoja);
/**
 * @swagger
 * /lojas/{id}:
 *   put:
 *     summary: Atualiza os dados de uma loja
 *     tags: [Lojas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID interno autoincrementado da loja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "Loja Central - Porto Alegre"
 *               cidade:
 *                 type: string
 *                 example: "Porto Alegre"
 *     responses:
 *       200:
 *         description: Loja atualizada com sucesso
 *       404:
 *         description: Loja não encontrada
 */
router.put('/:id', lojas_controller_1.atualizarLoja);
/**
 * @swagger
 * /lojas/{id}:
 *   delete:
 *     summary: Exclui uma loja
 *     tags: [Lojas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID interno autoincrementado da loja
 *     responses:
 *       200:
 *         description: Loja excluída com sucesso
 *       404:
 *         description: Loja não encontrada
 */
router.delete('/:id', lojas_controller_1.excluirLoja);
exports.default = router;
/**
 * @swagger
 * components:
 *   schemas:
 *     Loja:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID interno autoincrementado da loja
 *         codigo:
 *           type: integer
 *           description: Código ERP da loja (referência nas demais tabelas)
 *         nome:
 *           type: string
 *           example: "Loja Centro Porto Alegre"
 *         cidade:
 *           type: string
 *           example: "Porto Alegre"
 *
 *     LojaInput:
 *       type: object
 *       required:
 *         - codigo
 *         - nome
 *         - cidade
 *       properties:
 *         codigo:
 *           type: integer
 *           example: 3
 *         nome:
 *           type: string
 *           example: "Loja 10 Porto Alegre"
 *         cidade:
 *           type: string
 *           example: "Porto Alegre"
 */
