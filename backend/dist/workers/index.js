"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
require("./test.worker");
require("./email.worker");
const recovery_service_1 = require("../services/recovery.service");
console.log(`🚀 Worker process started in ${env_1.env.NODE_ENV} mode`);
console.log(`⚙️ Concurrency: ${env_1.env.WORKER_CONCURRENCY}`);
// Trigger recovery of stale PENDING recipients on startup
console.log('🔄 Triggering startup recovery check...');
recovery_service_1.RecoveryService.recoverStalePendingRecipients()
    .then(() => console.log('🔄 Startup recovery check completed.'))
    .catch(err => console.error('❌ Startup recovery check failed:', err));
