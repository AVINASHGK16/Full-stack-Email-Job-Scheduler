import { Router } from 'express';
import healthRouter from './health';
import testJobRouter from './testJob';

const router = Router();

// Mount individual route handlers
router.use('/health', healthRouter);
router.use('/test-job', testJobRouter);

export default router;
