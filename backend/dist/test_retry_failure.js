"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const campaign_service_1 = require("./services/campaign.service");
async function main() {
    console.log('🧪 Starting Worker Retry Failure Test...');
    const userId = 'dd5ae641-c6f6-4fa3-8443-a1f740fd9654';
    const senderId = '00000000-0000-0000-0000-000000000000';
    // 1. Create a campaign configured to fail all 3 attempts
    console.log('🚀 Creating campaign with forceFailAttempts = 3...');
    const result = await campaign_service_1.CampaignService.createCampaign({
        userId,
        senderId,
        subject: 'Retry Failure Simulation',
        body: 'This job should fail 3 times and exhaust retries',
        startTime: new Date(Date.now() + 2000).toISOString(), // Start in 2s
        delaySeconds: 0,
        hourlyLimit: 100,
        recipients: ['retry-fail@example.com'],
        forceFailAttempts: 3, // Exhausts all 3 attempts (max attempts is 3)
    });
    const recipientId = result.recipients[0].id;
    console.log(`✅ Campaign created. Recipient ID: ${recipientId}`);
    // Wait 12 seconds to cover:
    // Attempt 1 (instant) + backoff 1s + Attempt 2 (after 1s) + backoff 2s + Attempt 3 (after 2s) + processing overhead
    console.log('⏳ Waiting 12 seconds for all attempts to fail and exhaust retries...');
    await new Promise(resolve => setTimeout(resolve, 12000));
    // 2. Query database for final recipient state
    const recipient = await db_1.prisma.recipient.findUnique({
        where: { id: recipientId },
    });
    console.log('\n📋 Verification of final failure state:');
    if (!recipient) {
        console.error('❌ Recipient not found in database!');
        process.exit(1);
    }
    console.log(`   Email:        ${recipient.email}`);
    console.log(`   Status:       ${recipient.status} (Expected: FAILED)`);
    console.log(`   Failed At:    ${recipient.failedAt ? recipient.failedAt.toISOString() : 'NULL'} (Expected: NOT NULL)`);
    console.log(`   Sent At:      ${recipient.sentAt ? recipient.sentAt.toISOString() : 'NULL'} (Expected: NULL)`);
    console.log(`   Error Log:    ${recipient.error || 'NULL'} (Expected: containing "Final attempt failed")`);
    if (recipient.status === 'FAILED' && recipient.failedAt && recipient.error?.includes('Final attempt failed')) {
        console.log('\n🎉 SUCCESS: All BullMQ attempts failed and recipient correctly marked as FAILED.');
    }
    else {
        console.error('\n❌ FAILURE: PostgreSQL status or error fields did not match expected values.');
        process.exit(1);
    }
}
main()
    .catch(err => {
    console.error('❌ Failed to run retry failure test:', err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
