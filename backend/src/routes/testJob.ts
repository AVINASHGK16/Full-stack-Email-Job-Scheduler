import { Router } from 'express';
import { createTestJob } from '../controllers/testJob';

const router = Router();

// POST /test-job mapping
router.post('/', createTestJob);

export default router;
