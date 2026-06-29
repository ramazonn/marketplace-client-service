import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService, LanguageEnum, PromotionPageEnum, PromotionsEntity, PromotionTypeEnum, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil } from '../../utils';

class PromotionListItemResponse {
  id: string;
  type: PromotionTypeEnum;
  attachment: string;
  startDate: Date;
  endDate: Date;
  link: string;
  order: number;
  page: PromotionPageEnum;
  screen: string;
  screenId: string;
  constructor(promotion: PromotionsEntity, lang: LanguageEnum) {
    this.id = promotion.getId().toString();
    this.type = promotion.getType() ?? null;
    this.attachment = promotion.getAttachment() ? CloudFlareService.getImageUrlByFileID(promotion.getAttachment()?.getByLang(lang)) : null;
    this.startDate = promotion.getStartDate() ?? null;
    this.endDate = promotion.getEndDate() ?? null;
    this.link = promotion.getLink() ?? null;
    this.page = promotion.getPage() ?? null;
    this.order = promotion.getOrder() ?? null;
    this.screen = promotion.getScreen()??null;
    this.screenId = promotion.getScreenId()??null;
  }
}
@prefix('/promotion')
export default class GetPromotionListController {
  @request('get', '/list')
  @summary('Promotion list')
  @security([])
  @tags(['Promotion'])
  @query({ page: { type: 'string', example: PromotionPageEnum.Main, description: Object.values(PromotionPageEnum).join('|') } })
  static async controller(context: Context): Promise<void> {
    try {

      const redis = await Redis.getInstance();

      const cacheKey =
        `${process.env.NODE_ENV}:promotion:list:${context.lang}:${context.request.query.page || 'all'}`;

      const cached = await redis.get(cacheKey);

      if (cached) {
        return context.send.data(JSON.parse(cached));
      }
      let promotions = await Repository.Promotions().list({ page: 1, size: 1000 }, {}, { order: 1 });
      if (context.request.query.page) promotions = promotions.filter((pr) => pr.getPage() === context.request.query.page);
      const response = promotions.map((item) => new PromotionListItemResponse(item, context.lang));

      const responseData = {
        total: promotions.length,
        items: response,
      };

      await redis.set(
        cacheKey,
        JSON.stringify(responseData),
        CacheTTLUtil.withRandomTTL(30 * 60),
      );

      return context.send.data(responseData);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
