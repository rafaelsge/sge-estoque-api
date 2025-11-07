import { Router } from 'express';
import {
  syncContagens,
  listarContagensPendentes,
  marcarContagensSincronizadas,
} from '../controllers/contagens.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Contagens
 *     description: Operações de sincronização de contagens de estoque
 */

/**
 * @swagger
 * /contagens/sync:
 *   post:
 *     summary: Recebe contagens do aplicativo
 *     description: Cria novos registros de contagem com sincronizado = false.
 *     tags: [Contagens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cod_loja:
 *                 type: integer
 *                 example: 1
 *               cod_usuario:
 *                 type: integer
 *                 example: 10
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     cod_produto:
 *                       type: integer
 *                       example: 105
 *                     qtde:
 *                       type: number
 *                       example: 2
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Contagens inseridas com sucesso.
 */
router.post('/sync', syncContagens);

/**
 * @swagger
 * /contagens/pendentes:
 *   get:
 *     summary: Lista contagens não sincronizadas
 *     description: Retorna todas as contagens com sincronizado = false.
 *     tags: [Contagens]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         schema:
 *           type: integer
 *         required: true
 *         description: Código da loja
 *     responses:
 *       200:
 *         description: Lista de contagens pendentes
 */
router.get('/pendentes', listarContagensPendentes);

/**
 * @swagger
 * /contagens/marcar-sincronizado:
 *   post:
 *     summary: Marca contagens como sincronizadas
 *     description: Atualiza os registros informados para sincronizado = true.
 *     tags: [Contagens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Contagens atualizadas com sucesso.
 */
router.post('/marcar-sincronizado', marcarContagensSincronizadas);

export default router;
