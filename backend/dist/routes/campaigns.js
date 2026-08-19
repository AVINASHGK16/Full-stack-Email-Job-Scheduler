"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaign_1 = require("../controllers/campaign");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /campaigns — create and schedule a campaign.
// requireAuth enforces the session; userId comes from req.user.id only.
router.post('/', auth_1.requireAuth, campaign_1.createCampaign);
// GET /campaigns/scheduled — read-only list of pending/queued recipients.
// requireAuth enforces the session; returns only the authenticated user's records.
router.get('/scheduled', auth_1.requireAuth, campaign_1.getScheduledCampaigns);
exports.default = router;
