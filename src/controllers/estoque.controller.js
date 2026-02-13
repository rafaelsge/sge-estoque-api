const { Estoque } = require('../models');

module.exports = {
  
  // GET /api/estoque/atual?cod_loja=1&cod_produto=10
  async getEstoqueAtual(req, res) {
    try {
      const { cod_loja, cod_produto } = req.query;

      if (!cod_loja || !cod_produto) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }

      const est = await Estoque.findOne({
        where: { cod_loja, cod_produto }
      });

      return res.json(est || {
        cod_loja,
        cod_produto,
        quantidade: null
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  },


  // GET /api/estoque?cod_loja=1
  async getEstoque(req, res) {
    try {
      const { cod_loja } = req.query;

      if (!cod_loja) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }

      const lista = await Estoque.findAll({
        where: { cod_loja }
      });

      return res.json({
        data: lista.map(e => ({
          id: e.id,
          cod_loja: e.cod_loja,
          cod_produto: e.cod_produto,
          quantidade: e.quantidade
        }))
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

};
