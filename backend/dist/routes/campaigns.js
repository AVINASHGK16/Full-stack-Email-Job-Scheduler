"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaign_1 = require("../controllers/campaign");
const router = (0, express_1.Router)();
// POST /campaigns mapping
router.post('/', campaign_1.createCampaign);
exports.default = router;
