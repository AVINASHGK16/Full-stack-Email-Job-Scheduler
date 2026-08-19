import { prisma } from '../db';
import { SenderService } from '../services/sender.service';

async function runSenderSecurityAudit() {
  console.log('===============================================================');
  console.log('🛡️ RUNNING PHASE 9.28.2: SENDER SECURITY & LIFECYCLE AUDIT');
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
    // ── Setup Test User ───────────────────────────────────────────
    const testUser = await prisma.user.upsert({
      where: { email: 'sender-audit@example.com' },
      update: {},
      create: {
        email: 'sender-audit@example.com',
        name: 'Sender Security Auditor',
      },
    });

    // ── TEST 1: POST /senders Response Safe Projection ────────────
    console.log('--- [TEST 1] POST /senders: Password & Credential Sanitization ---');
    const secretPassword = 'SuperSecretSmtpPassword123!#%';
    const createdSender = await SenderService.createSender(testUser.id, {
      email: `audit-sender-${Date.now()}@example.com`,
      smtpUser: 'my_smtp_user_account',
      smtpPassword: secretPassword,
    });

    assert(!('smtpPassword' in createdSender), 'smtpPassword is NOT present in createSender returned object');
    assert(!('smtpUser' in createdSender), 'smtpUser is NOT present in createSender returned object');
    assert(createdSender.id !== undefined && typeof createdSender.id === 'string', 'Sender id returned');
    assert(createdSender.email !== undefined, 'Sender email returned');
    assert(createdSender.verificationStatus === 'PENDING', 'New sender starts with verificationStatus: PENDING');
    assert(createdSender.verifiedAt === null, 'New sender starts with verifiedAt: null');

    // ── TEST 2: GET /senders Response Safe Projection ─────────────
    console.log('\n--- [TEST 2] GET /senders: Omission of Sensitive Credentials ---');
    const sendersList = await SenderService.getSenders(testUser.id);
    const targetSender = sendersList.find(s => s.id === createdSender.id);

    assert(targetSender !== undefined, 'Created sender retrieved via getSenders');
    assert(!('smtpPassword' in (targetSender || {})), 'smtpPassword is OMITTED from getSenders list item');
    assert(!('smtpUser' in (targetSender || {})), 'smtpUser is OMITTED from getSenders list item');
    assert(targetSender?.verificationStatus === 'PENDING', 'getSenders reflects persisted PENDING status');
    assert(targetSender?.verifiedAt === null, 'getSenders reflects persisted verifiedAt: null');

    // ── TEST 3: Verification Failure Handling & State Persistence ─
    console.log('\n--- [TEST 3] Verification Failure Handling & State Persistence ---');
    let verifyFailedError: any = null;
    try {
      // Intentionally invalid SMTP credentials will fail transporter.verify()
      await SenderService.verifySender(testUser.id, createdSender.id);
    } catch (err) {
      verifyFailedError = err;
    }

    assert(verifyFailedError !== null, 'Invalid SMTP credentials produce a verification error');
    assert(!String(verifyFailedError?.message).includes(secretPassword), 'Error message DOES NOT contain the SMTP password');

    // Check database persistence of FAILED state
    const senderAfterFailure = await prisma.sender.findUnique({
      where: { id: createdSender.id },
    });

    assert(senderAfterFailure?.verificationStatus === 'FAILED', 'Database record updated to verificationStatus: FAILED');
    assert(senderAfterFailure?.verifiedAt === null, 'verifiedAt remains null in database');

    // Check getSenders projection after failure
    const sendersAfterFailure = await SenderService.getSenders(testUser.id);
    const targetAfterFailure = sendersAfterFailure.find(s => s.id === createdSender.id);
    assert(targetAfterFailure?.verificationStatus === 'FAILED', 'getSenders reflects persisted FAILED state after failure');

    // ── TEST 4: Verification Success State Persistence ────────────
    console.log('\n--- [TEST 4] Verification Success State Persistence ---');
    // Simulate successful verification state update
    await prisma.sender.update({
      where: { id: createdSender.id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    const sendersAfterSuccess = await SenderService.getSenders(testUser.id);
    const targetAfterSuccess = sendersAfterSuccess.find(s => s.id === createdSender.id);

    assert(targetAfterSuccess?.verificationStatus === 'VERIFIED', 'getSenders reflects persisted VERIFIED state');
    assert(targetAfterSuccess?.verifiedAt !== null, `verifiedAt timestamp is persisted and returned (${targetAfterSuccess?.verifiedAt})`);

    // ── Cleanup Test Data ──────────────────────────────────────────
    await prisma.sender.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 SENDER SECURITY AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Sender security audit error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runSenderSecurityAudit();
