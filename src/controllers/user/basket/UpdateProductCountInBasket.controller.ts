import { body, path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams, ProductLevelProductLimitExceededError } from '../../../infrastructure';
import { BaseError, EventTypeEnum, NotFoundError, ProductEntity, Redis, Repository, SpecialEventEntity, SpecialEventStatusEnum } from '@ubaytools/core';
import { Types } from 'mongoose';
import { CheckSpecialEventRestriction } from '../../../usecases/special-event/CheckSpecialEventRestriction';
import { EventQueueService } from '../../../services';

@prefix('/user/basket')
export default class UpdateProductCountInBasketController {
  @request('put', '/count/{baskedProductId}')
  @summary('Update productCount in basket')
  @security([])
  @tags(['Basket'])
  @body({ productCount: { type: 'number', required: true } })
  @path({ baskedProductId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.baskedProductId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {

      const redis = await Redis.getInstance();


      const found = await Repository.UserLikedProducts().getById(new Types.ObjectId(params.id));
      if (!found) {
        throw new NotFoundError('User basked product');
      }

      const productCount = context.request.body['productCount'];

      const foundProduct = found.getProduct() as ProductEntity;

 const productId = (found.getProduct() as ProductEntity).getId();
      const specialEvent = found.getSpecialEvent() as SpecialEventEntity;
      const specialEventId = specialEvent?.getId?.();

      const specialEventProduct = specialEventId
        ? await Repository.SpecialEventProducts().findByProductAndSpecialEvent(productId, specialEventId)
        : null;

      const productSchema = foundProduct.convertToSchema?.();

      const currentPrice = Number(productSchema?.infos?.current_price ?? 0);
      const discountPrice = Number(productSchema?.infos?.discount_price ?? 0);

      let sellingPrice = discountPrice > 0 ? discountPrice : currentPrice;

      const specialEventIsActive = specialEvent?.getStatus?.() === SpecialEventStatusEnum.ACTIVE;

      const specialEventProductIsActive = (specialEventProduct as any)?.getIsActive?.() ?? (specialEventProduct as any)?._isActive ?? false;

      const specialEventProductSchema = specialEventProduct?.convertToSchema?.();

      if (specialEventIsActive && specialEventProductIsActive && specialEventProductSchema) {
        if (typeof specialEventProductSchema.discountPrice === 'number') {
          sellingPrice = specialEventProductSchema.discountPrice;
        } else if (typeof specialEventProductSchema.discountPercent === 'number') {
          sellingPrice = currentPrice - (currentPrice * specialEventProductSchema.discountPercent) / 100;
        }
      }

      const limitForSale = specialEventProduct?.getLimitForSale()
      const soldCount = specialEventProduct?.getSoldCount()

      if (specialEvent && specialEvent.getStatus() === SpecialEventStatusEnum.ACTIVE && soldCount + productCount > limitForSale) {
        throw new ProductLevelProductLimitExceededError();
      }
    
      const hasProductLevelRestriction = await CheckSpecialEventRestriction.productLevelRestriction(productId, context.lang, context?.client?.getId() ?? null,productCount);
      if (hasProductLevelRestriction) {        
        throw new ProductLevelProductLimitExceededError();
      }
      found.buildCountInBasked(productCount);
      found.getCountInBasked()
      await Repository.UserLikedProducts().update(found);

      void EventQueueService.getInstance().publishToQueue({
        userId: context.client.getId().toString(),
        eventType: EventTypeEnum.ADD_TO_CART,
        timestamp: new Date(),
        metadata: {
          product: productId.toString(),
          price: sellingPrice ?? undefined,
          quantity: productCount,
        },
      });

      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
