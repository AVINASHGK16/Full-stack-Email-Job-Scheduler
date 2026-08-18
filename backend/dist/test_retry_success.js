"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const campaign_service_1 = require("./services/campaign.service");
async function main() {
    console.log('🧪 Starting Worker Retry Success Test...');
    const userId = 'dd5ae641-c6f6-4fa3-8443-a1f740fd9654';
    const senderId = '00000000-0000-0000-0000-000000000000';
    // 1. Create a campaign configured to fail 1 attempt, then succeed on 2nd attempt
    console.log('🚀 Creating campaign with forceFailAttempts = 1...');
    const result = await campaign_service_1.CampaignService.createCampaign({
        userId,
        senderId,
        subject: 'Retry Success Simulation',
        body: 'This job should fail once, then succeed on retry',
        startTime: new Date(Date.now() + 2000).toISOString(), // Start in 2s
        delaySeconds: 0,
        hourlyLimit: 100,
        recipients: ['retry-success@example.com'],
        forceFailAttempts: 1, // Attempt 1 fails, Attempt 2 succeeds
    });
    const recipientId = result.recipients[0].id;
    console.log(`✅ Campaign created. Recipient ID: ${recipientId}`);
    // Wait 8 seconds to cover:
    // Attempt 1 (instant failure) + backoff 1s + Attempt 2 (succeeds) + SMTP processing overhead
    console.log('⏳ Waiting 8 seconds for retry and eventual success...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    // 2. Query database for final recipient state
    const recipient = await db_1.prisma.recipient.findUnique({
        where: { id: recipientId },
    });
    console.log('\n📋 Verification of final success state:');
    if (!recipient) {
        console.error('❌ Recipient not found in database!');
        process.exit(1);
    }
    console.log(`   Email:        ${recipient.email}`);
    console.log(`   Status:       ${recipient.status} (Expected: SENT)`);
    console.log(`   Failed At:    ${recipient.failedAt ? recipient.failedAt.toISOString() : 'NULL'} (Expected: NULL)`);
    console.log(`   Sent At:      ${recipient.sentAt ? recipient.sentAt.toISOString() : 'NULL'} (Expected: NOT NULL)`);
    console.log(`   Error Log:    ${recipient.error || 'NULL'} (Expected: NULL)`);
    if (recipient.status === 'SENT' && recipient.sentAt && !recipient.failedAt) {
        console.log('\n🎉 SUCCESS: BullMQ job retried and succeeded, marking recipient as SENT.');
    }
    else {
        console.error('\n❌ FAILURE: PostgreSQL status or sentAt fields did not match expected values.');
        process.exit(1);
    }
}
main()
    .catch(err => {
    console.error('❌ Failed to run retry success test:', err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
