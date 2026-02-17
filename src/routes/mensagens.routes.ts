import { Router } from 'express';
import {
  webhookMensagem,
  enviarMensagem,
  listarMensagensAtendimento,
  listarMensagensContato,
  listarAtendimentos,
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
 *     summary: Webhook da Evolution (aceita /webhook e /webhook/{evento})
 *     tags: [Mensagens]
 *     description: >
 *       Recebe eventos da Evolution, identifica a loja por `apikey`, cria/reusa contato e atendimento aberto,
 *       e registra a mensagem quando houver `texto` ou `arquivo_base64`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             mensagemTexto:
 *               summary: Evento de texto
 *               value:
 *                 event: "messages.upsert"
 *                 instance: "Rafael"
 *                 apikey: "apikey-loja-3"
 *                 data:
 *                   key:
 *                     remoteJid: "555181646123@s.whatsapp.net"
 *                     fromMe: false
 *                   message:
 *                     conversation: "Boa tarde"
 *             mensagemMidia:
 *               summary: Evento com midia em base64
 *               value:
 *                 event: "messages.upsert"
 *                 apikey: "apikey-loja-3"
 *                 data:
 *                   key:
 *                     remoteJid: "555181646123@s.whatsapp.net"
 *                     fromMe: false
 *                   message:
 *                     imageMessage:
 *                       mimetype: "image/jpeg"
 *                       base64: "...BASE64..."
 *     responses:
 *       201:
 *         description: Mensagem processada e registrada
 *         content:
 *           application/json:
 *             example:
 *               message: "Mensagem processada com sucesso."
 *               atendimento_id: 10
 *               mensagem_id: 55
 *               contato_id: 3
 *               novo_atendimento: false
 *       200:
 *         description: Evento ignorado por nao possuir texto nem arquivo
 *         content:
 *           application/json:
 *             example:
 *               message: "Evento ignorado: sem texto e sem arquivo_base64."
 *               ignored: true
 */
router.post('/webhook', webhookMensagem);
router.post(/^\/webhook(?:\/.*)?$/, webhookMensagem);

/**
 * @swagger
 * /mensagens/enviar:
 *   post:
 *     summary: Registra mensagem manual em um atendimento
 *     tags: [Mensagens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MensagemEnviarInput'
 *           examples:
 *             texto:
 *               value:
 *                 cod_loja: 3
 *                 atendimento_id: 10
 *                 usuario_id: 7
 *                 direcao: "saida"
 *                 texto: "Ola, em que posso ajudar?"
 *                 iniciar_atendimento: true
 *             arquivo:
 *               value:
 *                 cod_loja: 3
 *                 atendimento_id: 10
 *                 usuario_id: 7
 *                 direcao: "saida"
 *                 tipo: "imagem"
 *                 arquivo_base64: "...BASE64..."
 *                 arquivo_mimetype: "image/jpeg"
 *                 fromMe: true
 *     responses:
 *       201:
 *         description: Mensagem registrada
 *         content:
 *           application/json:
 *             example:
 *               message: "Mensagem registrada com sucesso."
 *               atendimento_id: 10
 *               mensagem_id: 56
 *               status_atendimento: "em_atendimento"
 */
router.post('/enviar', enviarMensagem);

/**
 * @swagger
 * /mensagens/atendimentos:
 *   get:
 *     summary: Lista atendimentos por status
 *     tags: [Mensagens]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *         description: Codigo da loja
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [aberto, em_atendimento, finalizado]
 *         description: Filtro por status do atendimento
 *       - in: query
 *         name: cod_usuario
 *         required: false
 *         schema:
 *           type: integer
 *         description: >
 *           Necessario para visualizar atendimentos `em_atendimento` vinculados ao proprio usuario.
 *       - in: query
 *         name: contato_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filtra por contato especifico
 *       - in: query
 *         name: ult_id_recebido
 *         required: false
 *         schema:
 *           type: integer
 *         description: >
 *           Sincronizacao incremental por mensagem: retorna somente atendimentos `aberto`
 *           que tenham pelo menos uma mensagem com `id` maior que este valor.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de atendimentos
 *         content:
 *           application/json:
 *             example:
 *               total: 1
 *               data:
 *                 - id: 10
 *                   cod_loja: 3
 *                   contato_id: 3
 *                   cliente_codigo: null
 *                   usuario_id: 7
 *                   origem: "whatsapp"
 *                   status: "em_atendimento"
 *                   aberto_em: "2026-02-13T12:00:00.000Z"
 *                   iniciado_em: "2026-02-13T12:01:00.000Z"
 *                   finalizado_em: null
 *                   created_at: "2026-02-13T12:00:00.000Z"
 *                   updated_at: "2026-02-13T12:01:00.000Z"
 *                   total_mensagens: 12
 *                   contato:
 *                     id: 3
 *                     contato: "Rafael"
 *                     telefone: "555181646123"
 *                     tipo: "whatsapp"
 *               nextOffset: null
 */
router.get('/atendimentos', listarAtendimentos);

/**
 * @swagger
 * /mensagens/atendimento/{atendimento_id}:
 *   get:
 *     summary: Lista mensagens de um atendimento
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: atendimento_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_usuario
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: ult_id_recebido
 *         required: false
 *         description: Retorna somente mensagens com id maior que este valor
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de mensagens
 */
router.get('/atendimento/:atendimento_id', listarMensagensAtendimento);

/**
 * @swagger
 * /mensagens/contato/{contato_id}:
 *   get:
 *     summary: Lista mensagens por contato respeitando visibilidade de atendimento
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: contato_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_loja
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cod_usuario
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
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
 *     parameters:
 *       - in: path
 *         name: atendimento_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             cod_loja: 3
 *             cod_usuario: 7
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
 *     parameters:
 *       - in: path
 *         name: atendimento_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             cod_loja: 3
 *             cod_usuario: 7
 *     responses:
 *       200:
 *         description: Atendimento finalizado
 */
router.post('/atendimento/:atendimento_id/finalizar', finalizarAtendimento);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     MensagemEnviarInput:
 *       type: object
 *       required:
 *         - cod_loja
 *         - atendimento_id
 *         - usuario_id
 *         - direcao
 *       properties:
 *         cod_loja:
 *           type: integer
 *           example: 3
 *         atendimento_id:
 *           type: integer
 *           example: 10
 *         usuario_id:
 *           type: integer
 *           example: 7
 *         direcao:
 *           type: string
 *           enum: [entrada, saida]
 *           example: "saida"
 *         tipo:
 *           type: string
 *           example: "texto"
 *         texto:
 *           type: string
 *           nullable: true
 *         arquivo_base64:
 *           type: string
 *           nullable: true
 *         arquivo_mimetype:
 *           type: string
 *           nullable: true
 *           example: "image/jpeg"
 *         fromMe:
 *           type: boolean
 *           nullable: true
 *           example: true
 *         iniciar_atendimento:
 *           type: boolean
 *           nullable: true
 *           example: false
 */
