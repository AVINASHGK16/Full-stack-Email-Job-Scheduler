import { prisma } from './index';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

async function main() {
  console.log('🌱 Seeding development database...');

  // 1. Create or get development User
  const user = await prisma.user.upsert({
    where: { email: 'dev-user@example.com' },
    update: {},
    create: {
      email: 'dev-user@example.com',
      name: 'Development User',
    },
  });
  console.log(`👤 Development User: ID = ${user.id}, Email = ${user.email}`);

  // 2. Determine SMTP credentials
  let smtpUser = env.SMTP_USER;
  let smtpPassword = env.SMTP_PASSWORD;
  let senderEmail = env.SMTP_USER;

  if (smtpUser === 'your_ethereal_user' || smtpPassword === 'your_ethereal_password') {
    console.log('⚠️ Placeholder credentials detected. Generating temporary Ethereal account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      smtpUser = testAccount.user;
      smtpPassword = testAccount.pass;
      senderEmail = testAccount.user;
      console.log('✅ Generated Ethereal Account:');
      console.log(`   User: ${smtpUser}`);
      console.log(`   Pass: ${smtpPassword}`);
      console.log('💡 Note: You can paste these into your .env file to persist them.');
    } catch (err) {
      console.error('❌ Failed to generate Ethereal test account:', err);
      process.exit(1);
    }
  } else {
    // If not placeholder, use user as email or custom email
    if (!senderEmail.includes('@')) {
      senderEmail = 'dev-sender@ethereal.email';
    }
  }

  // 3. Create or get Sender for the user
  const sender = await prisma.sender.upsert({
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
    await prisma.$disconnect();
  });
