import GetCategoryListController from './GetCategoryList.controller';
import GetPopularCategoriesController from './GetPopularCategories.controller';
import GetAllCategoryRecursiveController from './GetAllCategoryRecursive.controller';
import GetCategoryDetailController from './GetCategoryDetail.controller';

export const CategoryControllers = {
  GetCategoryListController: GetCategoryListController.controller,
  GetPopularCategoryListController: GetPopularCategoriesController.controller,
  GetAllCategoryRecursive: GetAllCategoryRecursiveController.controller,
  GetCategoryDetailController: GetCategoryDetailController.controller,
};
