-- CreateEnum
CREATE TYPE "SenderVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "senders" ADD COLUMN     "verificationStatus" "SenderVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
