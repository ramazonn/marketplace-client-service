import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams, ListParams } from '../../infrastructure';
import { BrandsEntity, CloudFlareService, LanguageEnum, NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

class BrandDetailResponse {
  id: string;
  title: string;
  description: string;
  avatar: string;
  constructor(brand: BrandsEntity, lang: LanguageEnum) {
    this.id = brand.getId().toString();
    this.title = brand.getTitle()?.getByLang(lang) ?? null;
    this.description = brand.getDesc()?.getByLang(lang) ?? null;
    this.avatar = brand.getAvatar() ? CloudFlareService.getImageUrlByFileID(brand.getAvatar()) : null;
  }
}

@prefix('/brand')
export default class GetBrandDetailByIdController {
  @request('get', '/detail/{brandId}')
  @summary('Brand detail')
  @security([])
  @tags(['Brand'])
  @path({ brandId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.brandId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const foundBrand = await Repository.Brands().getById(new Types.ObjectId(params.id));
      if (!foundBrand) {
        throw new NotFoundError('Brand');
      }
      const response = new BrandDetailResponse(foundBrand, context.lang);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
