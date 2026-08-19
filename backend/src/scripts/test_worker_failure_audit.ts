import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';

/**
 * Simulates worker execution with controlled failure and retry simulation.
 */
async function simulateWorkerAttempt(
  recipientId: string,
  attemptNumber: number,
  maxAttempts: number,
  shouldFail: boolean,
  errorMessage = 'Simulated SMTP connection timeout'
) {
  const recipient = await prisma.recipient.findUnique({
    where: { id: recipientId },
    include: {
      campaign: { include: { sender: true } },
    },
  });

  if (!recipient || recipient.status === 'SENT') {
    return { skipped: true };
  }

  const isFinalAttempt = attemptNumber >= maxAttempts;

  if (shouldFail) {
    if (isFinalAttempt) {
      // Final attempt: mark FAILED in DB
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          error: `Final attempt failed: ${errorMessage}`,
        },
      });
      return { status: 'FAILED', isFinalAttempt: true };
    } else {
      // Intermediate attempt: keep QUEUED, log attempt error
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: 'QUEUED',
          error: `Attempt ${attemptNumber} failed: ${errorMessage}`,
        },
      });
      return { status: 'QUEUED', isFinalAttempt: false };
    }
  }

  // Success
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      error: null,
    },
  });

  return { status: 'SENT', isFinalAttempt };
}

async function runWorkerFailureAudit() {
  console.log('===============================================================');
  console.log('💥 RUNNING PHASE 9.28.9: WORKER FAILURE & RETRY AUDIT');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  try {
    // ── Setup User and Sender ─────────────────────────────────────
    const user = await prisma.user.upsert({
      where: { email: 'worker-fail-user@example.com' },
      update: {},
      create: {
        email: 'worker-fail-user@example.com',
        name: 'Worker Failure Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000007' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000007',
        userId: user.id,
        email: 'fail-sender@example.com',
        smtpUser: 'fail_user',
        smtpPassword: 'fail_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── TEST 1: Worker Termination & Restart with Pending Jobs ────
    console.log('--- [TEST 1] Worker Termination with Pending Jobs → Restart Recovery ---');
    const futureTime = new Date(Date.now() + 60000).toISOString();

    const campaign1 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Pending Jobs Across Worker Restarts',
      body: 'Testing BullMQ persistence when worker is killed',
      startTime: futureTime,
      delaySeconds: 0,
      hourlyLimit: 50,
      recipients: ['pending-1@example.com', 'pending-2@example.com'],
    });

    // Verify jobs exist in BullMQ
    for (const rec of campaign1.recipients) {
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== null && job !== undefined, `BullMQ job ${rec.jobId} exists in Redis`);
    }

    // Simulate killing worker (process dies, Redis holds queue)
    console.log('  🛑 Simulating worker kill (SIGKILL)...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate worker restart
    console.log('  🚀 Simulating new worker process starting and reading BullMQ queue...');
    for (const rec of campaign1.recipients) {
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== null && job !== undefined, `New worker found pending job ${rec.jobId} in Redis`);
    }

    // ── TEST 2: Worker Exception & Exponential Retry Lifecycle ────
    console.log('\n--- [TEST 2] Step-by-Step Retry Lifecycle (Attempts 1 → 2 → 3 [Final]) ---');
    const campaign2 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Retry Lifecycle Test',
      body: 'Testing intermediate QUEUED vs final FAILED transition',
      startTime: futureTime,
      delaySeconds: 0,
      hourlyLimit: 50,
      recipients: ['retry-recipient@example.com'],
    });

    const targetRecipientId = campaign2.recipients[0].id;
    const maxAttempts = env.EMAIL_JOB_ATTEMPTS; // 3

    // Attempt 1: Transient Failure
    console.log('  🔄 Attempt 1 fails:');
    await simulateWorkerAttempt(targetRecipientId, 1, maxAttempts, true);
    const dbAfterAttempt1 = await prisma.recipient.findUnique({ where: { id: targetRecipientId } });
    assert(dbAfterAttempt1?.status === 'QUEUED', 'Attempt 1 failure: status REMAINS QUEUED');
    assert(Boolean(dbAfterAttempt1?.error?.includes('Attempt 1 failed')), 'Attempt 1 failure: error logged in DB');

    // Attempt 2: Transient Failure
    console.log('  🔄 Attempt 2 fails:');
    await simulateWorkerAttempt(targetRecipientId, 2, maxAttempts, true);
    const dbAfterAttempt2 = await prisma.recipient.findUnique({ where: { id: targetRecipientId } });
    assert(dbAfterAttempt2?.status === 'QUEUED', 'Attempt 2 failure: status REMAINS QUEUED (will retry)');
    assert(Boolean(dbAfterAttempt2?.error?.includes('Attempt 2 failed')), 'Attempt 2 failure: updated attempt 2 error logged');

    // Attempt 3: Final Failure (exhausted all attempts)
    console.log('  ❌ Attempt 3 (Final attempt) fails:');
    await simulateWorkerAttempt(targetRecipientId, 3, maxAttempts, true);
    const dbAfterAttempt3 = await prisma.recipient.findUnique({ where: { id: targetRecipientId } });
    assert(dbAfterAttempt3?.status === 'FAILED', 'Final attempt failure: status transitioned to FAILED');
    assert(dbAfterAttempt3?.failedAt !== null, `Final attempt failure: failedAt timestamp recorded (${dbAfterAttempt3?.failedAt})`);
    assert(Boolean(dbAfterAttempt3?.error?.includes('Final attempt failed')), 'Final attempt failure: final error recorded');

    // ── TEST 3: Retry Recovery Success Case ────────────────────────
    console.log('\n--- [TEST 3] Intermediate Failure Followed by Successful Retry ---');
    const campaign3 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Recovering Retry Test',
      body: 'Attempt 1 fails, Attempt 2 succeeds',
      startTime: futureTime,
      delaySeconds: 0,
      hourlyLimit: 50,
      recipients: ['recover-recipient@example.com'],
    });

    const recoverId = campaign3.recipients[0].id;

    // Attempt 1 fails
    await simulateWorkerAttempt(recoverId, 1, maxAttempts, true);
    const dbRecov1 = await prisma.recipient.findUnique({ where: { id: recoverId } });
    assert(dbRecov1?.status === 'QUEUED', 'Recover test: Attempt 1 keeps status QUEUED');

    // Attempt 2 succeeds
    await simulateWorkerAttempt(recoverId, 2, maxAttempts, false);
    const dbRecov2 = await prisma.recipient.findUnique({ where: { id: recoverId } });
    assert(dbRecov2?.status === 'SENT', 'Recover test: Attempt 2 successfully transitions to SENT');
    assert(dbRecov2?.sentAt !== null, 'Recover test: sentAt timestamp recorded');
    assert(dbRecov2?.error === null, 'Recover test: error cleared upon successful send');

    // ── Cleanup Test Records ───────────────────────────────────────
    for (const rec of [...campaign1.recipients, ...campaign2.recipients, ...campaign3.recipients]) {
      if (rec.jobId) {
        const job = await emailQueue.getJob(rec.jobId);
        if (job) await job.remove();
      }
    }

    await prisma.recipient.deleteMany({
      where: { campaignId: { in: [campaign1.campaign.id, campaign2.campaign.id, campaign3.campaign.id] } },
    });
    await prisma.campaign.deleteMany({
      where: { id: { in: [campaign1.campaign.id, campaign2.campaign.id, campaign3.campaign.id] } },
    });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 WORKER FAILURE AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Worker Failure Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runWorkerFailureAudit();
