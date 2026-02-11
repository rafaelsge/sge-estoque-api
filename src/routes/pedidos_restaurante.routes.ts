import { Router } from 'express';
import {
  cadastrarPedidoRestaurante,
  listarPedidosRestauranteLiberados,
  atualizarStatusPedidoRestaurante,
} from '../controllers/pedidos_restaurante.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: PedidosRestaurante
 *   description: Endpoints para pedidos de restaurante
 */

/**
 * @swagger
 * /pedidos/restaurante/cadastrar:
 *   post:
 *     summary: Cadastra um pedido de restaurante
 *     tags: [PedidosRestaurante]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PedidoRestauranteInput'
 *     responses:
 *       201:
 *         description: Pedido cadastrado com sucesso
 *       400:
 *         description: Dados invalidos
 */
router.post('/cadastrar', cadastrarPedidoRestaurante);

/**
 * @swagger
 * /pedidos/restaurante/liberados:
 *   get:
 *     summary: Lista pedidos liberados (status 0)
 *     tags: [PedidosRestaurante]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Codigo da loja
 *     responses:
 *       200:
 *         description: Lista de pedidos liberados
 *       400:
 *         description: Parametros invalidos
 */
router.get('/liberados', listarPedidosRestauranteLiberados);

/**
 * @swagger
 * /pedidos/restaurante/status:
 *   post:
 *     summary: Atualiza o status do pedido
 *     tags: [PedidosRestaurante]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PedidoRestauranteStatusInput'
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Dados invalidos
 *       404:
 *         description: Pedido nao encontrado
 */
router.post('/status', atualizarStatusPedidoRestaurante);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     PedidoRestauranteItemInput:
 *       type: object
 *       required:
 *         - cod_produto
 *         - descricao
 *         - quantidade
 *         - pr_venda
 *         - pr_custo
 *         - subtotal
 *       properties:
 *         cod_produto:
 *           type: integer
 *           example: 10
 *         descricao:
 *           type: string
 *           example: "Hamburguer artesanal"
 *         quantidade:
 *           type: number
 *           example: 2
 *         pr_venda:
 *           type: number
 *           example: 28.0
 *         pr_custo:
 *           type: number
 *           example: 18.5
 *         subtotal:
 *           type: number
 *           example: 56.0
 *
 *     PedidoRestauranteTotaisInput:
 *       type: object
 *       required:
 *         - total_itens
 *         - total_pedido
 *       properties:
 *         total_itens:
 *           type: number
 *           example: 5
 *         total_pedido:
 *           type: number
 *           example: 98.5
 *
 *     PedidoRestauranteInput:
 *       type: object
 *       required:
 *         - cod_loja
 *         - cod_usuario
 *         - data_hora
 *         - origem
 *         - totais
 *         - itens
 *       properties:
 *         id:
 *           type: integer
 *           description: ID do pedido (para atualizacao)
 *           example: 10
 *         cod_loja:
 *           type: integer
 *           example: 1
 *         cod_usuario:
 *           type: integer
 *           example: 123
 *         codigo_cartao:
 *           type: string
 *           example: "000123"
 *         data_hora:
 *           type: string
 *           format: date-time
 *           example: "2026-02-11T19:45:00-03:00"
 *         origem:
 *           type: string
 *           example: "app_pedido_restaurante"
 *         status:
 *           type: integer
 *           example: 0
 *           description: "0-liberado, 1-processado, 2-alterando, 3-cancelado"
 *         totais:
 *           $ref: '#/components/schemas/PedidoRestauranteTotaisInput'
 *         itens:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PedidoRestauranteItemInput'
 *
 *     PedidoRestauranteStatusInput:
 *       type: object
 *       required:
 *         - id
 *         - status
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         status:
 *           type: integer
 *           example: 1
 */
