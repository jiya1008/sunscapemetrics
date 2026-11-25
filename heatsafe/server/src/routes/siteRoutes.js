import { Router } from 'express';
import * as ctrl from '../controllers/siteController.js';

const router = Router();

router.get('/meta/types', ctrl.getSiteTypes);
router.get('/', ctrl.listSites);
router.get('/:id', ctrl.getSite);
router.post('/', ctrl.createSite);
router.put('/:id', ctrl.updateSite);
router.delete('/:id', ctrl.deleteSite);

export default router;
