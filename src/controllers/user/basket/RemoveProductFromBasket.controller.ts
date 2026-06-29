import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LikedProductParams, ListParams } from '../../../infrastructure';
import { NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/basket')
export default class RemoveProductFromBasketController {
  @request('put', '/remove-product')
  @summary('Remove product from basket')
  @security([])
  @tags(['Basket'])
  @body((LikedProductParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: LikedProductParams;
    try {
      params = await new LikedProductParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      if (params.productId) {
        await RemoveProductFromBasketController.removeProductFromBasket(context.client.getId(), new Types.ObjectId(params.productId));
      }

      if (params.productIds) {
        await Promise.all(
          params.productIds?.map(async (productId) => {
            await RemoveProductFromBasketController.removeProductFromBasket(context.client.getId(), new Types.ObjectId(productId));
          }),
        );
      }

      const count = await Repository.UserLikedProducts().countDocumentsByFilter({ user: context.client.getId(), inBasked: true });
      return context.send.data({ updated: true, total: count });
    } catch (error) {
      return context.send.error(error);
    }
  }

  static async removeProductFromBasket(userId: Types.ObjectId, productId: Types.ObjectId): Promise<void> {
    const found = await Repository.UserLikedProducts().getLikedProductByUser(userId, productId);
    if (!found) {
      console.error('User basked product');
      return;
    }
    found.buildInBasked(false).buildCountInBasked(0);
    await Repository.UserLikedProducts().update(found);
  }
}
