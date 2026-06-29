import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CategoryListParams, IdParams } from '../../infrastructure';
import { CategoryEntity, CategoryStatusEnum, CloudFlareService, LanguageEnum, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';
import { CategoryListItemResponse } from './GetCategoryList.controller';

@prefix('/category')
export default class GetCategoryDetailController {
  @request('get', '/detail/{categoryId}')
  @summary('Category detail by id')
  @security([])
  @tags(['Category'])
  @path({ categoryId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.categoryId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const category = await Repository.Categories().getById(new Types.ObjectId(params.id));
      const response = new CategoryListItemResponse(category, context.lang);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
