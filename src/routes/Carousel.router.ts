import * as KoaRouter from '@koa/router';
import { CarouselControllers } from '../controllers';
import { CheckOptionalSessionMiddleware } from '../middlewares';

export const CarouselRouter = new KoaRouter().prefix('/carousel');

CarouselRouter.get('/list', CheckOptionalSessionMiddleware(), CarouselControllers.GetCarouselListController);
CarouselRouter.get('/single/:carouselId', CheckOptionalSessionMiddleware(), CarouselControllers.GetSingleCarouselController);
