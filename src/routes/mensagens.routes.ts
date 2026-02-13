import { Router } from 'express';
import {
  webhookMensagem,
  enviarMensagem,
  listarMensagensAtendimento,
  listarMensagensContato,
  iniciarAtendimento,
  finalizarAtendimento,
} from '../controllers/mensagens.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Mensagens
 *   description: Endpoints de mensagens e atendimento
 */

/**
 * @swagger
 * /mensagens/webhook:
 *   post:
 *     summary: Recebe mensagens e vincula ao atendimento aberto do contato
 *     tags: [Mensagens]
 *     responses:
 *       201:
 *         description: Mensagem processada
 */
router.post('/webhook', webhookMensagem);
router.post(/^\/webhook(?:\/.*)?$/, webhookMensagem);

/**
 * @swagger
 * /mensagens/enviar:
 *   post:
 *     summary: Registra mensagem de saida em um atendimento
 *     tags: [Mensagens]
 *     responses:
 *       201:
 *         description: Mensagem registrada
 */
router.post('/enviar', enviarMensagem);

/**
 * @swagger
 * /mensagens/atendimento/{atendimento_id}:
 *   get:
 *     summary: Lista mensagens de um atendimento
 *     tags: [Mensagens]
 *     responses:
 *       200:
 *         description: Lista de mensagens
 */
router.get('/atendimento/:atendimento_id', listarMensagensAtendimento);

/**
 * @swagger
 * /mensagens/contato/{contato_id}:
 *   get:
 *     summary: Lista mensagens de um contato respeitando visibilidade de atendimento
 *     tags: [Mensagens]
 *     responses:
 *       200:
 *         description: Lista de mensagens do contato
 */
router.get('/contato/:contato_id', listarMensagensContato);

/**
 * @swagger
 * /mensagens/atendimento/{atendimento_id}/iniciar:
 *   post:
 *     summary: Inicia atendimento e vincula ao usuario
 *     tags: [Mensagens]
 *     responses:
 *       200:
 *         description: Atendimento iniciado
 */
router.post('/atendimento/:atendimento_id/iniciar', iniciarAtendimento);

/**
 * @swagger
 * /mensagens/atendimento/{atendimento_id}/finalizar:
 *   post:
 *     summary: Finaliza atendimento
 *     tags: [Mensagens]
 *     responses:
 *       200:
 *         description: Atendimento finalizado
 */
router.post('/atendimento/:atendimento_id/finalizar', finalizarAtendimento);

export default router;
