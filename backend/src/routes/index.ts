import { Router } from 'express';
import healthRouter from './health';
import testJobRouter from './testJob';
import campaignsRouter from './campaigns';

const router = Router();

// Mount individual route handlers
router.use('/health', healthRouter);
router.use('/test-job', testJobRouter);
router.use('/campaigns', campaignsRouter);

export default router;
