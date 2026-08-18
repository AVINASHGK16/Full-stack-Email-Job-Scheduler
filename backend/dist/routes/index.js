"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_1 = __importDefault(require("./health"));
const testJob_1 = __importDefault(require("./testJob"));
const campaigns_1 = __importDefault(require("./campaigns"));
const router = (0, express_1.Router)();
// Mount individual route handlers
router.use('/health', health_1.default);
router.use('/test-job', testJob_1.default);
router.use('/campaigns', campaigns_1.default);
exports.default = router;
