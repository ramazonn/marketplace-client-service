import * as KoaRouter from '@koa/router';
import { CheckOptionalSessionMiddleware } from '../middlewares';
import { SpecialEventControllers } from '../controllers/special-event';

export const SpecialEventRouter = new KoaRouter().prefix('/special-event');

SpecialEventRouter.get('/list', CheckOptionalSessionMiddleware(), SpecialEventControllers.GetSpecialEventListController);
SpecialEventRouter.get('/single/:specialEventId', CheckOptionalSessionMiddleware(), SpecialEventControllers.GetSingleSpecialEventController);
