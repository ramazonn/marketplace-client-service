import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CategoryEntity, CategoryStatusEnum, LanguageEnum, Redis, Repository } from '@ubaytools/core';
import { CategoryListItemResponse } from './GetCategoryList.controller';
import * as moment from 'moment';
import { CacheTTLUtil } from '../../utils';

export class CategoryRecursiveItemResponse extends CategoryListItemResponse {
  subCategories: Array<CategoryRecursiveItemResponse> | null = null;
  constructor(category: CategoryEntity, lang: LanguageEnum) {
    super(category, lang);
  }

  setSubCategories(categories: Array<CategoryRecursiveItemResponse>) {
    this.subCategories = categories;
  }
}

@prefix('/category')
export default class GetAllCategoryRecursiveController {
  @request('get', '/recursive-list')
  @summary('Get all categories and sub-categories')
  @security([])
  @tags(['Category'])
  static async controller(context: Context): Promise<void> {
    try {
      const redisClient = await Redis.getInstance();
      let result: any = await redisClient.get(`${process.env.NODE_ENV}:category:recursive-list:${context.lang}`);
      if (!result) {
        const items = await Repository.Categories().list({ page: 1, size: 1000 }, { status: CategoryStatusEnum.ACTIVE });
        result = await GetAllCategoryRecursiveController.dfs(context, null, items);
        const cacheTTL =  CacheTTLUtil.withRandomTTL(22 * 60 * 60);
        await redisClient.set(`${process.env.NODE_ENV}:category:recursive-list:${context.lang}`, JSON.stringify(result), cacheTTL);
      } else {
        result = JSON.parse(result);
      }
      return context.send.data(result);
    } catch (error) {
      return context.send.error(error);
    }
  }

  static async dfs(context: Context, parent: string | null, items: Array<CategoryEntity>): Promise<Array<CategoryRecursiveItemResponse>> {
    const tempItems = items.filter((item) => {
      return parent ? item.getParent()?.toString() === parent : !item.getParent();
    });
    const result = tempItems.map((item) => new CategoryRecursiveItemResponse(item, context.lang));
    for (const resultItem of result) {
      const subCategories = await GetAllCategoryRecursiveController.dfs(context, resultItem.id, items);
      resultItem.setSubCategories(subCategories);
    }
    return result;
  }
}
