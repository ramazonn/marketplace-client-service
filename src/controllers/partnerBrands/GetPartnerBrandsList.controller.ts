import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { CloudFlareService, PartnerBrandsEntity, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil } from '../../utils';

class PartnerBrandListItemResponse {
  id: string;
  name: string;
  logo: string;
  constructor(partnerBrand: PartnerBrandsEntity) {
    this.id = partnerBrand.getId().toString();
    this.name = partnerBrand.getName() ?? null;
    this.logo = partnerBrand.getLogo() ? CloudFlareService.getImageUrlByFileID(partnerBrand.getLogo()) : null;
  }
}

@prefix('/partner-brands')
export default class GetPartnerBrandsListController {
  @request('get', '/list')
  @summary('Partner brands list')
  @security([])
  @tags(['PartnerBrands'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const redis = await Redis.getInstance();

      const cacheKey =
        `${process.env.NODE_ENV}:partner-brands:list:${params.page}:${params.size}`;

      let response: {
        total: number;
        items: PartnerBrandListItemResponse[];
      };

      const cacheData = await redis.get(cacheKey);

      if (cacheData) {
        response = JSON.parse(cacheData);
      } else {
        const count = await Repository.PartnerBrands().countDocumentsByFilter({});
        const partnerBrands = await Repository.PartnerBrands().list({ page: params.page, size: params.size });
        const items = partnerBrands.map(
          (partnerBrand) =>
            new PartnerBrandListItemResponse(partnerBrand),
        );
        response = {
          total: count,
          items,
        };
        const cacheTTL =  CacheTTLUtil.withRandomTTL(3600);
        await redis.set(cacheKey, JSON.stringify(response), cacheTTL);
      }
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}

