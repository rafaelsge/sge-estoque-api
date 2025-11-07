import express from 'express';
import { searchProduto, listarEans } from '../controllers/produtos.controller';

const router = express.Router();

router.get('/produtos/search', searchProduto);
router.get('/eans', listarEans);

export default router;
