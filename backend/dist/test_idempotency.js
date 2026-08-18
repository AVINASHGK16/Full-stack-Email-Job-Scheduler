"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const email_queue_1 = require("./queues/email.queue");
async function main() {
    console.log('🔍 Looking for a SENT recipient in the database...');
    const recipient = await db_1.prisma.recipient.findFirst({
        where: { status: 'SENT' },
    });
    if (!recipient) {
        console.error('❌ Error: No SENT recipient found. Run a successful campaign first.');
        process.exit(1);
    }
    console.log(`✅ Found SENT Recipient:`);
    console.log(`   Email:   ${recipient.email}`);
    console.log(`   ID:      ${recipient.id}`);
    console.log(`   SentAt:  ${recipient.sentAt ? recipient.sentAt.toISOString() : 'NULL'}`);
    console.log('🚀 Enqueueing a duplicate send-email job in the email-scheduler queue...');
    const job = await email_queue_1.emailQueue.add('send-email', {
        recipientId: recipient.id,
    });
    console.log(`🎉 Job enqueued successfully. Job ID: ${job.id}`);
}
main()
    .catch(err => {
    console.error('❌ Failed to run idempotency test:', err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
