import { Context } from 'koa';
import { OrderStatusEnum, ProductStatusEnum, Redis, Repository, UserStatusEnum } from '@ubaytools/core';
import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { CacheTTLUtil } from '../../utils';

type MainStatsResult = {
  ordersCount: number;
  productsCount: number;
  totalSoldItems: number;
};

@prefix('/stats')
export default class GetMainStatsController {
  @request('get', '/main')
  @summary('Statistics')
  @security([])
  @tags(['Statistics'])
  static async controller(context: Context): Promise<void> {
    const redis = await Redis.getInstance();
    const cacheKey = `${process.env.NODE_ENV}:stats:overview`;

    try {
      let result: MainStatsResult;

      const cacheData = await redis.get(cacheKey);

      if (cacheData) {
        result = JSON.parse(cacheData) as MainStatsResult;
      } else {
        const totalSoldItems = await Repository.Orders().getTotalSoldItems();

        const ordersCount = await Repository.Orders()
          .countDocumentsByFilter({ status: OrderStatusEnum.DELIVERED });

        const productsCount = await Repository.Products()
          .countDocumentsByFilter({ status: { $ne: ProductStatusEnum.DELETED } });

        result = {
          ordersCount,
          productsCount,
          totalSoldItems,
        };

        const cacheTTL =  CacheTTLUtil.withRandomTTL(23 * 60 * 60);
        await redis.set(cacheKey, JSON.stringify(result), cacheTTL);
      }

      return context.send.data(result);
    } catch (error) {
      return context.send.error(error);
    }
  }

}
