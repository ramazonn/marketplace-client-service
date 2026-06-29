import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { EventLevelProductLimitExceededError, EventOrderLimitExceededError, LikedProductParams } from '../../../infrastructure';
import { EventTypeEnum, NotFoundError, Redis, Repository, UserLikedProductModel } from '@ubaytools/core';
import { Types } from 'mongoose';
import { CheckSpecialEventRestriction } from '../../../usecases/special-event/CheckSpecialEventRestriction';
import { EventQueueService } from '../../../services';

@prefix('/user/basket')
export default class PutProductToBasketController {
  @request('put', '/add-product')
  @summary('Add product to basket')
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
      const redis = await Redis.getInstance();

      const categoryKey = `${process.env.NODE_ENV}:user:interest:categories:${context.client.getId().toString()}`;
      const productKey = `${process.env.NODE_ENV}:user:interest:products:${context.client.getId().toString()}`;
      const brandKey = `${process.env.NODE_ENV}:user:interest:brands:${context.client.getId().toString()}`;

      if (params.productId) {
        // Juma aksiyasi uchun tekshirish
        const checkFridayPromotion = await CheckSpecialEventRestriction.checkFridayPromotion();

        const productObjectId = new Types.ObjectId(params.productId);
        const fridayPromotionLimit = checkFridayPromotion.specialEvent?.eventProductLimit ?? 0;
        const fridayPromotionDurationLimit = checkFridayPromotion.specialEvent?.eventLimitDuration ?? 0;
        const specialEventId = checkFridayPromotion.specialEvent?.id;

        let isFridayPromotionProduct = false;
        let fridayPromotionDiscountPrice: number | null = null;

        if (checkFridayPromotion.isFridayPromotion && specialEventId) {
          const promoInfo = await CheckSpecialEventRestriction.isFridayPromotionProduct(productObjectId, new Types.ObjectId(specialEventId));

          isFridayPromotionProduct = promoInfo.isFridayPromotionProduct;
          fridayPromotionDiscountPrice = promoInfo.discountPrice;
        }

        if (isFridayPromotionProduct && fridayPromotionLimit !== 0) {
          const specialEventIdObj = new Types.ObjectId(specialEventId);
          const [hasFridayPromotionOrderLimitReached, hasFridayPromotionBasketLimitReached] = await Promise.all([
            CheckSpecialEventRestriction.checkFridayPromotionOrderLimitReached(
              context.client.getId(),
              fridayPromotionLimit,
              fridayPromotionDurationLimit,
              specialEventIdObj,
            ),
            CheckSpecialEventRestriction.checkFridayPromotionBasketLimitReached(context.client.getId(), specialEventIdObj, fridayPromotionLimit),
          ]);

          // Preserve previous precedence: order-limit error first.
          if (hasFridayPromotionOrderLimitReached) throw new EventOrderLimitExceededError();
          if (hasFridayPromotionBasketLimitReached) throw new EventLevelProductLimitExceededError();
        }

        const foundProduct = await Repository.Products().getById(productObjectId);

        if (!foundProduct) {
          throw new NotFoundError('Product');
        }

        const specialEventIdToSet =
          checkFridayPromotion.isFridayPromotion && isFridayPromotionProduct && checkFridayPromotion.specialEvent
            ? new Types.ObjectId(checkFridayPromotion.specialEvent.id)
            : undefined;

        const updatePayload: any = {
          inBasked: true,
          countInBasked: 1,
        };

        // Keep old behavior: only set specialEvent when promo applies.
        if (specialEventIdToSet) {
          updatePayload.specialEvent = specialEventIdToSet;
        }

        const rawResult = await (UserLikedProductModel as any).findOneAndUpdate(
          { user: context.client.getId(), product: productObjectId },
          { $set: updatePayload },
          {
            upsert: true,
            new: true,
            rawResult: true,
          },
        );

        const updatedDoc = rawResult?.value ?? null;
        // Preserve previous controller behavior: returns `created: true` for both insert and update.
        const created = true;
        const id = updatedDoc?._id?.toString?.() ?? null;

        const count = await Repository.UserLikedProducts().countDocumentsByFilter({
          user: context.client.getId(),
          inBasked: true,
        });

        const discountPrice = foundProduct?.convertToSchema().infos?.discount_price ?? 0;
        const currentPrice = foundProduct?.convertToSchema().infos?.current_price ?? 0;

        const finalPrice =
          isFridayPromotionProduct && fridayPromotionDiscountPrice !== null
            ? fridayPromotionDiscountPrice
            : discountPrice > 0
            ? discountPrice
            : currentPrice;

        void EventQueueService.getInstance().publishToQueue({
          userId: context.client.getId().toString(),
          eventType: EventTypeEnum.ADD_TO_CART,
          timestamp: new Date(),
          metadata: {
            product: productObjectId.toString(),
            quantity: 1,
            price: finalPrice,
          },
        });

        const pipeline = await redis.pipeline();

        const productId = productObjectId.toString();
        const categoryId = foundProduct.convertToSchema().category?._id?.toString();
        const brandId = foundProduct.convertToSchema().infos?.brand?._id?.toString();

        pipeline.zIncrBy(productKey, 2, productId);

        if (categoryId && Types.ObjectId.isValid(categoryId)) {
          pipeline.zIncrBy(categoryKey, 2, categoryId);
        }

        if (brandId && Types.ObjectId.isValid(brandId)) {
          pipeline.zIncrBy(brandKey, 2, brandId);
        }

        await pipeline.exec();

        return context.send.data({ created: Boolean(created), id, total: count });
      } else {
        return context.send.data({ created: false, id: null, total: 0 });
      }
    } catch (error) {
      return context.send.error(error);
    }
  }
}
