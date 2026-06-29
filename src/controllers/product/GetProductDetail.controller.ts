import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import { GetProductDetailUseCase } from '../../usecases';
import { EventTypeEnum, Redis, Repository, UserViewedProductsEntity } from '@ubaytools/core';
import { Types } from 'mongoose';
import { EventQueueService } from '../../services';
import { CacheTTLUtil } from '../../utils';

@prefix('/product')
export default class GetProductDetailController {
  @request('get', '/detail/{productId}')
  @summary('Product detail')
  @security([])
  @tags(['Product'])
  @path({ productId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;

    try {
      params = await new IdParams({ id: context.params.productId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const redisClient = await Redis.getInstance();
      const client = redisClient.getClient();
      const userId = context.client?.getId();
      const cacheKey = `${process.env.NODE_ENV}:product:detail:${params.id}:${context.lang}`;
      const productId = params.id.toString();

      let response: any;
      const cachedProduct = await redisClient.get(cacheKey);
      if (cachedProduct) {
        response = JSON.parse(cachedProduct);
      } else {
        response = await GetProductDetailUseCase.execute(params.id, context.lang, userId);
        const cacheResponseTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(response), cacheResponseTTL);
      }

      //TODO: implement redis and here: store viewed in redis and save them at once
      // await Repository.Products().incrementViews(new Types.ObjectId(params.id));
      // if (userId) {
      //   const userViewedProduct = new UserViewedProductsEntity();
      //   userViewedProduct.buildUser(userId);
      //   userViewedProduct.buildProduct(new Types.ObjectId(params.id));
      //   await Repository.UserViewedProducts().create(userViewedProduct);
      // }

      const viewCountKey = `${process.env.NODE_ENV}:product:${productId}:viewsCount`;

      if ((await client.ttl(viewCountKey)) === -1) {
        const cacheViewCountTTL =  CacheTTLUtil.withRandomTTL(60 * 60 * 12);
        await client.expire(viewCountKey, cacheViewCountTTL);
      }

      // TODO: add product like tracking to Redis and handle via async job
      // - store user's liked products
      // - avoid direct DB writes
      // - sync to DB later via background process
      if (userId) {
        const productId = params.id.toString();
        const viewedKey = `${process.env.NODE_ENV}:user:${userId}:viewedProducts`;

        const current = await redisClient.get(viewedKey);
        let arr: string[] = current ? JSON.parse(current) : [];

        arr.unshift(productId);
        arr = [...new Set(arr)];
        arr = arr.slice(0, 50);

        const cacheViewedProductsTTL =  CacheTTLUtil.withRandomTTL(60 * 60 * 24 * 10);
        await redisClient.set(viewedKey, JSON.stringify(arr), cacheViewedProductsTTL);
      }

      if (context.client) {
        void EventQueueService.getInstance().publishToQueue({
          userId: context.client.getId().toString(),
          eventType: EventTypeEnum.VIEW_PRODUCT,
          timestamp: new Date(),
          metadata: {
            product: new Types.ObjectId(params.id),
            category: new Types.ObjectId(response.categoryId),
          },
        });

        const productId = params.id?.toString();
        const categoryId = response?.categoryId?.toString();
        const brandId = response?.brand?._id?.toString();

        const viewKey = `${process.env.NODE_ENV}:view:${userId}:${productId}`;

        const exists = await redisClient.get(viewKey);

        if (!exists) {
          // throttling key yaratamiz
          const cacheViewedTTL =  CacheTTLUtil.withRandomTTL(60 * 60);
          await redisClient.set(viewKey, '1', cacheViewedTTL); // 1 soatgan saqlaymiz, shu vaqt ichida qayta view bo'lsa, interest score oshmaydi

          const pipeline = await redisClient.pipeline();

          if (productId) {
            pipeline.zIncrBy(`${process.env.NODE_ENV}:user:interest:products:${userId}`, 1, productId);
          }

          if (categoryId) {
            pipeline.zIncrBy(`${process.env.NODE_ENV}:user:interest:categories:${userId}`, 1, categoryId);
          }

          if (brandId) {
            pipeline.zIncrBy(`${process.env.NODE_ENV}:user:interest:brands:${userId}`, 1, brandId);
          }

          await pipeline.exec();
        }
      }

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
