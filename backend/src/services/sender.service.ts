import { prisma } from '../db';
import { AppError } from '../middleware/error';
import type { CreateSenderPayload } from '../validators/sender';

export class SenderService {
  /**
   * Returns all senders owned by the authenticated user.
   *
   * Security & Data Isolation:
   * - Enforces `where: { userId }` at the database level.
   * - Uses explicit `select` to return ONLY safe fields (`id`, `email`, `createdAt`).
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
      },
      orderBy: { createdAt: 'asc' },
    });

    interface SenderItem {
      id: string;
      email: string;
      createdAt: Date;
    }

    return (senders as unknown as SenderItem[]).map((s: SenderItem) => ({
      id: s.id,
      email: s.email,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Creates a new sender record associated with the authenticated user.
   *
   * Security & Data Isolation:
   * - Associates record with userId from authenticated session.
   * - Checks for duplicate senders belonging to the same user.
   * - Explicitly selects only safe fields to return (`id`, `email`, `createdAt`).
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

    // Create the Sender record in database
    const sender = await prisma.sender.create({
      data: {
        userId,
        email: normalizedEmail,
        smtpUser: payload.smtpUser.trim(),
        smtpPassword: payload.smtpPassword,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return sender;
  }
}
