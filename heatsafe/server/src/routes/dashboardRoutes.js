import { Router } from 'express';
import * as ctrl from '../controllers/dashboardController.js';

const router = Router();

router.get('/summary', ctrl.getSummary);
router.get('/risk-distribution', ctrl.getRiskDistribution);
router.get('/recent-activity', ctrl.getRecentActivity);

export default router;
