import { prisma } from '../db';

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
}
