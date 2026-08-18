"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
require("./test.worker");
require("./email.worker");
console.log(`🚀 Worker process started in ${env_1.env.NODE_ENV} mode`);
console.log(`⚙️ Concurrency: ${env_1.env.WORKER_CONCURRENCY}`);
