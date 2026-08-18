"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = void 0;
/**
 * Controller to handle the health check endpoint.
 */
const getHealth = (_req, res, _next) => {
    res.status(200).json({ status: 'ok' });
};
exports.getHealth = getHealth;
