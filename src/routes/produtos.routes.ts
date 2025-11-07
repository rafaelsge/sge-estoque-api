import { Router } from 'express';
import {
  searchProduto,
  listarEans,
  cadastrarProduto,
  atualizarProduto,
  excluirProduto,
} from '../controllers/produtos.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Produtos
 *   description: Endpoints para gestão de produtos e EANs
 */

/**
 * @swagger
 * /produtos/search:
 *   get:
 *     summary: Busca produtos por nome, código ERP ou código de barras
 *     tags: [Produtos]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Código da loja (obrigatório)
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Termo de busca (nome, código ERP ou código de barras)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Limite de resultados por página
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *         description: Posição inicial (paginação)
 *     responses:
 *       200:
 *         description: Lista de produtos encontrados
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
 *                     $ref: '#/components/schemas/Produto'
 *                 nextOffset:
 *                   type: integer
 *                   nullable: true
 */
router.get('/search', searchProduto);

/**
 * @swagger
 * /produtos/eans:
 *   get:
 *     summary: Lista todos os EANs cadastrados de uma loja
 *     tags: [Produtos]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Código da loja (obrigatório)
 *     responses:
 *       200:
 *         description: Lista de EANs da loja
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
 *                     $ref: '#/components/schemas/Ean'
 */
router.get('/eans', listarEans);

/**
 * @swagger
 * /produtos/cadastrar:
 *   post:
 *     summary: Cadastra um ou vários produtos
 *     tags: [Produtos]
 *     description: >
 *       Este endpoint aceita **um único produto** ou **um array de produtos** para cadastro em lote.
 *       <br/>
 *       O campo `codigo` representa o código ERP do produto dentro da loja (não é único globalmente).
 *       <br/>
 *       Os EANs adicionais são vinculados ao campo `codigo` (ERP), e não ao ID interno.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/ProdutoInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProdutoInput'
 *           examples:
 *             exemploLote:
 *               summary: Cadastro em lote
 *               value:
 *                 - codigo: 100
 *                   cod_loja: 1
 *                   nome: "Coca-Cola 2L"
 *                   unidade_medida: "UN"
 *                   codigo_barras: "7894900011517"
 *                   eans: ["7894900011518", "7894900011519"]
 *                 - codigo: 100
 *                   cod_loja: 2
 *                   nome: "Coca-Cola 2L (Loja 2)"
 *                   unidade_medida: "UN"
 *                   codigo_barras: "7894900011517"
 *     responses:
 *       201:
 *         description: Produto(s) cadastrado(s) com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/cadastrar', cadastrarProduto);

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     summary: Atualiza um produto existente (usando o ID interno)
 *     tags: [Produtos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID interno autoincrementado do produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "Coca-Cola 2L PET"
 *               unidade_medida:
 *                 type: string
 *                 example: "UN"
 *               codigo_barras:
 *                 type: string
 *                 example: "7894900011517"
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.put('/:id', atualizarProduto);

/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     summary: Exclui um produto e seus EANs vinculados
 *     tags: [Produtos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID interno autoincrementado do produto
 *     responses:
 *       200:
 *         description: Produto excluído com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.delete('/:id', excluirProduto);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Produto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID interno autoincrementado do produto
 *         codigo:
 *           type: integer
 *           description: Código ERP do produto (referência interna por loja)
 *         cod_loja:
 *           type: integer
 *           description: Código da loja proprietária do produto
 *         nome:
 *           type: string
 *         unidade_medida:
 *           type: string
 *         codigo_barras:
 *           type: string
 *           nullable: true
 *           description: Código de barras principal do produto
 *
 *     ProdutoInput:
 *       type: object
 *       required:
 *         - codigo
 *         - cod_loja
 *         - nome
 *         - unidade_medida
 *       properties:
 *         codigo:
 *           type: integer
 *           example: 123
 *           description: Código ERP do produto (referência por loja)
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         nome:
 *           type: string
 *           example: "Guaraná Antarctica 2L"
 *         unidade_medida:
 *           type: string
 *           example: "UN"
 *         codigo_barras:
 *           type: string
 *           example: "7894900011520"
 *         eans:
 *           type: array
 *           items:
 *             type: string
 *           description: Lista de códigos de barras alternativos (vinculados ao campo `codigo`)
 *
 *     Ean:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID interno autoincrementado do EAN
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         cod_produto:
 *           type: integer
 *           description: Código ERP do produto (não o ID interno)
 *         codigo_barras:
 *           type: string
 *           example: "7894900011518"
 */
