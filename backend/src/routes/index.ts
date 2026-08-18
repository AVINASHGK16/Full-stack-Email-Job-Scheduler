import { Router } from 'express';
import healthRouter from './health';

const router = Router();

// Mount individual route handlers
router.use('/health', healthRouter);

export default router;
