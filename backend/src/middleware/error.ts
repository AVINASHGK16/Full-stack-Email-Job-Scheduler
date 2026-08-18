import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Custom application error class to handle operational errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Maintain proper stack trace (only available on V8 engines like Node)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Centralized Express error-handling middleware.
 */
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  // Log non-operational errors or all errors in development
  if (!isOperational || env.NODE_ENV === 'development') {
    console.error('💥 Error caught in middleware:', err);
  }

  const responseBody = {
    status: 'error',
    message: isOperational || env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(responseBody);
};
