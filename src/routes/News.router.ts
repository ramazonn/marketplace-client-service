import * as KoaRouter from '@koa/router';
import { NewsControllers } from '../controllers';
import { CheckOptionalSessionMiddleware } from '../middlewares';

export const NewsRouter = new KoaRouter().prefix('/news');

NewsRouter.get('/list', CheckOptionalSessionMiddleware(), NewsControllers.GetNewsListController);
NewsRouter.get('/detail/:newsId', CheckOptionalSessionMiddleware(), NewsControllers.GetNewsDetailController);
NewsRouter.put('/like/:newsId', CheckOptionalSessionMiddleware(), NewsControllers.LikeNewsController);
