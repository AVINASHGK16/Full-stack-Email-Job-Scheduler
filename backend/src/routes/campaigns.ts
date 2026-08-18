import { Router } from 'express';
import { createCampaign } from '../controllers/campaign';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /campaigns — requires an authenticated session.
// requireAuth enforces the session before the controller runs.
// Unauthenticated requests are rejected with 401.
router.post('/', requireAuth, createCampaign);

export default router;

