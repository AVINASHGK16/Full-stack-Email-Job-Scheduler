"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const error_1 = require("./error");
/**
 * Middleware to handle unmatched routes (404 Not Found) by passing an AppError to next().
 */
const notFoundHandler = (req, _res, next) => {
    next(new error_1.AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};
exports.notFoundHandler = notFoundHandler;
