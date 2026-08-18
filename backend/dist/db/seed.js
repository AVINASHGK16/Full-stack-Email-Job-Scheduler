"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
async function main() {
    console.log('🌱 Seeding development database...');
    // 1. Create or get development User
    const user = await index_1.prisma.user.upsert({
        where: { email: 'dev-user@example.com' },
        update: {},
        create: {
            email: 'dev-user@example.com',
            name: 'Development User',
        },
    });
    console.log(`👤 Development User: ID = ${user.id}, Email = ${user.email}`);
    // 2. Determine SMTP credentials
    let smtpUser = env_1.env.SMTP_USER;
    let smtpPassword = env_1.env.SMTP_PASSWORD;
    let senderEmail = env_1.env.SMTP_USER;
    if (smtpUser === 'your_ethereal_user' || smtpPassword === 'your_ethereal_password') {
        console.log('⚠️ Placeholder credentials detected. Generating temporary Ethereal account...');
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            smtpUser = testAccount.user;
            smtpPassword = testAccount.pass;
            senderEmail = testAccount.user;
            console.log('✅ Generated Ethereal Account:');
            console.log(`   User: ${smtpUser}`);
            console.log(`   Pass: ${smtpPassword}`);
            console.log('💡 Note: You can paste these into your .env file to persist them.');
        }
        catch (err) {
            console.error('❌ Failed to generate Ethereal test account:', err);
            process.exit(1);
        }
    }
    else {
        // If not placeholder, use user as email or custom email
        if (!senderEmail.includes('@')) {
            senderEmail = 'dev-sender@ethereal.email';
        }
    }
    // 3. Create or get Sender for the user
    const sender = await index_1.prisma.sender.upsert({
        where: { id: '00000000-0000-0000-0000-000000000000' },
        update: {
            email: senderEmail,
            smtpUser,
            smtpPassword,
        },
        create: {
            id: '00000000-0000-0000-0000-000000000000',
            userId: user.id,
            email: senderEmail,
            smtpUser,
            smtpPassword,
        },
    });
    console.log(`📧 Development Sender: ID = ${sender.id}, Email = ${sender.email}`);
    console.log('🌱 Seeding completed successfully!');
}
main()
    .catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
})
    .finally(async () => {
    await index_1.prisma.$disconnect();
});
