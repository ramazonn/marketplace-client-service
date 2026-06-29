import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';

import { NotFoundError, Redis, Repository, UzbLocationEntity } from '@ubaytools/core';
import { CacheTTLUtil, getBaseLanguage } from '../../utils';

@prefix('/uzb-locations')
export default class UzbLocationsController {
  @request('get', '/list')
  @summary('Uzb Locations list')
  @security([])
  @tags(['Address'])
  static async controller(context: Context): Promise<void> {
    try {
      const lang = getBaseLanguage(context.lang)
      let response = []

      const cacheKey = `${process.env.NODE_ENV}:uzb-locations:list:${lang}`;
      const redisClient = await Redis.getInstance();
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        response = JSON.parse(cachedData);
      } else {
        const regions = await Repository.UzbLocation().getUzbLocations();
        if (!response) {
          throw new NotFoundError('Uzb locations');
        }
        response = regions.getRegions();

        const cacheResponseTTL = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(response), cacheResponseTTL);
      }

      return context.send.data(response);
    } catch (error) {
      console.error('Error in UzbLocations:', error);
      return context.send.error(error);
    }
  }
}
