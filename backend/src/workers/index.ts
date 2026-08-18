import { env } from '../config/env';
import './test.worker';
import './email.worker';
import { RecoveryService } from '../services/recovery.service';

console.log(`🚀 Worker process started in ${env.NODE_ENV} mode`);
console.log(`⚙️ Concurrency: ${env.WORKER_CONCURRENCY}`);

// Trigger recovery of stale PENDING recipients on startup
console.log('🔄 Triggering startup recovery check...');
RecoveryService.recoverStalePendingRecipients()
  .then(() => console.log('🔄 Startup recovery check completed.'))
  .catch(err => console.error('❌ Startup recovery check failed:', err));
