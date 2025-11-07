import { Router } from 'express';
import {
  login,
  firstAccess,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Rotas de autenticação de usuários
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Realiza o login de um usuário
 *     description: >
 *       Faz o login via **e-mail** ou **telefone** e senha MD5.  
 *       Caso o usuário ainda não tenha senha, retorna `primeiro_acesso: true`.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - senha_md5
 *             properties:
 *               login:
 *                 type: string
 *                 example: "usuario@empresa.com"
 *               senha_md5:
 *                 type: string
 *                 example: "21232f297a57a5a743894a0e4a801fc3"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Usuário ou senha inválidos
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/first-access:
 *   post:
 *     summary: Cria senha no primeiro acesso
 *     description: >
 *       Permite que o usuário defina sua senha caso ainda não tenha uma cadastrada.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - senha_md5
 *             properties:
 *               login:
 *                 type: string
 *                 example: "usuario@empresa.com"
 *               senha_md5:
 *                 type: string
 *                 example: "5f4dcc3b5aa765d61d8327deb882cf99"
 *     responses:
 *       200:
 *         description: Senha criada com sucesso
 *       404:
 *         description: Usuário não encontrado
 *       400:
 *         description: Usuário já possui senha cadastrada
 */
router.post('/first-access', firstAccess);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Gera token de recuperação de senha
 *     description: >
 *       Cria um token de redefinição de senha e retorna-o na resposta.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *             properties:
 *               login:
 *                 type: string
 *                 example: "usuario@empresa.com"
 *     responses:
 *       200:
 *         description: Token de recuperação gerado
 *       404:
 *         description: Usuário não encontrado
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Redefine senha com token
 *     description: >
 *       Redefine a senha de um usuário com base em um token válido de recuperação.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - nova_senha_md5
 *             properties:
 *               token:
 *                 type: string
 *                 example: "b1c2d3e4f5g6h7i8"
 *               nova_senha_md5:
 *                 type: string
 *                 example: "5f4dcc3b5aa765d61d8327deb882cf99"
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       404:
 *         description: Token inválido ou expirado
 */
router.post('/reset-password', resetPassword);

export default router;
