"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const env_1 = require("../config/env");
/**
 * Custom application error class to handle operational errors.
 */
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Maintain proper stack trace (only available on V8 engines like Node)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.AppError = AppError;
/**
 * Centralized Express error-handling middleware.
 */
const errorHandler = (err, _req, res, _next) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const isOperational = err instanceof AppError ? err.isOperational : false;
    // Log non-operational errors or all errors in development
    if (!isOperational || env_1.env.NODE_ENV === 'development') {
        console.error('💥 Error caught in middleware:', err);
    }
    const responseBody = {
        status: 'error',
        message: isOperational || env_1.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        ...(env_1.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
    res.status(statusCode).json(responseBody);
};
exports.errorHandler = errorHandler;
