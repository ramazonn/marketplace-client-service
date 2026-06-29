import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CategoryListParams } from '../../infrastructure';
import { CategoryEntity, CategoryStatusEnum, CloudFlareService, LanguageEnum, Redis, Repository } from '@ubaytools/core';
import { CacheTTLUtil } from '../../utils';

export class CategoryListItemResponse {
  id: string;
  name: string;
  parent: string | null;
  icon: string;
  how_to_select_text: string;
  how_to_select_url: string;
  constructor(category: CategoryEntity, lang: LanguageEnum) {
    this.id = category.getId().toString();
    this.name = category.getName()?.getByLang(lang) ?? null;
    this.parent = category.getParent()?.toString() ?? null;
    this.icon = category.getIcon() ? CloudFlareService.getImageUrlByFileID(category.getIcon()) : null;
    this.how_to_select_text = category.getHowToSelectText()?.getByLang(lang) ?? null;
    this.how_to_select_url = category.getHowToSelectUrl() ?? null;
  }
}

@prefix('/category')
export default class GetCategoryListController {
  @request('get', '/list')
  @summary('Category list')
  @security([])
  @tags(['Category'])
  @query((CategoryListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: CategoryListParams;
    try {
      params = await new CategoryListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const filter: any = { status: CategoryStatusEnum.ACTIVE };
      filter.parent = params.parent || { $exists: false };
      const redis = await Redis.getInstance();

      const cacheKey = `${process.env.NODE_ENV}:category:list:page:${params.page}:size:${params.size}:parent:${params.parent}:lang:${context.lang}`;

      let response: {
        total: number;
        items: CategoryListItemResponse[];
      };

      const cacheData = await redis.get(cacheKey);

      if (cacheData) {
        response = JSON.parse(cacheData);
      } else {
        const count = await Repository.Categories().countDocumentsByFilter(filter);
        const items = await Repository.Categories().list({ page: params.page, size: params.size }, filter);
        response = {
          total: count,
          items: items.map((item) => new CategoryListItemResponse(item, context.lang)),
        };

        const cacheTTL =  CacheTTLUtil.withRandomTTL(22 * 60 * 60);
        await redis.set(cacheKey, JSON.stringify(response), cacheTTL);
      }

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
