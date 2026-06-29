import { params, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CategoryEntity, CategoryStatusEnum, LanguageEnum, Redis, Repository } from '@ubaytools/core';

import { CategoryListItemResponse } from './GetCategoryList.controller';
import { CacheTTLUtil } from '../../utils';

export class GetPopularCategoriesResponse extends CategoryListItemResponse {
  subCategories: Array<CategoryListItemResponse>;
  constructor(category: CategoryEntity, subCategories: Array<CategoryListItemResponse>, lang: LanguageEnum) {
    super(category, lang);
    this.subCategories = subCategories;
  }
}

@prefix('/category')
export default class GetPopularCategoriesController {
  @request('get', '/popular')
  @summary('Category popular list')
  @security([])
  @tags(['Category'])
  @query({ size: { type: 'number', required: true } })
  static async controller(context: Context): Promise<void> {
    try {
      const filter: any = { status: CategoryStatusEnum.ACTIVE, isPopular: true };
      const size = parseInt(context.request.query?.['size'] as any as string);

      const redisClient = await Redis.getInstance();
      let result: any = await redisClient.get(`${process.env.NODE_ENV}:category:popular:${size || 10}:${context.lang}`);
      if (!result) {
        const items = await Repository.Categories().list({ page: 1, size: size || 10 }, filter);
        result = await Promise.all(
          items.map(async (item) => {
            const subCategories = await Repository.Categories().list({}, { parent: item.getId()?.toString() });
            const subResponse = subCategories?.map((subItem) => new CategoryListItemResponse(subItem, context.lang));
            return new GetPopularCategoriesResponse(item, subResponse, context.lang);
          }),
        );
        const cacheTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(
          `${process.env.NODE_ENV}:category:popular:${size || 10}:${context.lang}`,
          JSON.stringify(result),
          cacheTTL,
        );
      } else {
        result = JSON.parse(result);
      }

      return context.send.data({ total: result.length, items: result });
    } catch (error) {
      return context.send.error(error);
    }
  }

  
}
