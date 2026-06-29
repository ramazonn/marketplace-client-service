import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import {
  BrandsEntity,
  CloudFlareService,
  LanguageEnum,
  ProductEntity,
  ProductsAwaitingUserReviewsEntity,
  ProductsAwaitingUserReviewsModel,
  ProductsAwaitingUserReviewsStatusEnum,
  Redis,
  Repository,
} from '@ubaytools/core';
import { Promise } from 'mongoose';
import { CacheTTLUtil } from '../../utils';

export class GetProductsAwaitingUserReviewsItemResponse {
  id: string;
  order: string;
  product: any;
  constructor(review: ProductsAwaitingUserReviewsEntity, lang: LanguageEnum) {
    const product = review.getProduct() as ProductEntity;
    this.id = review.getId().toString();
    this.order = review.getOrder()?.toString() ?? null;
    this.product = {
      id: product.getId(),
      name: product.getName().getByLang(lang) ?? '',
      brand: (product.getProductInfo()?.getBrand() as BrandsEntity)?.getTitle()?.getByLang(lang) ?? '',
      attachments: product.getAttachments()?.map((item) => CloudFlareService.getImageUrlByFileID(item)) ?? [],
    };
  }
}

@prefix('/review')
export default class GetProductAwaitingUserReviewController {
  @request('get', '/pending')
  @summary('User reviews')
  @security([])
  @tags(['Review'])
  static async controller(context: Context): Promise<void> {
    try {
      const redisClient = await Redis.getInstance();
      const userId = context?.client?.getId()?.toHexString();
      const cacheKey = `${process.env.NODE_ENV}:review:pending:user:${userId}`;

      let response: any = {};

      const cachedRaw = await redisClient.get(cacheKey);

      if (!cachedRaw) {
        const items = await Repository.ProductsAwaitingUserReviews().list(
          { page: 1, size: 1 },
          {
            user: userId,
            status: ProductsAwaitingUserReviewsStatusEnum.PENDING,
          },
          { createdAt: -1 },
        );

        const item = items[0];

        if (item) {
          const res = new GetProductsAwaitingUserReviewsItemResponse(item, context.lang);

          const cacheTTL =  CacheTTLUtil.withRandomTTL(22 * 60 * 60*2);
          await redisClient.set(
            cacheKey,
            JSON.stringify({
              count: 1,
              data: res,
            }),
            cacheTTL,
          );
          response = res;
        }
      } else {
        let cache: { count: number; data: any } = JSON.parse(cachedRaw);

        cache.count += 1;
        response = cache.data;

        if (cache.count >= 5) {
          await ProductsAwaitingUserReviewsModel.updateOne(
            { _id: cache.data?.id, status: ProductsAwaitingUserReviewsStatusEnum.PENDING },
            { $set: { status: ProductsAwaitingUserReviewsStatusEnum.DECLINED } },
          );
          await redisClient.delete(cacheKey)
        } else {
          await redisClient.set(cacheKey, JSON.stringify(cache), 60 * 60 * 24 * 2);

        }
      }

      return context.send.data({ item: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
