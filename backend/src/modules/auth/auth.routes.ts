import { Router } from 'express';
import { login, getProfile } from './auth.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.get('/profile', authenticateJWT, getProfile);

export default router;
