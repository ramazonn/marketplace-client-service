import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil, getBaseLanguage } from '../../utils';

@prefix('/ubay-point')
export default class UbayPointController {
  @request('get', '/list')
  @summary('Ubay point list')
  @security([])
  @tags(['Address'])
  static async controller(context: Context): Promise<void> {
    try {
      const lang = getBaseLanguage(context.lang)
      
      let response = []
      const cacheKey = `${process.env.NODE_ENV}:ubay:locations:${lang}`;
      const redisClient = await Redis.getInstance();
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        response = JSON.parse(cachedData);
      } else {
        const found = await Repository.UbayPoint().getUbayPoints();
        if (!found) {
          throw new NotFoundError('Ubay Point');
        }
        let regions = found.getRegions() || []
        response = regions.map((r: { name: string, locations: any[] }) => {
          return { name: r.name, locations: r?.locations.filter((l: { id: number }) => l.id !== 4) || [] }
        });
        const cacheResponseTTL = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(response), cacheResponseTTL);
      }

      return context.send.data(response);
    } catch (error) {
      console.error('Error in UbayPointController:', error);
      return context.send.error(error);
    }
  }
}
