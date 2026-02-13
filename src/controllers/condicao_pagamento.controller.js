const CondicaoPagamento = require('../models/condicao_pagamento');

module.exports = {
    // GET → listar condições por loja
    async listar(req, res) {
        try {
            const { cod_loja } = req.query;

            if (!cod_loja) {
                return res.status(400).json({ error: 'Informe cod_loja' });
            }

            const lista = await CondicaoPagamento.findAll({
                where: { cod_loja },
                order: [['nome', 'ASC']]
            });

            return res.json({ data: lista });
        } catch (err) {
            console.error('Erro ao listar condições de pagamento:', err);
            return res.status(500).json({ error: 'Erro interno ao listar' });
        }
    },

    // GET → obter 1 condição por código
    async obter(req, res) {
        try {
            const { id } = req.params;

            const cond = await CondicaoPagamento.findByPk(id);

            if (!cond) {
                return res.status(404).json({ error: 'Registro não encontrado' });
            }

            res.json(cond);
        } catch (err) {
            console.error('Erro ao obter condição:', err);
            res.status(500).json({ error: 'Erro interno' });
        }
    }
};
