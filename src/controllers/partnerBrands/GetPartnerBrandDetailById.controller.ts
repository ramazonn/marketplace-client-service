import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import { CloudFlareService, NotFoundError, PartnerBrandsEntity, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

class PartnerBrandDetailResponse {
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
export default class GetPartnerBrandDetailByIdController {
  @request('get', '/detail/{partnerBrandId}')
  @summary('Partner brand detail')
  @security([])
  @tags(['PartnerBrands'])
  @path({ partnerBrandId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.partnerBrandId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const foundPartnerBrand = await Repository.PartnerBrands().getById(new Types.ObjectId(params.id));
      if (!foundPartnerBrand) {
        throw new NotFoundError('PartnerBrand');
      }
      const response = new PartnerBrandDetailResponse(foundPartnerBrand);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}

