import * as KoaRouter from '@koa/router';
import { CompareControllers, FaqControllers } from '../controllers';
import { CheckClientSessionMiddleware } from '../middlewares';

export const CompareRouter = new KoaRouter().prefix('/compare');

CompareRouter.post('/add', CheckClientSessionMiddleware(), CompareControllers.AddProductToCompareController);
CompareRouter.delete('/clear', CheckClientSessionMiddleware(), CompareControllers.ClearProductFromCompareController);
CompareRouter.delete('/remove-product', CheckClientSessionMiddleware(), CompareControllers.RemoveProductFromCompareController);
CompareRouter.get('/filters', CheckClientSessionMiddleware(), CompareControllers.GetCompareFiltersController);
CompareRouter.get('/result', CheckClientSessionMiddleware(), CompareControllers.GetCompareDetailController);
CompareRouter.get('/products', CheckClientSessionMiddleware(), CompareControllers.GetAllCompareProductsController);
