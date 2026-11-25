import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/weatherController.js';

const router = Router();

const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many weather requests. Please wait.' },
});

router.use(weatherLimiter);
router.get('/current', ctrl.getCurrent);
router.get('/forecast', ctrl.getForecast);

export default router;
