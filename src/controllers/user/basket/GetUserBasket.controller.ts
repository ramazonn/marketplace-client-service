import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { BasketListParams } from '../../../infrastructure';
import { ProductEntity, Repository } from '@ubaytools/core';
import { GetProductDetailUseCase } from '../../../usecases';
import { Types } from 'mongoose';

@prefix('/user/basket')
export default class GetUserBasketController {
  @request('get', '/list')
  @summary('User Basket List')
  @security([])
  @tags(['Basket'])
  @query((BasketListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: BasketListParams;

    try {
      params = await new BasketListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const filter: any = {
        inBasked: true,
        user: context.client.getId(),
      };

      if (params.basketIds?.length > 0) {
        filter._id = { $in: params.basketIds.map((id) => new Types.ObjectId(id)) };
      }

      const count = await Repository.UserLikedProducts().countDocumentsByFilter(filter);
      const items = await Repository.UserLikedProducts().list(
        { page: params.page, size: params.size },
        filter,
      );
      // TODO: implement cache logic here
      const response = await Promise.all(
        items.map(async (item) => {
          try {
            const productId = (item.getProduct() as ProductEntity)?.getId()?.toString();
            if (!productId) return null;

            const product = await GetProductDetailUseCase.execute(
              productId,
              context.lang,
              context?.client?.getId() ?? null,
            );

            return {
              id: item.getId().toString(),
              productId: product.id,
              // inBasketCount
              productCountInBasked: item.getCountInBasked(),
              count:product.count,
              name: product.name ?? null,
              store: product?.store ? {id:product.store?.id,name:product.store?.name} : null,
              brand: product?.brand ? {id:product.brand?.id,name:product.brand?.name }: null,
              currentPrice: product.currentPrice ?? null,
              // need to update pascal case
              discount_percent: product.discount_percent ?? null,
              discount_price: product.discount_price ?? null,
              cashbackPercent: product.cashbackPercent ?? null,
              images: product.images ?? null,
              isFavorite: product.isFavorite ?? false,
              isPreOrder: product.isPreOrder ?? false,
              preOrderShippingInfo: product.preOrderShippingInfo
            };
          } catch (error) {
            console.error('Error while fetching product', error);
            return null;
          }
        }),
      );

      return context.send.data({
        total: count,
        items: response.filter(Boolean),
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}