"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullSync = fullSync;
const prismaClient_1 = require("../prismaClient");
async function fullSync(req, res) {
    const cod_loja = Number(req.query.cod_loja);
    if (!cod_loja) {
        return res.status(400).json({ error: 'cod_loja obrigatório' });
    }
    const [usuarios, produtos, eans, contagens] = await Promise.all([
        prismaClient_1.prisma.usuario.findMany({
            where: { cod_loja },
            select: { codigo: true, cod_loja: true, nome: true, email: true, telefone: true }
        }),
        prismaClient_1.prisma.produto.findMany({
            where: { cod_loja },
            select: {
                codigo: true,
                cod_loja: true,
                nome: true,
                unidade_medida: true,
                codigo_barras: true
            }
        }),
        prismaClient_1.prisma.ean.findMany({
            where: { cod_loja },
            select: { id: true, cod_loja: true, cod_produto: true, codigo_barras: true }
        }),
        prismaClient_1.prisma.contagem.findMany({
            where: { cod_loja },
            select: {
                id: true,
                cod_loja: true,
                cod_produto: true,
                cod_usuario: true,
                qtde: true,
                sincronizado: true,
                created_at: true,
                updated_at: true
            }
        })
    ]);
    return res.json({
        usuarios,
        produtos,
        eans,
        contagens
    });
}
