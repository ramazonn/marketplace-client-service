import * as KoaRouter from '@koa/router';
import { PromoCodeControllers} from '../controllers';
import { CheckClientSessionMiddleware } from '../middlewares';

export const PromoCodeRouter = new KoaRouter().prefix('/promocode');

PromoCodeRouter.get('/list', CheckClientSessionMiddleware(), PromoCodeControllers.GetPromoCodeListController);
PromoCodeRouter.post('/check', CheckClientSessionMiddleware(), PromoCodeControllers.CheckPromoCodeController);
