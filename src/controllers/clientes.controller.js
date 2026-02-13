
const { Cliente } = require('../models');
const { Op } = require('sequelize');

module.exports = {
 async buscarPorNome(req,res){
   try{
     const {cod_loja}=req.query;
     const list = await Cliente.findAll({
       where:{
        cod_loja
       }
     });
     res.json(list);
   }catch(err){res.status(500).json({error:'Erro'});}
 }
}
