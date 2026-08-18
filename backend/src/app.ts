import express, { Express } from 'express';
import cors from 'cors';
import router from './routes';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/error';

const app: Express = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use(router);

// Centralized 404 handling
app.use(notFoundHandler);

// Centralized error middleware
app.use(errorHandler);

export default app;
