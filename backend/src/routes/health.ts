import { Router } from 'express';
import { getHealth } from '../controllers/health';

const router = Router();

// GET /health mapping
router.get('/', getHealth);

export default router;
