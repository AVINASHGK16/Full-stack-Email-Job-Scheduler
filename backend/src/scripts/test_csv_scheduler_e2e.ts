import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';

// Duplicate of frontend parsing logic to verify frontend contract matches backend expectation
function extractEmailsFromCsvText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];

  const seen = new Set<string>();
  const uniqueEmails: string[] = [];

  for (const match of matches) {
    const trimmed = match.trim();
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueEmails.push(trimmed);
    }
  }

  return uniqueEmails;
}

function parseManualTokens(raw: string): { validEmails: string[]; invalidTokens: string[] } {
  const tokens = raw.split(/[,;\s\n\r]+/).map(t => t.trim()).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails: string[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    if (emailRegex.test(token)) {
      validEmails.push(token);
    } else {
      invalidTokens.push(token);
    }
  }

  return { validEmails, invalidTokens };
}

async function runCsvSchedulerE2ETest() {
  console.log('===============================================================');
  console.log('📁 RUNNING PHASE 9.28.4: CSV/TXT → SCHEDULER E2E AUDIT');
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
      where: { email: 'csv-test-user@example.com' },
      update: {},
      create: {
        email: 'csv-test-user@example.com',
        name: 'CSV Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        userId: user.id,
        email: 'csv-sender@example.com',
        smtpUser: 'csv_smtp_user',
        smtpPassword: 'csv_smtp_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── TEST 1: CSV / TXT Parsing & Email Extraction ──────────────
    console.log('--- [TEST 1] File Content Parsing, Validation & Deduplication ---');
    const rawCsvContent = `
john@gmail.com
sarah@gmail.com
john@gmail.com
bad-email
alex@gmail.com
`;

    const extractedEmails = extractEmailsFromCsvText(rawCsvContent);

    assert(extractedEmails.length === 3, `Extracted 3 unique valid emails (actual=${extractedEmails.length})`);
    assert(extractedEmails.includes('john@gmail.com'), 'Contains john@gmail.com');
    assert(extractedEmails.includes('sarah@gmail.com'), 'Contains sarah@gmail.com');
    assert(extractedEmails.includes('alex@gmail.com'), 'Contains alex@gmail.com');
    assert(!extractedEmails.includes('bad-email'), 'Invalid string "bad-email" was excluded');

    // Count duplicates of john@gmail.com
    const johnCount = extractedEmails.filter(e => e.toLowerCase() === 'john@gmail.com').length;
    assert(johnCount === 1, 'Duplicate john@gmail.com deduplicated to exactly 1');

    // ── TEST 2: Manual Invalid Token Detection & Blocking ─────────
    console.log('\n--- [TEST 2] Manual Invalid Address Detection & Blocking ---');
    const manualInput = 'john@gmail.com, bad-email, alex@gmail.com';
    const { validEmails: manualValid, invalidTokens } = parseManualTokens(manualInput);

    assert(invalidTokens.includes('bad-email'), 'Detected "bad-email" in invalidTokens list');
    assert(invalidTokens.length === 1, 'Exactly 1 invalid token detected');
    assert(manualValid.length === 2, '2 valid emails identified from manual string');

    // ── TEST 3: Campaign Submission with Extracted CSV Recipients ──
    console.log('\n--- [TEST 3] Backend POST /campaigns with 3 Extracted Recipients ---');
    const startTime = new Date(Date.now() + 60000).toISOString();

    const campaignResult = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Quarterly Team Sync',
      body: 'Hi everyone, please find the quarterly sync agenda attached.',
      startTime,
      delaySeconds: 1,
      hourlyLimit: 50,
      recipients: extractedEmails,
    });

    assert(campaignResult.campaign.id !== undefined, 'Campaign created in PostgreSQL');
    assert(campaignResult.recipients.length === 3, 'Response contains 3 scheduled recipients');

    // Verify PostgreSQL Recipient records
    const dbRecipients = await prisma.recipient.findMany({
      where: { campaignId: campaignResult.campaign.id },
      orderBy: { scheduledAt: 'asc' },
    });

    assert(dbRecipients.length === 3, `3 Recipient records saved in PostgreSQL (actual=${dbRecipients.length})`);
    assert(dbRecipients.every(r => r.status === 'QUEUED'), 'All 3 recipients have status QUEUED');

    // Verify BullMQ Jobs in Redis
    for (const rec of dbRecipients) {
      assert(rec.jobId !== null, `Recipient ${rec.email} has jobId: ${rec.jobId}`);
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== null && job !== undefined, `BullMQ job ${rec.jobId} exists in Redis queue`);
      if (job) await job.remove();
    }

    // Verify Scheduled API returns all 3
    const scheduledList = await CampaignService.getScheduled(user.id);
    const campaignRecipientsInScheduled = scheduledList.filter(
      r => r.campaignId === campaignResult.campaign.id
    );
    assert(
      campaignRecipientsInScheduled.length === 3,
      'GET /campaigns/scheduled returns all 3 newly queued recipients'
    );

    // ── Cleanup Test Records ───────────────────────────────────────
    await prisma.recipient.deleteMany({
      where: { campaignId: campaignResult.campaign.id },
    });
    await prisma.campaign.delete({
      where: { id: campaignResult.campaign.id },
    });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 CSV/TXT → SCHEDULER AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ CSV Scheduler Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runCsvSchedulerE2ETest();
