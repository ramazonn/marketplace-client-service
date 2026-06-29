import { Context } from 'koa';
import { LanguageEnum, NotFoundError, ProductEntity, Repository, SpecialEventEntity, SpecialEventProductEntity, SpecialEventStatusEnum, StoresEntity } from '@ubaytools/core';
import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { IdParams, SpecialEventProductItemResponse } from '../../infrastructure';
import { Types } from 'mongoose';
import { GetSpecialEventProductDetailUseCase } from '../../usecases/product/GetProductDetailWithEventLimit.usecase';

class SpecialEventDetailResponse {
    id: string;
    name: string;
    description: string;
    backgroundImageMobile: string;
    backgroundImageWeb: string;
    startAt: Date;
    endAt: Date;
    daysOfWeek: Array<number>;
  eventProductLimit: number;
  eventLimitDuration: number;
  status: SpecialEventStatusEnum;
  products: Array<SpecialEventProductItemResponse>;
  constructor(specialEvent: SpecialEventEntity,products:Array<SpecialEventProductItemResponse>, lang: LanguageEnum) {
    this.id = specialEvent.getId().toString();
    this.name = specialEvent.getName().getByLang(lang);
    this.description = specialEvent.getDescription().getByLang(lang);
    this.backgroundImageMobile = specialEvent.getBackgroundImageMobile();
    this.backgroundImageWeb = specialEvent.getBackgroundImageWeb();
    this.startAt = specialEvent.getStartAt();
    this.endAt = specialEvent.getEndAt();
    this.daysOfWeek = specialEvent.getDaysOfWeek();
    this.eventProductLimit = specialEvent.getEventProductLimit() ?? 0;
    this.eventLimitDuration = specialEvent.getEventLimitDuration() ?? 0;

    this.status = specialEvent.getStatus();
    this.products= products??[];
  }
}

@prefix('/special-event')
export default class GetSpecialEventDetailController {
  @request('get', '/single/{specialEventId}')
  @summary('Get Special Event Detail')
  @security([])
  @tags(['Special Event'])
  @path({ specialEventId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try { 
      params = await new IdParams({ id: context.params.specialEventId }).validate();
      }
      catch (error) {
        const joiError = await context.joi.handle(error);
        return context.send.error(joiError);
      }
      try {
        const specialEvent = await Repository.SpecialEvents().getById(new Types.ObjectId(params.id));
        if (!specialEvent) {
          throw new NotFoundError('Special Event');
        }
        const products = await Promise.all(
          specialEvent.getActiveProducts().map(async (specialEventProduct: SpecialEventProductEntity) => {
            const product = specialEventProduct.getProduct() as ProductEntity
            const discountPercent = specialEventProduct.getDiscountPercent()
            const discountPrice = specialEventProduct.getDiscountPrice()
            const specialEventProductLimit = specialEventProduct.getProductLimit()
            return await GetSpecialEventProductDetailUseCase.execute(product.getId().toHexString(), context.lang, specialEventProductLimit, discountPercent, discountPrice, context?.client?.getId() ?? null);
          }),
        );
        return context.send.data(new SpecialEventDetailResponse(specialEvent, products,context.lang));
    } catch (error) {
      return context.send.error(error);
      }
      
  }
} 