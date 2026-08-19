import { Request, Response, NextFunction } from 'express';
import { createCampaignSchema } from '../validators/campaign';
import { CampaignService } from '../services/campaign.service';

/**
 * Controller to handle POST /campaigns requests.
 *
 * Authentication boundary:
 *  - req.user is guaranteed to be populated by requireAuth (applied in the router).
 *  - userId is extracted exclusively from req.user.id — never from req.body or req.query.
 *  - Any userId field present in the request body is silently ignored by the Zod schema.
 */
export const createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Extract the authenticated user's ID from the session.
    //    req.user is populated by Passport's deserializeUser after requireAuth passes.
    //    We assert non-null here because requireAuth guarantees req.isAuthenticated() is true.
    const userId = req.user!.id;

    // 2. Validate the client-supplied payload using Zod schema.
    //    The schema does NOT include userId — it cannot be supplied by the client.
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.format(),
      });
      return;
    }

    // 3. Delegate to CampaignService, passing userId explicitly from the session.
    //    The service enforces: user exists, sender exists, sender belongs to userId.
    const result = await CampaignService.createCampaign(userId, parsed.data);

    // 4. Format and return API response.
    //    207 Multi-Status when some BullMQ jobs failed to enqueue; 201 Created on full success.
    const statusCode = 'failures' in result ? 207 : 201;

    res.status(statusCode).json({
      status: 'failures' in result ? 'partial_success' : 'success',
      campaign: result.campaign,
      recipients: result.recipients,
      ...('failures' in result && { failures: result.failures }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle GET /campaigns/scheduled requests.
 *
 * Authentication boundary (identical to createCampaign):
 *  - req.user is guaranteed to be populated by requireAuth.
 *  - userId is extracted exclusively from req.user.id.
 *  - No userId is accepted from query parameters or the URL.
 *
 * Returns only recipients whose parent campaign belongs to the
 * authenticated user. Another user's data is never included.
 *
 * Read-only: no mutations occur.
 */
export const getScheduledCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const scheduled = await CampaignService.getScheduled(userId);

    res.status(200).json({
      status: 'success',
      data: scheduled,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle GET /campaigns/sent requests.
 *
 * Authentication boundary (identical to getScheduledCampaigns):
 *  - req.user is guaranteed to be populated by requireAuth.
 *  - userId is extracted exclusively from req.user.id.
 *  - No userId is accepted from query parameters or the URL.
 *
 * Returns only recipients with status 'SENT' whose parent campaign belongs to the
 * authenticated user. Another user's data is never included.
 *
 * Read-only: no mutations occur.
 */
export const getSentCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const sent = await CampaignService.getSent(userId);

    res.status(200).json({
      status: 'success',
      data: sent,
    });
  } catch (error) {
    next(error);
  }
};


