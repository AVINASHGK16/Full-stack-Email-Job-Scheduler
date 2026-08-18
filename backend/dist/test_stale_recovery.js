"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const email_queue_1 = require("./queues/email.queue");
const recovery_service_1 = require("./services/recovery.service");
async function main() {
    console.log('🌱 Setting up controlled stale PENDING recipient...');
    const userId = 'dd5ae641-c6f6-4fa3-8443-a1f740fd9654';
    const senderId = '00000000-0000-0000-0000-000000000000';
    // 1. Create a Campaign
    const campaign = await db_1.prisma.campaign.create({
        data: {
            userId,
            senderId,
            subject: 'Controlled Stale Recovery Test',
            body: 'Body of stale campaign',
            startTime: new Date(),
            delaySeconds: 0,
            hourlyLimit: 100,
            status: 'PENDING',
        },
    });
    // 2. Create a Recipient backdated by 45 seconds (stale threshold is 30 seconds)
    const backdatedTime = new Date(Date.now() - 45 * 1000);
    const recipient = await db_1.prisma.recipient.create({
        data: {
            campaignId: campaign.id,
            email: 'stale-recipient@example.com',
            status: 'PENDING',
            scheduledAt: new Date(Date.now() + 10 * 1000), // Scheduled to run in 10 seconds
            createdAt: backdatedTime,
            updatedAt: backdatedTime,
        },
    });
    const jobId = `email-${recipient.id}`;
    console.log(`✅ Created stale Recipient in DB: ID = ${recipient.id}, Status = ${recipient.status}, CreatedAt = ${recipient.createdAt.toISOString()}`);
    console.log(`ℹ️ Checking Redis: Job ${jobId} should NOT exist.`);
    const jobBefore = await email_queue_1.emailQueue.getJob(jobId);
    if (jobBefore) {
        console.log(`🗑️ Removing existing job ${jobId} from Redis...`);
        await jobBefore.remove();
    }
    console.log('✅ Redis is clean. Job does not exist.');
    // 3. Trigger Recovery check first time
    console.log('\n🔄 Triggering RecoveryService check first time...');
    await recovery_service_1.RecoveryService.recoverStalePendingRecipients();
    // 4. Verify PostgreSQL and Redis states after first recovery
    const recipientAfterFirst = await db_1.prisma.recipient.findUnique({ where: { id: recipient.id } });
    console.log('\n📋 Verification after first recovery:');
    console.log(`   PostgreSQL Status: ${recipientAfterFirst?.status} (Expected: QUEUED)`);
    console.log(`   PostgreSQL JobId:  ${recipientAfterFirst?.jobId} (Expected: ${jobId})`);
    const jobAfterFirst = await email_queue_1.emailQueue.getJob(jobId);
    if (jobAfterFirst) {
        const state = await jobAfterFirst.getState();
        console.log(`   Redis Job State:   ${state} (Expected: delayed/waiting)`);
    }
    else {
        console.error('❌ Redis Job NOT found!');
    }
    // 5. Trigger Recovery check second time (Idempotency test)
    console.log('\n🔄 Triggering RecoveryService check second time (Idempotency check)...');
    await recovery_service_1.RecoveryService.recoverStalePendingRecipients();
    const recipientAfterSecond = await db_1.prisma.recipient.findUnique({ where: { id: recipient.id } });
    console.log('\n📋 Verification after second recovery:');
    console.log(`   PostgreSQL Status: ${recipientAfterSecond?.status} (Expected: QUEUED)`);
    console.log(`   PostgreSQL JobId:  ${recipientAfterSecond?.jobId} (Expected: ${jobId})`);
    const jobAfterSecond = await email_queue_1.emailQueue.getJob(jobId);
    if (jobAfterSecond) {
        console.log(`   Redis Job ID:      ${jobAfterSecond.id} (Verified no duplicate job created)`);
    }
    else {
        console.error('❌ Redis Job NOT found after second check!');
    }
}
main()
    .catch(err => {
    console.error('❌ Failed to run stale recovery test:', err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
