const { Pedido, PedidoItem } = require('../models');
const { pedidoSchema } = require('../validations/pedidos.schema');

module.exports = {
    async receberPedido(req, res) {
        try {
            // 🔍 valida payload incluindo novos campos
            const { error, value } = pedidoSchema.validate(req.body, { abortEarly: false });

            if (error) {
                return res.status(400).json({
                    error: 'Payload inválido',
                    details: error.details,
                });
            }

            // separa itens do pedido
            const itens = value.itens;
            delete value.itens;

            // cria o pedido com os novos campos
            const pedido = await Pedido.create({
                ...value,
                tipo: value.tipo,
                cod_cond_pagto: value.cod_cond_pagto,
                valor_frete: value.valor_frete,
                nome_transportadora: value.nome_transportadora,
                tipo_frete: value.tipo_frete
            });

            // cria os itens do pedido incluindo os novos campos
            for (const item of itens) {
                await PedidoItem.create({
                    ...item,
                    id_pedido: pedido.id,
                    compl_item: item.compl_item,
                    perc_desconto: item.perc_desconto,
                    vl_desconto: item.vl_desconto
                });
            }

            return res.status(201).json({
                mensagem: 'Pedido registrado',
                id_local: pedido.id
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}
