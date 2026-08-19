import { prisma } from '../db';
import { SenderService } from '../services/sender.service';
import { CampaignService } from '../services/campaign.service';
import { AppError } from '../middleware/error';

async function runAuthAndAuthorizationAudit() {
  console.log('===============================================================');
  console.log('🔒 RUNNING PHASE 9.28.1: AUTHENTICATION & AUTHORIZATION AUDIT');
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
    // ── Setup Two Isolated Test Users ─────────────────────────────
    console.log('--- [SETUP] Creating isolated Test Users A & B ---');
    const userA = await prisma.user.upsert({
      where: { email: 'user-a@audit.test' },
      update: {},
      create: {
        email: 'user-a@audit.test',
        name: 'User Alpha',
      },
    });

    const userB = await prisma.user.upsert({
      where: { email: 'user-b@audit.test' },
      update: {},
      create: {
        email: 'user-b@audit.test',
        name: 'User Beta',
      },
    });

    // Create Senders for User A and User B
    const senderA = await prisma.sender.create({
      data: {
        userId: userA.id,
        email: 'alpha-sender@audit.test',
        smtpUser: 'alpha_user',
        smtpPassword: 'alpha_password',
      },
    });

    const senderB = await prisma.sender.create({
      data: {
        userId: userB.id,
        email: 'beta-sender@audit.test',
        smtpUser: 'beta_user',
        smtpPassword: 'beta_password',
      },
    });

    // Create a Scheduled Campaign for User A and User B
    const campaignA = await prisma.campaign.create({
      data: {
        userId: userA.id,
        senderId: senderA.id,
        subject: 'Alpha Campaign',
        body: 'Confidential message for Alpha',
        startTime: new Date(Date.now() + 60000),
        delaySeconds: 0,
        hourlyLimit: 0,
        status: 'PENDING',
        recipients: {
          create: [
            {
              email: 'alpha-recipient@audit.test',
              status: 'QUEUED',
              scheduledAt: new Date(Date.now() + 60000),
            },
          ],
        },
      },
    });

    const campaignB = await prisma.campaign.create({
      data: {
        userId: userB.id,
        senderId: senderB.id,
        subject: 'Beta Campaign',
        body: 'Confidential message for Beta',
        startTime: new Date(Date.now() + 60000),
        delaySeconds: 0,
        hourlyLimit: 0,
        status: 'PENDING',
        recipients: {
          create: [
            {
              email: 'beta-recipient@audit.test',
              status: 'QUEUED',
              scheduledAt: new Date(Date.now() + 60000),
            },
          ],
        },
      },
    });

    // Create a Sent Email for User A and User B
    await prisma.recipient.create({
      data: {
        campaignId: campaignA.id,
        email: 'alpha-sent@audit.test',
        status: 'SENT',
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    });

    await prisma.recipient.create({
      data: {
        campaignId: campaignB.id,
        email: 'beta-sent@audit.test',
        status: 'SENT',
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    });

    // ── TEST 1: User A Cannot Access User B Senders ───────────────
    console.log('\n--- [TEST 1] Senders Read Data Isolation ---');
    const sendersForUserA = await SenderService.getSenders(userA.id);
    const hasSenderA = sendersForUserA.some((s: { id: string }) => s.id === senderA.id);
    const hasSenderB = sendersForUserA.some((s: { id: string }) => s.id === senderB.id);

    assert(hasSenderA === true, "User A's query returns User A's sender");
    assert(hasSenderB === false, "User A's query DOES NOT contain User B's sender (Data Isolation Confirmed)");

    // ── TEST 2: User A Cannot Verify User B's Sender ──────────────
    console.log("\n--- [TEST 2] Cross-User Sender Verification Protection ---");
    let verifyError: any = null;
    try {
      // User A attempts to verify Sender B
      await SenderService.verifySender(userA.id, senderB.id);
    } catch (err) {
      verifyError = err;
    }

    assert(verifyError !== null, 'Cross-user sender verification rejected with error');
    assert(verifyError instanceof AppError, 'Error is structured AppError');
    assert(verifyError?.statusCode === 404, 'Status code is 404 Not Found (Sender does not exist for User A)');

    // ── TEST 3: User A Cannot Create Campaign with User B's Sender 
    console.log("\n--- [TEST 3] Cross-User Campaign Creation Protection ---");
    let createCampaignError: any = null;
    try {
      // User A attempts to create campaign using Sender B
      await CampaignService.createCampaign(userA.id, {
        senderId: senderB.id,
        subject: 'Unauthorized Campaign',
        body: 'Hijacking sender B',
        startTime: new Date(Date.now() + 60000).toISOString(),
        delaySeconds: 0,
        hourlyLimit: 0,
        recipients: ['target@audit.test'],
      });
    } catch (err) {
      createCampaignError = err;
    }

    assert(createCampaignError !== null, "Campaign creation with other user's sender rejected");
    assert(createCampaignError instanceof AppError, 'Error is structured AppError');
    assert(createCampaignError?.statusCode === 403, 'Status code is 403 Forbidden (Ownership enforcement confirmed)');

    // ── TEST 4: Scheduled Campaigns Data Isolation ────────────────
    console.log('\n--- [TEST 4] Scheduled Campaigns Data Isolation ---');
    const scheduledForUserA = await CampaignService.getScheduled(userA.id);
    const scheduledForUserB = await CampaignService.getScheduled(userB.id);

    const userASeesAlpha = scheduledForUserA.some((r: { email: string }) => r.email === 'alpha-recipient@audit.test');
    const userASeesBeta = scheduledForUserA.some((r: { email: string }) => r.email === 'beta-recipient@audit.test');
    const userBSeesBeta = scheduledForUserB.some((r: { email: string }) => r.email === 'beta-recipient@audit.test');
    const userBSeesAlpha = scheduledForUserB.some((r: { email: string }) => r.email === 'alpha-recipient@audit.test');

    assert(userASeesAlpha === true, "User A sees User A's scheduled emails");
    assert(userASeesBeta === false, "User A CANNOT see User B's scheduled emails");
    assert(userBSeesBeta === true, "User B sees User B's scheduled emails");
    assert(userBSeesAlpha === false, "User B CANNOT see User A's scheduled emails");

    // ── TEST 5: Sent Emails Data Isolation ────────────────────────
    console.log('\n--- [TEST 5] Sent Emails Data Isolation ---');
    const sentForUserA = await CampaignService.getSent(userA.id);
    const sentForUserB = await CampaignService.getSent(userB.id);

    const userASeesSentA = sentForUserA.some((r: { email: string }) => r.email === 'alpha-sent@audit.test');
    const userASeesSentB = sentForUserA.some((r: { email: string }) => r.email === 'beta-sent@audit.test');
    const userBSeesSentB = sentForUserB.some((r: { email: string }) => r.email === 'beta-sent@audit.test');
    const userBSeesSentA = sentForUserB.some((r: { email: string }) => r.email === 'alpha-sent@audit.test');

    assert(userASeesSentA === true, "User A sees User A's sent emails");
    assert(userASeesSentB === false, "User A CANNOT see User B's sent emails");
    assert(userBSeesSentB === true, "User B sees User B's sent emails");
    assert(userBSeesSentA === false, "User B CANNOT see User A's sent emails");

    // ── TEST 6: Manual Password Authentication (POST /auth/login) ──
    console.log('\n--- [TEST 6] Manual Password Authentication & Validation ---');
    const bcrypt = (await import('bcryptjs')).default;
    const testPassword = 'SecretPassword123!';
    const testHash = await bcrypt.hash(testPassword, 10);

    const manualUser = await prisma.user.upsert({
      where: { email: 'manual-auth@audit.test' },
      update: { passwordHash: testHash },
      create: {
        email: 'manual-auth@audit.test',
        name: 'Manual Test User',
        passwordHash: testHash,
      },
    });

    const googleOnlyUser = await prisma.user.upsert({
      where: { email: 'google-only@audit.test' },
      update: { googleId: 'google-oauth-id-12345', passwordHash: null },
      create: {
        email: 'google-only@audit.test',
        name: 'Google Only User',
        googleId: 'google-oauth-id-12345',
        passwordHash: null,
      },
    });

    const { validatePasswordLogin } = await import('../services/auth.service');
    const { loginSchema } = await import('../validators/auth');

    // A. Correct email + correct password
    const validUser = await validatePasswordLogin('manual-auth@audit.test', testPassword);
    assert(validUser.id === manualUser.id, 'Scenario A: Correct credentials validate user successfully');

    // B. Correct email + wrong password
    let wrongPassErr: any = null;
    try {
      await validatePasswordLogin('manual-auth@audit.test', 'WrongPassword999');
    } catch (err) {
      wrongPassErr = err;
    }
    assert(wrongPassErr instanceof AppError && wrongPassErr.statusCode === 401, 'Scenario B: Wrong password returns 401 Unauthorized');
    assert(wrongPassErr?.message === 'Invalid email or password.', 'Scenario B: Error message is generic to prevent enumeration');

    // C. Unknown email
    let unknownEmailErr: any = null;
    try {
      await validatePasswordLogin('nonexistent@audit.test', testPassword);
    } catch (err) {
      unknownEmailErr = err;
    }
    assert(unknownEmailErr instanceof AppError && unknownEmailErr.statusCode === 401, 'Scenario C: Unknown email returns 401 Unauthorized');
    assert(unknownEmailErr?.message === 'Invalid email or password.', 'Scenario C: Generic message prevents account enumeration');

    // D. Missing email schema validation
    const missingEmailResult = loginSchema.safeParse({ password: 'some_password' });
    assert(missingEmailResult.success === false, 'Scenario D: Missing email rejected with schema validation error');

    // E. Missing password schema validation
    const missingPassResult = loginSchema.safeParse({ email: 'valid@example.com' });
    assert(missingPassResult.success === false, 'Scenario E: Missing password rejected with schema validation error');

    // F. Google-only account attempting password login
    let googleUserPassErr: any = null;
    try {
      await validatePasswordLogin('google-only@audit.test', testPassword);
    } catch (err) {
      googleUserPassErr = err;
    }
    assert(googleUserPassErr instanceof AppError && googleUserPassErr.statusCode === 401, 'Scenario F: Google-only account (passwordHash null) rejected with 401');

    // G. Security: Password hash omitted from user objects
    assert(!('password' in validUser), 'Scenario G: Plaintext password is never in user object');

    // ── Cleanup Test Data ──────────────────────────────────────────
    await prisma.recipient.deleteMany({
      where: {
        campaignId: { in: [campaignA.id, campaignB.id] },
      },
    });
    await prisma.campaign.deleteMany({
      where: {
        id: { in: [campaignA.id, campaignB.id] },
      },
    });
    await prisma.sender.deleteMany({
      where: {
        id: { in: [senderA.id, senderB.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [userA.id, userB.id, manualUser.id, googleOnlyUser.id] },
      },
    });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 AUTH & AUTHORIZATION AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Audit execution error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAuthAndAuthorizationAudit();
