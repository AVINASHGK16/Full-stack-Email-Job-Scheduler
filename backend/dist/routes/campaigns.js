"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaign_1 = require("../controllers/campaign");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /campaigns — requires an authenticated session.
// requireAuth enforces the session before the controller runs.
// Unauthenticated requests are rejected with 401.
router.post('/', auth_1.requireAuth, campaign_1.createCampaign);
exports.default = router;
