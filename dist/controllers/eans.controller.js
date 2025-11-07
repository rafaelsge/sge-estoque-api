"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarEans = listarEans;
const prismaClient_1 = require("../prismaClient");
/**
 * Retorna todos os EANs de uma loja específica.
 * Exemplo: GET /eans?cod_loja=1
 */
async function listarEans(req, res) {
    const codLoja = Number(req.query.cod_loja);
    if (!codLoja) {
        return res.status(400).json({ error: 'Parâmetro cod_loja é obrigatório' });
    }
    try {
        const eans = await prismaClient_1.prisma.ean.findMany({
            where: { cod_loja: codLoja },
            select: {
                cod_loja: true,
                cod_produto: true,
                codigo_barras: true,
            },
        });
        res.json({
            total: eans.length,
            data: eans,
        });
    }
    catch (err) {
        console.error('Erro ao buscar EANs:', err);
        res.status(500).json({ error: 'Erro ao buscar EANs' });
    }
}
