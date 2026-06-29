import * as KoaRouter from '@koa/router';
import { PromotionControllers } from '../controllers';

export const PromotionRouter = new KoaRouter().prefix('/promotion');

PromotionRouter.get('/list', PromotionControllers.GetPromotionListController);
