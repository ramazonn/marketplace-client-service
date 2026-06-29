import * as KoaRouter from '@koa/router';
import { StoreControllers } from '../controllers';
import { CheckOptionalSessionMiddleware } from '../middlewares';

export const StoreRouter = new KoaRouter().prefix('/store');

StoreRouter.get('/detail/:storeId', CheckOptionalSessionMiddleware(),StoreControllers.GetStoreDetailController);
