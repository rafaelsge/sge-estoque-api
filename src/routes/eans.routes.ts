import { Router } from 'express';
import { listarEans } from '../controllers/eans.controller';

const router = Router();

router.get('/', listarEans); // GET /eans?cod_loja=1

export default router;
