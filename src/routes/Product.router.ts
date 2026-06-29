import * as KoaRouter from '@koa/router';
import { ProductControllers } from '../controllers';
import { CheckClientSessionMiddleware, CheckOptionalSessionMiddleware, ImageUploadMiddleware } from '../middlewares';
import * as multer from '@koa/multer';

const upload = multer();

export const ProductRouter = new KoaRouter().prefix('/product');

ProductRouter.post('/list', CheckOptionalSessionMiddleware(), ProductControllers.GetProductListController);
ProductRouter.post('/universal/filter', CheckOptionalSessionMiddleware(), ProductControllers.GetProductListUniversalFilterController);
ProductRouter.get('/home/feed', CheckOptionalSessionMiddleware(), ProductControllers.GetHomeFeedController);
ProductRouter.post('/home-feed-setup', CheckOptionalSessionMiddleware(), ProductControllers.HomeFeedSetupController);
ProductRouter.get('/detail/:productId', CheckOptionalSessionMiddleware(), ProductControllers.GetProductDetailController);
ProductRouter.post('/compare', CheckOptionalSessionMiddleware(), ProductControllers.CompareProductsController);
ProductRouter.post('/search-by-image', ImageUploadMiddleware(), CheckOptionalSessionMiddleware(), ProductControllers.SearchByImageController);
ProductRouter.get('/viewed', CheckClientSessionMiddleware(), ProductControllers.GetViewedProductListController);
ProductRouter.post('/create-index', ProductControllers.CreateProductIndexesController);
