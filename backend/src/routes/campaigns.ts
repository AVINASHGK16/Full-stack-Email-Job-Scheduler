import { Router } from 'express';
import { createCampaign } from '../controllers/campaign';

const router = Router();

// POST /campaigns mapping
router.post('/', createCampaign);

export default router;
