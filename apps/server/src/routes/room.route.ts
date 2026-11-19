import { Router } from 'express';
import { getRoomByCode } from '../controllers/room.controller.js';

export const roomRouter = Router();

roomRouter.get('/:code', getRoomByCode);
