import AddProductToCompareController from './AddProductToCompare.controller';
import ClearCompareProductsController from './ClearCompareProducts.controller';
import GetCompareFiltersController from './GetCompareFilters.controller';
import GetCompareDetailsController from './GetCompareDetails.controller';
import RemoveProductFromCompareController from './RemoveProductFromCompare.controller';
import GetAllCompareProductsController from './GetAllCompareProducts.controller';

export const CompareControllers = {
  AddProductToCompareController: AddProductToCompareController.controller,
  ClearProductFromCompareController: ClearCompareProductsController.controller,
  GetCompareFiltersController: GetCompareFiltersController.controller,
  GetCompareDetailController: GetCompareDetailsController.controller,
  RemoveProductFromCompareController: RemoveProductFromCompareController.controller,
  GetAllCompareProductsController: GetAllCompareProductsController.controller,
};
