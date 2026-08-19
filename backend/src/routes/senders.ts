import { Router } from 'express';
import { getSenders, createSender } from '../controllers/sender';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /senders — read-only list of senders owned by the authenticated user.
router.get('/', requireAuth, getSenders);

// POST /senders — creates a new sender for the authenticated user.
router.post('/', requireAuth, createSender);

export default router;
