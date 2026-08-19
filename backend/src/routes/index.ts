import { Router } from 'express';
import healthRouter from './health';
import testJobRouter from './testJob';
import campaignsRouter from './campaigns';
import authRouter from './auth';
import sendersRouter from './senders';

const router = Router();

// Mount individual route handlers
router.use('/health', healthRouter);
router.use('/test-job', testJobRouter);
router.use('/campaigns', campaignsRouter);
router.use('/auth', authRouter);
router.use('/senders', sendersRouter);

export default router;
