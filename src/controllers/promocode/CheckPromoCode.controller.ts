import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CheckPromoCodeParams } from '../../infrastructure';
import { NotFoundError, PromoCodeOwnerTypeEnum, PromoCodeUsageModel, Repository, RequirementError } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/promocode')
export default class CheckPromoCodeController {
  @request('post', '/check')
  @summary('Check promocode')
  @security([])
  @tags(['Promocode'])
  @body((CheckPromoCodeParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: CheckPromoCodeParams;

    try {
      params = await new CheckPromoCodeParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const response = await Repository.PromoCodes().checkPromoCode(params.code, context.client.getId());

      if (!response.promocode) {
        throw new NotFoundError('Promocode not found');
      }

      if (response.promocode.ownerType === PromoCodeOwnerTypeEnum.STORE) {
        if (!params.products?.length) {
          throw new RequirementError('products');
        }

        const basketIds = params.products.map((item) => new Types.ObjectId(item.basketId));

        const basketProducts = await Repository.UserLikedProducts().list(
          {},
          {
            _id: {
              $in: basketIds,
            },
            inBasked: true,
          },
        );

        const hasStoreProduct = basketProducts.some((basketItem) => {
          const product = basketItem.getProduct() as any;
          return product?.getStore()?.toString() === response.promocode?.store?.toString();
        });

        if (!hasStoreProduct) {
          throw new NotFoundError('promoCode');
        }
      }

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
