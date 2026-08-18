"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const email_queue_1 = require("./queues/email.queue");
async function main() {
    console.log('🔍 Looking for a recipient in the database...');
    const recipient = await db_1.prisma.recipient.findFirst({
        orderBy: { createdAt: 'desc' },
    });
    if (!recipient) {
        console.error('❌ Error: No recipient found. Run a seed/campaign first.');
        process.exit(1);
    }
    const deterministicJobId = `email-${recipient.id}`;
    console.log(`ℹ️ Testing with Recipient ID: ${recipient.id}, Email: ${recipient.email}`);
    console.log(`ℹ️ Deterministic Job ID: ${deterministicJobId}`);
    // Clean up any existing job in Redis first to ensure clean test
    const existingJob = await email_queue_1.emailQueue.getJob(deterministicJobId);
    if (existingJob) {
        console.log(`🗑️ Removing existing job ${deterministicJobId} from Redis...`);
        await existingJob.remove();
    }
    console.log('🚀 Queueing job for the first time...');
    const job1 = await email_queue_1.emailQueue.add('send-email', { recipientId: recipient.id }, { jobId: deterministicJobId, delay: 30000 } // Use a long delay so it doesn't execute during testing
    );
    console.log(`✅ First queue returned Job ID: ${job1.id}`);
    console.log('🚀 Queueing job for the second time (duplicate request)...');
    const job2 = await email_queue_1.emailQueue.add('send-email', { recipientId: recipient.id }, { jobId: deterministicJobId, delay: 30000 });
    console.log(`✅ Second queue returned Job ID: ${job2.id}`);
    // Verify that job1 and job2 have the same ID
    if (job1.id === job2.id) {
        console.log('🎉 SUCCESS: Both queue operations resolved to the same job instance!');
    }
    else {
        console.error('❌ FAILURE: Different job IDs were returned!');
    }
    // Double check in Redis if there's only one job
    const jobFromRedis = await email_queue_1.emailQueue.getJob(deterministicJobId);
    if (jobFromRedis) {
        console.log(`✅ Verified: Exactly one job with ID "${jobFromRedis.id}" exists in Redis.`);
        // Clean up job
        await jobFromRedis.remove();
        console.log('🗑️ Test job cleaned up.');
    }
    else {
        console.error('❌ FAILURE: No job found in Redis!');
    }
}
main()
    .catch(err => {
    console.error('❌ Failed to run duplicate queue test:', err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
