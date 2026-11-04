import { Router } from 'express';
import { getHierarchy, getPlants, getShopsByPlant } from './org.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/hierarchy', getHierarchy);
router.get('/plants', getPlants);
router.get('/plants/:plantId/shops', getShopsByPlant);

export default router;

