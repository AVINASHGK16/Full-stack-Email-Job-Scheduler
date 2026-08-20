import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';
import { RecoveryService } from '../services/recovery.service';

async function run1000RecipientLoadTest() {
  console.log('===============================================================');
  console.log('⚡ RUNNING 1000-RECIPIENT LOAD & CAPACITY VERIFICATION');
  console.log('===============================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, message: string) {
    totalChecks++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedChecks++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  let testUserId = '';
  let testSenderId = '';
  let createdCampaignId = '';
  const createdJobIds: string[] = [];

  try {
    // ── 1. Create Dedicated Test User & Sender ──
    console.log('--- [STEP 1] Setting Up Test User & Sender ---');
    const user = await prisma.user.upsert({
      where: { email: 'loadtest-harness@example.com' },
      update: {},
      create: {
        email: 'loadtest-harness@example.com',
        name: 'Load Test Harness',
      },
    });
    testUserId = user.id;

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000001000' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000001000',
        userId: user.id,
        email: 'loadtest-sender@example.com',
        smtpUser: 'loadtest_user',
        smtpPassword: 'loadtest_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });
    testSenderId = sender.id;

    console.log(`  👤 Test User: ${user.email} (${user.id})`);
    console.log(`  📧 Test Sender: ${sender.email} (${sender.id})`);

    // ── 2. Generate 1000 Synthetic Unique Emails ──
    console.log('\n--- [STEP 2] Generating 1000 Synthetic Email Addresses ---');
    const TOTAL_RECIPIENTS = 1000;
    const syntheticEmails: string[] = Array.from({ length: TOTAL_RECIPIENTS }, (_, i) => {
      const pad = String(i + 1).padStart(4, '0');
      return `loadtest${pad}@example.com`;
    });

    const uniqueGenerated = new Set(syntheticEmails);
    assert(syntheticEmails.length === 1000, `Generated array contains 1000 items (actual=${syntheticEmails.length})`);
    assert(uniqueGenerated.size === 1000, `Generated set contains 1000 unique items (actual=${uniqueGenerated.size})`);

    // ── 3. Schedule 1 Campaign with Safe 24-Hour Future Start Time ──
    console.log('\n--- [STEP 3] Creating Campaign with 1000 Recipients (24h in future) ---');
    const safeFutureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const startTimeMs = new Date(safeFutureTime).getTime();

    const tStart = Date.now();
    const result = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: '1000 Recipient Load Test',
      body: 'Automated 1000 recipient load verification testing delay scheduling and queue capacity.',
      startTime: safeFutureTime,
      delaySeconds: 1,
      hourlyLimit: 500,
      recipients: syntheticEmails,
    });
    const durationMs = Date.now() - tStart;

    createdCampaignId = result.campaign.id;
    console.log(`  ⏱️ Campaign Creation & BullMQ Enqueue Duration: ${durationMs}ms`);
    assert(result.campaign.id !== undefined, `Campaign created with ID: ${result.campaign.id}`);
    assert(result.recipients.length === 1000, `API response returned 1000 scheduled recipients (actual=${result.recipients.length})`);
    assert(!result.failures || result.failures.length === 0, `Zero enqueue failures reported (failures=${result.failures?.length ?? 0})`);

    // ── 4. Verify PostgreSQL Database Records ──
    console.log('\n--- [STEP 4] Verifying PostgreSQL Persistence & Integrity ---');
    const dbRecipients = await prisma.recipient.findMany({
      where: { campaignId: createdCampaignId },
      orderBy: { scheduledAt: 'asc' },
    });

    assert(dbRecipients.length === 1000, `Database contains exactly 1000 Recipient records for campaign (actual=${dbRecipients.length})`);

    const dbEmailsSet = new Set(dbRecipients.map(r => r.email));
    assert(dbEmailsSet.size === 1000, `All 1000 database recipient emails are distinct (unique count=${dbEmailsSet.size})`);

    const allQueued = dbRecipients.every(r => r.status === 'QUEUED');
    assert(allQueued, 'All 1000 database recipient records have status QUEUED');

    const allHaveJobIds = dbRecipients.every(r => r.jobId && r.jobId.startsWith('email-'));
    assert(allHaveJobIds, 'All 1000 database recipients have deterministic jobId matching email-${id}');

    const jobIdsSet = new Set(dbRecipients.map(r => r.jobId!));
    assert(jobIdsSet.size === 1000, `All 1000 job IDs are unique with zero collisions (unique count=${jobIdsSet.size})`);

    // Verify scheduledAt incremental staggering (delaySeconds: 1)
    const firstScheduled = new Date(dbRecipients[0].scheduledAt).getTime();
    const lastScheduled = new Date(dbRecipients[999].scheduledAt).getTime();
    const expectedLastOffsetMs = 999 * 1000;
    assert(Math.abs(firstScheduled - startTimeMs) < 1000, `First recipient scheduledAt matches campaign start time`);
    assert(Math.abs(lastScheduled - (startTimeMs + expectedLastOffsetMs)) < 1000, `Last (1000th) recipient scheduledAt staggered by 999s`);

    // ── 5. Verify BullMQ / Redis Delayed Queue ──
    console.log('\n--- [STEP 5] Verifying BullMQ Redis Delayed Workload ---');
    for (const r of dbRecipients) {
      if (r.jobId) createdJobIds.push(r.jobId);
    }

    // Sample inspect first, middle, and last jobs in Redis
    const firstJob = await emailQueue.getJob(dbRecipients[0].jobId!);
    const midJob = await emailQueue.getJob(dbRecipients[499].jobId!);
    const lastJob = await emailQueue.getJob(dbRecipients[999].jobId!);

    assert(firstJob !== null && firstJob !== undefined, `First BullMQ job ${dbRecipients[0].jobId} exists in Redis`);
    assert(midJob !== null && midJob !== undefined, `500th BullMQ job ${dbRecipients[499].jobId} exists in Redis`);
    assert(lastJob !== null && lastJob !== undefined, `1000th BullMQ job ${dbRecipients[999].jobId} exists in Redis`);

    const firstState = await firstJob?.getState();
    const midState = await midJob?.getState();
    const lastState = await lastJob?.getState();
    assert(firstState === 'delayed', `First job is in BullMQ state 'delayed' (actual=${firstState})`);
    assert(midState === 'delayed', `500th job is in BullMQ state 'delayed' (actual=${midState})`);
    assert(lastState === 'delayed', `1000th job is in BullMQ state 'delayed' (actual=${lastState})`);

    const delayedCount = await emailQueue.getDelayedCount();
    assert(delayedCount >= 1000, `BullMQ delayed count reflects workload (delayedCount=${delayedCount})`);

    // ── 6. Verify Scheduled API Query Isolation & Response ──
    console.log('\n--- [STEP 6] Testing GET /campaigns/scheduled Performance & Count ---');
    const tQueryStart = Date.now();
    const scheduledList = await CampaignService.getScheduled(user.id);
    const queryDurationMs = Date.now() - tQueryStart;
    console.log(`  ⏱️ getScheduled query duration for 1000 items: ${queryDurationMs}ms`);

    const userScheduledCount = scheduledList.filter(s => s.campaignId === createdCampaignId).length;
    assert(userScheduledCount === 1000, `CampaignService.getScheduled returned all 1000 scheduled items for user (actual=${userScheduledCount})`);

    // ── 7. Verify Crash Recovery Self-Healing Mechanism on Workload ──
    console.log('\n--- [STEP 7] Verifying Crash Recovery Verification on 1000 Jobs ---');
    const recoveryStart = Date.now();
    await RecoveryService.recoverStalePendingRecipients();
    const recoveryDurationMs = Date.now() - recoveryStart;
    console.log(`  ⏱️ Recovery check scan completed in: ${recoveryDurationMs}ms`);
    assert(recoveryDurationMs < 5000, 'Recovery scan completed efficiently without blocking');

    // ── 8. Safe Cleanup of Test Data ──
    console.log('\n--- [STEP 8] Safely Cleaning Up Test Load Data ---');
    console.log(`  🧹 Removing ${createdJobIds.length} test BullMQ jobs from Redis...`);
    let removedJobs = 0;
    for (const jid of createdJobIds) {
      try {
        const job = await emailQueue.getJob(jid);
        if (job) {
          await job.remove();
          removedJobs++;
        }
      } catch (err) {
        // Ignore single removal error
      }
    }
    console.log(`  🧹 Cleaned ${removedJobs}/1000 Redis jobs.`);

    console.log('  🧹 Deleting test database records...');
    const deletedRecipients = await prisma.recipient.deleteMany({
      where: { campaignId: createdCampaignId },
    });
    console.log(`  🧹 Deleted ${deletedRecipients.count} test Recipient records.`);

    await prisma.campaign.delete({ where: { id: createdCampaignId } });
    console.log(`  🧹 Deleted test Campaign record.`);

    await prisma.sender.delete({ where: { id: testSenderId } });
    console.log(`  🧹 Deleted test Sender record.`);

    await prisma.user.delete({ where: { id: testUserId } });
    console.log(`  🧹 Deleted test User record.`);

    assert(deletedRecipients.count === 1000, 'All 1000 test recipient records cleaned from PostgreSQL');

    // ── SUMMARY REPORT ──
    console.log('\n===============================================================');
    console.log(`📊 LOAD TEST AUDIT RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Load Test Execution Error:', error);
    // Cleanup if error occurred
    if (createdCampaignId) {
      try {
        await prisma.recipient.deleteMany({ where: { campaignId: createdCampaignId } });
        await prisma.campaign.delete({ where: { id: createdCampaignId } });
      } catch (cleanupErr) {
        console.error('Error during cleanup:', cleanupErr);
      }
    }
    if (testSenderId) {
      try { await prisma.sender.delete({ where: { id: testSenderId } }); } catch (_) {}
    }
    if (testUserId) {
      try { await prisma.user.delete({ where: { id: testUserId } }); } catch (_) {}
    }
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

run1000RecipientLoadTest();
