import { Router } from 'express';
import healthRouter from './health';
import testJobRouter from './testJob';
import campaignsRouter from './campaigns';
import authRouter from './auth';

const router = Router();

// Mount individual route handlers
router.use('/health', healthRouter);
router.use('/test-job', testJobRouter);
router.use('/campaigns', campaignsRouter);
router.use('/auth', authRouter);

export default router;
