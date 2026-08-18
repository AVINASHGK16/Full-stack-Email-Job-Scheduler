"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const testJob_1 = require("../controllers/testJob");
const router = (0, express_1.Router)();
// POST /test-job mapping
router.post('/', testJob_1.createTestJob);
exports.default = router;
