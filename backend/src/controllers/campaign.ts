import { Request, Response, NextFunction } from 'express';
import { createCampaignSchema } from '../validators/campaign';
import { CampaignService } from '../services/campaign.service';

/**
 * Controller to handle POST /campaigns requests.
 */
export const createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Validate payload using Zod schema
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.format(),
      });
      return;
    }

    // 2. Delegate creation and scheduling to CampaignService
    const result = await CampaignService.createCampaign(parsed.data);

    // 3. Format and return API response
    // If there were any failures queueing, we return a 207 Multi-Status or similar,
    // or just return success with the failures list attached. The prompt suggests returning
    // success with scheduled recipients.
    const statusCode = result.hasOwnProperty('failures') ? 207 : 201;

    res.status(statusCode).json({
      status: result.hasOwnProperty('failures') ? 'partial_success' : 'success',
      campaign: result.campaign,
      recipients: result.recipients,
      ...(result.hasOwnProperty('failures') && { failures: (result as any).failures }),
    });
  } catch (error) {
    next(error);
  }
};
