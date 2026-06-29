import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { UserReviewListParams } from '../../infrastructure';
import { ProductEntity, ProductsAwaitingUserReviewsStatusEnum, Repository } from '@ubaytools/core';
import { Promise } from 'mongoose';
import { GetProductsAwaitingUserReviewsItemResponse } from './GetProductAwaitingUserReview.controller';

@prefix('/review')
export default class GetProductsAwaitingUserReviewsListController {
  @request('get', '/pending/list')
  @summary('User reviews')
  @security([])
  @tags(['Review'])
  @query((UserReviewListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: UserReviewListParams;
    try {
      params = await new UserReviewListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const filter = {};
      filter['user'] = context?.client?.getId()?.toHexString();
      filter['status'] = { $ne: ProductsAwaitingUserReviewsStatusEnum.SUBMITTED };
      const count = await Repository.ProductsAwaitingUserReviews().countDocumentsByFilter(filter);
      const items = await Repository.ProductsAwaitingUserReviews().list({ page: params.page, size: params.size }, filter, { createdAt: -1 });
      const response = await Promise.all(
        items.map(async (item) => {
          return new GetProductsAwaitingUserReviewsItemResponse(item, context.lang);
        }),
      );
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
