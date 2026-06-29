import * as KoaRouter from '@koa/router';
import { CategoryControllers } from '../controllers';

export const CategoryRouter = new KoaRouter().prefix('/category');

CategoryRouter.get('/list', CategoryControllers.GetCategoryListController);
CategoryRouter.get('/recursive-list', CategoryControllers.GetAllCategoryRecursive);
CategoryRouter.get('/popular', CategoryControllers.GetPopularCategoryListController);
CategoryRouter.get('/detail/:categoryId', CategoryControllers.GetCategoryDetailController);
