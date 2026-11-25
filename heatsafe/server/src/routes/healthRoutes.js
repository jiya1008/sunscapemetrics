import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbLabels = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    service: 'HeatSafe API',
    project: 'SunScape Metrics',
    timestamp: new Date().toISOString(),
    database: dbLabels[dbState] || 'unknown',
  });
});

export default router;
