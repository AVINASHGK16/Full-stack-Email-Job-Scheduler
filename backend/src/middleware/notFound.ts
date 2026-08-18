import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

/**
 * Middleware to handle unmatched routes (404 Not Found) by passing an AppError to next().
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};
