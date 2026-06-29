import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LanguageEnum, PromoCodeEntity, PromoCodeTypeEnum, Repository, TranslatesSchema } from '@ubaytools/core';
import { ListParams } from '../../infrastructure';

class PromoCodeListItemResponse {
  id: string;
  type: PromoCodeTypeEnum;
  code: string;
  description: string;
  startDate: Date;
  endDate: Date;
  constructor(promocode: PromoCodeEntity, lang: LanguageEnum = LanguageEnum.RU) {
    this.id = promocode.getId().toString();
    this.type = promocode.getType() ?? null;
    this.code = promocode.getCode() ?? null;
    this.description = promocode.getDescription()?.getByLang(lang) ?? null;
    this.startDate = promocode.getStartDate() ?? null;
    this.endDate = promocode.getEndDate() ?? null;
  }
}
@prefix('/promocode')
export default class GetPromoCodeListController {
  @request('get', '/list')
  @summary('Promocode list')
  @security([])
  @tags(['Promocode'])    
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let listParams: ListParams;
    try {
      listParams = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      
      let promocodes = await Repository.PromoCodes().list({ page: 1, size: 1000 });
      const response = promocodes.map((item) => new PromoCodeListItemResponse(item, context.lang));
      return context.send.data({ total: promocodes.length, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
