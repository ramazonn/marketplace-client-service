import * as KoaRouter from '@koa/router';
import { FaqControllers, ReviewControllers } from '../controllers';
import { CheckClientSessionMiddleware } from '../middlewares';

export const ReviewRouter = new KoaRouter().prefix('/review');

ReviewRouter.get('/by-user', CheckClientSessionMiddleware(), CheckClientSessionMiddleware(), ReviewControllers.GetUserReviewListController);
ReviewRouter.get('/pending/list', CheckClientSessionMiddleware(), CheckClientSessionMiddleware(), ReviewControllers.GetProductsAwaitingUserReviewsListController);
ReviewRouter.get('/pending', CheckClientSessionMiddleware(), CheckClientSessionMiddleware(), ReviewControllers.GetProductAwaitingUserReviewController);
ReviewRouter.get('/by-product', ReviewControllers.GetReviewListByProductController);
ReviewRouter.post('/write', CheckClientSessionMiddleware(), ReviewControllers.WriteAnswerToReviewController);
