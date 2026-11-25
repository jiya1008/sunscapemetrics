import { Router } from 'express';
import * as ctrl from '../controllers/interventionController.js';

const router = Router();

router.get('/', ctrl.listInterventions);
router.get('/:id', ctrl.getIntervention);
router.post('/', ctrl.createIntervention);
router.put('/:id', ctrl.updateIntervention);
router.delete('/:id', ctrl.deleteIntervention);

export default router;
