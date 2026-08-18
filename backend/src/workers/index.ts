import { env } from '../config/env';
import './test.worker';
import './email.worker';

console.log(`🚀 Worker process started in ${env.NODE_ENV} mode`);
console.log(`⚙️ Concurrency: ${env.WORKER_CONCURRENCY}`);
