import { Types } from 'mongoose';
import { LanguageEnum, NotFoundError, Repository, ProductsModel, SpecialEventStatusEnum, SpecialEventEntity, ProductEntity, SpecialEventProductEntity } from '@ubaytools/core';
import {  SpecialEventProductItemResponse } from '../../infrastructure';
import { GetProductDetailUseCase } from '../product/GetProductDetail.usecase';
import { GetSpecialEventProductDetailUseCase } from '../product/GetProductDetailWithEventLimit.usecase';
class SpecialEventListItemResponse {
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
  constructor(specialEvent: SpecialEventEntity, products: Array<SpecialEventProductItemResponse>, lang: LanguageEnum) {
      this.id = specialEvent.getId().toString();
      this.name = specialEvent.getName().getByLang(lang);
      this.description = specialEvent.getDescription().getByLang(lang);
      this.backgroundImageMobile = specialEvent.getBackgroundImageMobile();    
      this.backgroundImageWeb = specialEvent.getBackgroundImageWeb();
      this.startAt = specialEvent.getStartAt();
      this.endAt = specialEvent.getEndAt();
      this.daysOfWeek = specialEvent.getDaysOfWeek();
    this.eventProductLimit = specialEvent.getEventProductLimit();
    this.eventLimitDuration = specialEvent.getEventLimitDuration() ?? 0;
    
    this.status = specialEvent.getStatus();
  this.products= products??[];
    
  }
}
export class GetActiveSpecialEvents {
  static async execute(lang: LanguageEnum, userId?: string){
    const specialEvents = await Repository.SpecialEvents().list({ page: 1, size: 100}, { status: SpecialEventStatusEnum.ACTIVE });
    let result = await Promise.all(specialEvents.map(async (event) => {
      const today=new Date();
      const startDate=event.getStartAt()? new Date(event.getStartAt()):null;
      const endDate = event.getEndAt()? new Date(event.getEndAt()):null;
      const daysOfWeek = event.getDaysOfWeek();
      let activeSpecialEvent: SpecialEventEntity|null=null;
      
      if (startDate && endDate) { 
        if (today >= startDate && today <= endDate) {
          activeSpecialEvent = event;          
        } 
      }
      else if (daysOfWeek.length > 0) {
        const dayOfWeek = today.getDay();
        if (daysOfWeek.includes(dayOfWeek)) {
          activeSpecialEvent=event;
        } 
      }
      else {
        activeSpecialEvent = event;
      }
      if (!activeSpecialEvent) return null ;

      const products = await Promise.all(
        activeSpecialEvent.getActiveProducts().map(async (specialEventProduct: SpecialEventProductEntity) => {
          const product = specialEventProduct.getProduct() as ProductEntity
          const discountPercent = specialEventProduct.getDiscountPercent()
          const discountPrice = specialEventProduct.getDiscountPrice()
          const specialEventProductLimit = specialEventProduct.getProductLimit()
          return await GetSpecialEventProductDetailUseCase.execute(product.getId().toHexString(), lang, specialEventProductLimit, discountPercent, discountPrice,userId);
        }),
      );
      return new SpecialEventListItemResponse(activeSpecialEvent, products, lang);
      
    }));
    
    result=result.filter(event => event !== null);

    return result
  }

}
