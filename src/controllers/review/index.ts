import GetReviewListByProductController from './GetReviewListByProduct.controller';
import GetProductAwaitingUserReviewController from './GetProductAwaitingUserReview.controller';
import GetProductsAwaitingUserReviewsListController from './GetProductsAwaitingUserReviews.controller';
import GetUserReviewsController from './GetUserReviews.controller';
import WriteReviewToProductController from './WriteReviewToProduct.controller';

export const ReviewControllers = {
  GetReviewListByProductController: GetReviewListByProductController.controller,
  GetUserReviewListController: GetUserReviewsController.controller,
  WriteAnswerToReviewController: WriteReviewToProductController.controller,
  GetProductsAwaitingUserReviewsListController: GetProductsAwaitingUserReviewsListController.controller,
  GetProductAwaitingUserReviewController: GetProductAwaitingUserReviewController.controller,
};
