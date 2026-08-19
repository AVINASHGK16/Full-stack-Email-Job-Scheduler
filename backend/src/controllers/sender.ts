import { Request, Response, NextFunction } from 'express';
import { SenderService } from '../services/sender.service';
import { createSenderSchema } from '../validators/sender';

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

/**
 * Controller to handle POST /senders requests.
 *
 * Authentication boundary:
 *  - Guarded by requireAuth middleware.
 *  - userId is derived exclusively from req.user!.id (server session).
 *  - Never accepts userId from client parameters.
 *
 * Validates request payload and creates a new sender.
 * Returns 201 Created with safe fields (id, email, createdAt).
 */
export const createSender = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const parsed = createSenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.format(),
      });
      return;
    }

    const sender = await SenderService.createSender(userId, parsed.data);

    res.status(201).json({
      status: 'success',
      data: sender,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle POST /senders/:id/verify requests.
 *
 * Authentication boundary:
 *  - Guarded by requireAuth middleware.
 *  - userId is derived exclusively from req.user!.id (server session).
 *  - Verifies SMTP credentials and connection.
 */
export const verifySender = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await SenderService.verifySender(userId, id);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
