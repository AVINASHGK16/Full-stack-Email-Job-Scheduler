import { Router } from 'express';
import { createCampaign, getScheduledCampaigns } from '../controllers/campaign';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /campaigns — create and schedule a campaign.
// requireAuth enforces the session; userId comes from req.user.id only.
router.post('/', requireAuth, createCampaign);

// GET /campaigns/scheduled — read-only list of pending/queued recipients.
// requireAuth enforces the session; returns only the authenticated user's records.
router.get('/scheduled', requireAuth, getScheduledCampaigns);

export default router;
