"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cadastrarLoja = cadastrarLoja;
exports.listarLojas = listarLojas;
exports.atualizarLoja = atualizarLoja;
exports.excluirLoja = excluirLoja;
const prismaClient_1 = require("../prismaClient");
/**
 * 🏪 Cadastra uma ou várias lojas
 */
async function cadastrarLoja(req, res) {
    try {
        const body = req.body;
        const lojas = Array.isArray(body) ? body : [body];
        // Validação básica
        for (const loja of lojas) {
            if (!loja.codigo || !loja.nome || !loja.cidade) {
                return res.status(400).json({
                    error: 'Cada loja deve conter código, nome e cidade.',
                });
            }
        }
        // Insere todas (sem bloqueio de duplicados)
        const result = await prismaClient_1.prisma.loja.createMany({
            data: lojas.map((l) => ({
                codigo: l.codigo, // código ERP
                nome: l.nome,
                cidade: l.cidade,
            })),
            skipDuplicates: false, // permite repetição de código se desejado
        });
        return res.status(201).json({
            message: 'Lojas cadastradas com sucesso.',
            inseridas: result.count,
        });
    }
    catch (error) {
        console.error('Erro em cadastrarLoja:', error);
        return res.status(500).json({ error: 'Erro ao cadastrar lojas.' });
    }
}
/**
 * 📋 Lista todas as lojas
 */
async function listarLojas(req, res) {
    try {
        const lojas = await prismaClient_1.prisma.loja.findMany({ orderBy: { nome: 'asc' } });
        return res.json({ total: lojas.length, data: lojas });
    }
    catch (error) {
        console.error('Erro em listarLojas:', error);
        return res.status(500).json({ error: 'Erro ao listar lojas.' });
    }
}
/**
 * ✏️ Atualiza uma loja (busca pelo ID interno)
 */
async function atualizarLoja(req, res) {
    try {
        const id = Number(req.params.id);
        const { nome, cidade } = req.body;
        if (!id)
            return res.status(400).json({ error: 'ID da loja é obrigatório.' });
        const loja = await prismaClient_1.prisma.loja.findUnique({ where: { id } });
        if (!loja)
            return res.status(404).json({ error: 'Loja não encontrada.' });
        const atualizada = await prismaClient_1.prisma.loja.update({
            where: { id },
            data: {
                nome: nome ?? loja.nome,
                cidade: cidade ?? loja.cidade,
            },
        });
        return res.json({ message: 'Loja atualizada com sucesso.', loja: atualizada });
    }
    catch (error) {
        console.error('Erro em atualizarLoja:', error);
        return res.status(500).json({ error: 'Erro ao atualizar loja.' });
    }
}
/**
 * ❌ Exclui uma loja (pelo ID interno)
 */
async function excluirLoja(req, res) {
    try {
        const id = Number(req.params.id);
        if (!id)
            return res.status(400).json({ error: 'ID é obrigatório.' });
        const loja = await prismaClient_1.prisma.loja.findUnique({ where: { id } });
        if (!loja)
            return res.status(404).json({ error: 'Loja não encontrada.' });
        await prismaClient_1.prisma.loja.delete({ where: { id } });
        return res.json({ message: 'Loja excluída com sucesso.' });
    }
    catch (error) {
        console.error('Erro em excluirLoja:', error);
        return res.status(500).json({ error: 'Erro ao excluir loja.' });
    }
}
