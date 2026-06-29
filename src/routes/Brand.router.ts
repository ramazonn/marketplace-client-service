import * as KoaRouter from '@koa/router';
import { BrandControllers } from '../controllers';

export const BrandRouter = new KoaRouter().prefix('/brand');

BrandRouter.get('/list', BrandControllers.GetBrandListController);
BrandRouter.get('/detail/:brandId', BrandControllers.GetBrandDetailByIdController);
