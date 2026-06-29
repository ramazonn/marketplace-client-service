import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil, getBaseLanguage } from '../../utils';

@prefix('/emu/delivery-point')
export default class EmuDeliveryPointController {
  @request('get', '/list')
  @summary('Emu Delivery point list')
  @security([])
  @tags(['Address'])
  @query({ search: { type: 'string' } })
  static async controller(context: Context): Promise<void> {
    try {
      const lang = getBaseLanguage(context.lang)

      let response = []
      const cacheKey = `${process.env.NODE_ENV}:emu:locations:${lang}`;
      const redisClient = await Redis.getInstance();
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        response = JSON.parse(cachedData);
      } else {
        const found = await Repository.EmuDeliveryPoint().getDeliveryPoints();
        if (!found) {
          throw new NotFoundError('Emu Delivery Point');
        }

        let regions: Array<any> = found.getRegions() || [];
        response = regions.map(r => {
          return {
            name: r.name[`${lang}`],
            locations: r.locations.map(l => {
              return {
                id: l.id,
                code: l.code,
                clientCode: l.code,
                name: l.name[`${lang}`],
                phone: l.phone,
                latitude: l.latitude,
                longitude: l.longitude,
                address: l.address[`${lang}`],
                workTime: l.worktime[`${lang}`],
                maxWeight: l.maxweight,
                acceptCash: l.acceptcash,
                acceptindIviduals: l.acceptindividuals,
                acceptFitting: l.acceptfitting,
                acceptCard: l.acceptcard,


              }
            })
          }
        })

        const cacheResponseTTL = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(response), cacheResponseTTL);
      }

      return context.send.data(response);
    } catch (error) {
      console.error('Error in EmuDeliveryPointController:', error);
      return context.send.error(error);
    }
  }
}
