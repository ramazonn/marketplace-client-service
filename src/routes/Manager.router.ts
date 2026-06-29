import * as KoaRouter from '@koa/router';
import { BrandControllers, ManagerControllers } from '../controllers';

export const ManagerRouter = new KoaRouter().prefix('/manager');

ManagerRouter.get('/list', ManagerControllers.GetManagerListController);
