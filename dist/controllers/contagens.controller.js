"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncContagens = syncContagens;
exports.listarContagensPendentes = listarContagensPendentes;
exports.marcarContagensSincronizadas = marcarContagensSincronizadas;
const prismaClient_1 = require("../prismaClient");
/**
 * 🔄 Rota de sincronização — sempre cria novas leituras (nunca atualiza)
 * Define `sincronizado = false` ao criar.
 */
async function syncContagens(req, res) {
    try {
        const { cod_loja, cod_usuario, itens } = req.body;
        if (!cod_loja || !cod_usuario || !Array.isArray(itens)) {
            return res.status(400).json({ error: 'Parâmetros obrigatórios: cod_loja, cod_usuario e itens.' });
        }
        const criados = [];
        for (const item of itens) {
            const { cod_produto, qtde, created_at } = item;
            if (!cod_produto || qtde === undefined)
                continue;
            const novo = await prismaClient_1.prisma.contagem.create({
                data: {
                    cod_loja,
                    cod_usuario,
                    cod_produto,
                    qtde,
                    sincronizado: false, // 🔹 sempre começa como não sincronizado
                    created_at: created_at ? new Date(created_at) : new Date(),
                },
            });
            criados.push(novo.id);
        }
        return res.json({
            status: 'ok',
            inseridos: criados.length,
            ids: criados,
        });
    }
    catch (error) {
        console.error('Erro em syncContagens:', error);
        return res.status(500).json({ error: 'Erro ao sincronizar contagens.' });
    }
}
/**
 * 🧾 Rota para o ERP buscar contagens pendentes (sincronizado = false)
 * Exemplo: GET /contagens/pendentes?cod_loja=1
 */
async function listarContagensPendentes(req, res) {
    try {
        const cod_loja = Number(req.query.cod_loja);
        if (!cod_loja) {
            return res.status(400).json({ error: 'Parâmetro cod_loja é obrigatório.' });
        }
        const pendentes = await prismaClient_1.prisma.contagem.findMany({
            where: { cod_loja, sincronizado: false },
            orderBy: { created_at: 'asc' },
        });
        return res.json({
            total: pendentes.length,
            data: pendentes,
        });
    }
    catch (error) {
        console.error('Erro em listarContagensPendentes:', error);
        return res.status(500).json({ error: 'Erro ao listar contagens pendentes.' });
    }
}
/**
 * ☑️ Rota para o ERP confirmar contagens já importadas
 * Exemplo: POST /contagens/marcar-sincronizado
 * Body: { ids: [1, 2, 3] }
 */
async function marcarContagensSincronizadas(req, res) {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Informe uma lista de IDs para marcar como sincronizados.' });
        }
        const atualizados = await prismaClient_1.prisma.contagem.updateMany({
            where: { id: { in: ids } },
            data: { sincronizado: true, updated_at: new Date() },
        });
        return res.json({
            message: 'Contagens atualizadas como sincronizadas.',
            total_atualizadas: atualizados.count,
        });
    }
    catch (error) {
        console.error('Erro em marcarContagensSincronizadas:', error);
        return res.status(500).json({ error: 'Erro ao atualizar contagens.' });
    }
}
