import { Router } from 'express';
import {
  cadastrarUsuario,
  listarUsuarios,
  atualizarUsuario,
  excluirUsuario,
} from '../controllers/usuarios.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Usuários
 *   description: Endpoints de gestão de usuários (ERP + App)
 */

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Lista usuários (opcionalmente por loja)
 *     tags: [Usuários]
 *     parameters:
 *       - in: query
 *         name: cod_loja
 *         schema:
 *           type: integer
 *         description: Código ERP da loja
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get('/', listarUsuarios);

/**
 * @swagger
 * /usuarios/cadastrar:
 *   post:
 *     summary: Cadastra um ou vários usuários
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/UsuarioInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/UsuarioInput'
 *     responses:
 *       201:
 *         description: Usuário(s) cadastrado(s) com sucesso
 */
router.post('/cadastrar', cadastrarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Atualiza um usuário (por ID interno)
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioInput'
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 */
router.put('/:id', atualizarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Exclui um usuário
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuário excluído com sucesso
 */
router.delete('/:id', excluirUsuario);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     UsuarioInput:
 *       type: object
 *       required:
 *         - codigo
 *         - nome
 *         - cod_loja
 *         - senha_md5
 *       properties:
 *         codigo:
 *           type: integer
 *           example: 1001
 *           description: Código ERP do usuário
 *         nome:
 *           type: string
 *           example: "Rafael Dorneles"
 *         email:
 *           type: string
 *           example: "rafael@empresa.com"
 *         telefone:
 *           type: string
 *           example: "(51) 99999-8888"
 *         senha_md5:
 *           type: string
 *           example: "5f4dcc3b5aa765d61d8327deb882cf99"
 *         cod_loja:
 *           type: integer
 *           example: 3
 *           description: Código ERP da loja associada
 */
