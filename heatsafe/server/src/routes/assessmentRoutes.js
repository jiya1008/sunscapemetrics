import { Router } from 'express';
import * as ctrl from '../controllers/assessmentController.js';

const router = Router();

router.get('/', ctrl.listAssessments);
router.get('/:id/recommendations', ctrl.getAssessmentRecommendations);
router.get('/:id', ctrl.getAssessment);
router.post('/', ctrl.createAssessment);
router.put('/:id', ctrl.updateAssessment);
router.delete('/:id', ctrl.deleteAssessment);

export default router;
