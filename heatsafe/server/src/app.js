import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import healthRoutes from './routes/healthRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import interventionRoutes from './routes/interventionRoutes.js';
import actionPlanRoutes from './routes/actionPlanRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/action-plans', actionPlanRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
