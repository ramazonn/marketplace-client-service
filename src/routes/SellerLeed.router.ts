import * as KoaRouter from '@koa/router';
import { SellerLeedControllers } from '../controllers';

export const SellerLeedRouter = new KoaRouter().prefix('/seller-leeds');

SellerLeedRouter.post('/add', SellerLeedControllers.AddSellerLeedController);
