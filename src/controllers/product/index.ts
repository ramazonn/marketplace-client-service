import GetProductListController from './GetProductList.controller';
import GetProductDetailController from './GetProductDetail.controller';
import CompareProductsController from './CompareProducts.controller';
import GetViewedProductListController from './GetViewedProductList.controller';
import GetProductListUniversalFilterController from './GetProductListUniversalFilter.controller';
import GetHomeFeedController from './GetHomeFeed.controller';
import HomeFeedSetupController from './HomeFeedSetup.controller';
import SearchByImageController from './SearchByImageController';
import CreateProductIndexesController from './CreateIndexes.controller';

export const ProductControllers = {
  GetProductListController: GetProductListController.controller,
  GetProductDetailController: GetProductDetailController.controller,
  CompareProductsController: CompareProductsController.controller,
  GetViewedProductListController: GetViewedProductListController.controller,
  GetProductListUniversalFilterController: GetProductListUniversalFilterController.controller,
  GetHomeFeedController: GetHomeFeedController.controller,
  HomeFeedSetupController: HomeFeedSetupController.controller,
  SearchByImageController: SearchByImageController.controller,
  CreateProductIndexesController: CreateProductIndexesController.controller
};
