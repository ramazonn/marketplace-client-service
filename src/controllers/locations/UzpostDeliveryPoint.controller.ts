import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil, getBaseLanguage } from '../../utils';

@prefix('/uzpost/delivery-point')
export default class UzpostDeliveryPointController {
  @request('get', '/list')
  @summary('Delivery point list')
  @security([])
  @tags(['Address'])
  @query({ search: { type: 'string' } })
  static async controller(context: Context): Promise<void> {
    try {
      const lang = getBaseLanguage(context.lang)
      const search = (context.query.search as string) || '';

      let response = []
      const cacheKey = `${process.env.NODE_ENV}:uzpost:locations:${lang}`;
      const redisClient = await Redis.getInstance();
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        response = JSON.parse(cachedData);
      } else {
        const found = await Repository.UzpostDeliveryPoint().getDeliveryPoints();
        if (!found) {
          throw new NotFoundError('Uzpost Delivery Point');
        }


        let regions: Array<any> = found.getRegions() || [];
        if (!found) {
          throw new NotFoundError('Uzpost Delivery Point');
        }

        if (search) {
          regions = regions
            .map((region) => ({
              ...region,
              locations: region.locations.filter(
                (location) =>
                  location.name.toLowerCase().includes(search.toLowerCase()) ||
                  location.district.toLowerCase().includes(search.toLowerCase()) ||
                  location.address.toLowerCase().includes(search.toLowerCase()),
              ),
            }))
            .filter((region) => region.locations.length > 0);
        }

        response = regions
        const cacheResponseTTL = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(response), cacheResponseTTL);
      }

      return context.send.data(response);
    } catch (error) {
      console.error('Error in UzpostDeliveryPointController:', error);
      return context.send.error(error);
    }
  }
}
