import { Router } from 'express';
import * as ctrl from '../controllers/actionPlanController.js';

const router = Router();

router.get('/', ctrl.listActionPlans);
router.get('/:id', ctrl.getActionPlan);
router.post('/', ctrl.createActionPlan);
router.put('/:id', ctrl.updateActionPlan);
router.delete('/:id', ctrl.deleteActionPlan);
router.post('/:id/suggest-budget', ctrl.suggestBudget);

export default router;
