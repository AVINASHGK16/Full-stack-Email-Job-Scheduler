import { Router } from 'express';
import { getSenders, createSender, verifySender } from '../controllers/sender';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /senders — read-only list of senders owned by the authenticated user.
router.get('/', requireAuth, getSenders);

// POST /senders — creates a new sender for the authenticated user.
router.post('/', requireAuth, createSender);

// POST /senders/:id/verify — verifies SMTP credentials for a sender.
router.post('/:id/verify', requireAuth, verifySender);

export default router;
