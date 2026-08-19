import nodemailer from 'nodemailer';
import { prisma } from '../db';
import { env } from '../config/env';
import { AppError } from '../middleware/error';
import type { CreateSenderPayload } from '../validators/sender';

export class SenderService {
  /**
   * Returns all senders owned by the authenticated user with persisted verification status.
   *
   * Security & Data Isolation:
   * - Enforces `where: { userId }` at the database level.
   * - Uses explicit `select` to return ONLY safe fields (id, email, createdAt, verificationStatus, verifiedAt).
   * - Never exposes sensitive credentials such as `smtpUser` or `smtpPassword`.
   *
   * @param userId - The authenticated user's ID from req.user.id.
   */
  public static async getSenders(userId: string) {
    const senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        verificationStatus: true,
        verifiedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    interface SenderItem {
      id: string;
      email: string;
      createdAt: Date;
      verificationStatus: string;
      verifiedAt: Date | null;
    }

    return (senders as unknown as SenderItem[]).map((s: SenderItem) => ({
      id: s.id,
      email: s.email,
      createdAt: s.createdAt,
      verificationStatus: s.verificationStatus,
      verifiedAt: s.verifiedAt,
    }));
  }

  /**
   * Creates a new sender record associated with the authenticated user.
   * Initial verification state is set to PENDING and verifiedAt to null.
   *
   * Security & Data Isolation:
   * - Associates record with userId from authenticated session.
   * - Checks for duplicate senders belonging to the same user.
   * - Explicitly selects only safe fields to return.
   * - Never returns or logs `smtpPassword`.
   *
   * @param userId - The authenticated user's ID from req.user.id.
   * @param payload - Validated sender creation data.
   */
  public static async createSender(userId: string, payload: CreateSenderPayload) {
    const normalizedEmail = payload.email.trim().toLowerCase();

    // Check for existing sender with the same email for this user
    const existing = await prisma.sender.findFirst({
      where: {
        userId,
        email: normalizedEmail,
      },
    });

    if (existing) {
      throw new AppError('A sender with this email address already exists.', 409);
    }

    // Create the Sender record in database with PENDING verification status
    const sender = await prisma.sender.create({
      data: {
        userId,
        email: normalizedEmail,
        smtpUser: payload.smtpUser.trim(),
        smtpPassword: payload.smtpPassword,
        verificationStatus: 'PENDING',
        verifiedAt: null,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        verificationStatus: true,
        verifiedAt: true,
      },
    });

    return sender;
  }

  /**
   * Verifies SMTP connection and authentication for a specific sender,
   * updating and persisting the verification lifecycle status in PostgreSQL.
   *
   * Lifecycle behavior:
   * - On success: updates `verificationStatus = 'VERIFIED'` and `verifiedAt = new Date()`.
   * - On failure: updates `verificationStatus = 'FAILED'` and `verifiedAt = null`.
   *
   * Security & Ownership:
   * - Enforces `where: { id: senderId, userId }`.
   * - Uses dedicated `transporter.verify()` without sending real campaign emails.
   * - Never exposes SMTP credentials in return values or error responses.
   *
   * @param userId - Sourced strictly from req.user.id.
   * @param senderId - Sourced from URL parameter :id.
   */
  public static async verifySender(userId: string, senderId: string) {
    const sender = await prisma.sender.findFirst({
      where: {
        id: senderId,
        userId,
      },
    });

    if (!sender) {
      throw new AppError('Sender not found', 404);
    }

    try {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPassword,
        },
      });

      await transporter.verify();

      // Persist VERIFIED status and timestamp in the database
      await prisma.sender.update({
        where: { id: senderId },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });

      return {
        verified: true,
        message: 'SMTP connection verified successfully.',
      };
    } catch (err: unknown) {
      // Persist FAILED status and reset verifiedAt in the database
      await prisma.sender.update({
        where: { id: senderId },
        data: {
          verificationStatus: 'FAILED',
          verifiedAt: null,
        },
      });

      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      throw new AppError(`SMTP verification failed: ${errorMsg}`, 400);
    }
  }
}
