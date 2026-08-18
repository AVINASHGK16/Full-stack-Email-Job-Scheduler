"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_1 = require("../controllers/health");
const router = (0, express_1.Router)();
// GET /health mapping
router.get('/', health_1.getHealth);
exports.default = router;
