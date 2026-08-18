import { Request, Response, NextFunction } from 'express';

/**
 * Controller to handle the health check endpoint.
 */
export const getHealth = (_req: Request, res: Response, _next: NextFunction): void => {
  res.status(200).json({ status: 'ok' });
};
