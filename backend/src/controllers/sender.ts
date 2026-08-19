import { Request, Response, NextFunction } from 'express';
import { SenderService } from '../services/sender.service';

/**
 * Controller to handle GET /senders requests.
 *
 * Authentication boundary:
 *  - Guarded by requireAuth middleware.
 *  - userId is derived exclusively from req.user!.id (server session).
 *  - Never accepts userId from client parameters.
 *
 * Returns only senders belonging to the authenticated user.
 * Sensitive fields (smtpUser, smtpPassword) are omitted.
 */
export const getSenders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const senders = await SenderService.getSenders(userId);

    res.status(200).json({
      status: 'success',
      data: senders,
    });
  } catch (error) {
    next(error);
  }
};
