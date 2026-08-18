"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const notFound_1 = require("./middleware/notFound");
const error_1 = require("./middleware/error");
const app = (0, express_1.default)();
// Standard middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use(routes_1.default);
// Centralized 404 handling
app.use(notFound_1.notFoundHandler);
// Centralized error middleware
app.use(error_1.errorHandler);
exports.default = app;
