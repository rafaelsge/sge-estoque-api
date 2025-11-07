import { Router } from 'express';
import { fullSync } from '../controllers/sync.controller';
const router = Router();
router.get('/full', fullSync);
export default router;
