"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cadastrarUsuario = cadastrarUsuario;
exports.listarUsuarios = listarUsuarios;
exports.atualizarUsuario = atualizarUsuario;
exports.excluirUsuario = excluirUsuario;
const prismaClient_1 = require("../prismaClient");
/**
 * 👤 Cadastrar um ou vários usuários
 */
async function cadastrarUsuario(req, res) {
    try {
        const body = req.body;
        const usuarios = Array.isArray(body) ? body : [body];
        for (const u of usuarios) {
            if (!u.codigo || !u.nome || !u.cod_loja || !u.senha_md5) {
                return res.status(400).json({
                    error: 'Campos obrigatórios: codigo, nome, cod_loja e senha_md5.',
                });
            }
        }
        // Insere todos os usuários, mantendo código ERP e id interno
        const result = await prismaClient_1.prisma.usuario.createMany({
            data: usuarios.map((u) => ({
                codigo: u.codigo,
                nome: u.nome,
                email: u.email ?? null,
                telefone: u.telefone ?? null,
                senha_md5: u.senha_md5,
                cod_loja: u.cod_loja,
            })),
            skipDuplicates: false,
        });
        return res.status(201).json({
            message: 'Usuário(s) cadastrado(s) com sucesso.',
            inseridos: result.count,
        });
    }
    catch (error) {
        console.error('Erro em cadastrarUsuario:', error);
        return res.status(500).json({ error: 'Erro ao cadastrar usuários.' });
    }
}
/**
 * 📋 Listar todos os usuários (ou por loja)
 */
async function listarUsuarios(req, res) {
    try {
        const cod_loja = req.query.cod_loja ? Number(req.query.cod_loja) : undefined;
        const where = cod_loja ? { cod_loja } : {};
        const usuarios = await prismaClient_1.prisma.usuario.findMany({
            where,
            include: { loja: true },
            orderBy: { nome: 'asc' },
        });
        return res.json({
            total: usuarios.length,
            data: usuarios.map((u) => ({
                id: u.id,
                codigo: u.codigo,
                nome: u.nome,
                email: u.email,
                telefone: u.telefone,
                cod_loja: u.cod_loja,
                loja: {
                    codigo: u.loja.codigo,
                    nome: u.loja.nome,
                    cidade: u.loja.cidade,
                },
            })),
        });
    }
    catch (error) {
        console.error('Erro em listarUsuarios:', error);
        return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
}
/**
 * ✏️ Atualizar um usuário (por id interno)
 */
async function atualizarUsuario(req, res) {
    try {
        const id = Number(req.params.id);
        const { nome, email, telefone, senha_md5, cod_loja } = req.body;
        if (!id)
            return res.status(400).json({ error: 'ID é obrigatório.' });
        const usuario = await prismaClient_1.prisma.usuario.findUnique({ where: { id } });
        if (!usuario)
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        const atualizado = await prismaClient_1.prisma.usuario.update({
            where: { id },
            data: {
                nome: nome ?? usuario.nome,
                email: email ?? usuario.email,
                telefone: telefone ?? usuario.telefone,
                senha_md5: senha_md5 ?? usuario.senha_md5,
                cod_loja: cod_loja ?? usuario.cod_loja,
            },
        });
        return res.json({ message: 'Usuário atualizado com sucesso.', usuario: atualizado });
    }
    catch (error) {
        console.error('Erro em atualizarUsuario:', error);
        return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
}
/**
 * ❌ Excluir um usuário (por id interno)
 */
async function excluirUsuario(req, res) {
    try {
        const id = Number(req.params.id);
        if (!id)
            return res.status(400).json({ error: 'ID é obrigatório.' });
        const usuario = await prismaClient_1.prisma.usuario.findUnique({ where: { id } });
        if (!usuario)
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        await prismaClient_1.prisma.usuario.delete({ where: { id } });
        return res.json({ message: 'Usuário excluído com sucesso.' });
    }
    catch (error) {
        console.error('Erro em excluirUsuario:', error);
        return res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
}
