import { Router } from 'express';
import { cadastrarPedidoRestaurante } from '../controllers/pedidos_restaurante.controller';

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
 *         totais:
 *           $ref: '#/components/schemas/PedidoRestauranteTotaisInput'
 *         itens:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PedidoRestauranteItemInput'
 */
