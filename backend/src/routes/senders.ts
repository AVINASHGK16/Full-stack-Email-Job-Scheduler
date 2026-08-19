import { Router } from 'express';
import { getSenders } from '../controllers/sender';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /senders — read-only list of senders owned by the authenticated user.
// requireAuth enforces session; returns only safe fields (id, email, createdAt).
router.get('/', requireAuth, getSenders);

export default router;
