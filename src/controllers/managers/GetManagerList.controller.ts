import { Context } from 'koa';
import { IdParams, ListParams } from '../../infrastructure';
import { NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';
import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { string } from 'joi';

@prefix('/manager')
export default class GetManagerListController {
  @request('get', '/list')
  @summary('Managers list')
  @security([])
  @tags(['Manager'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const count = await Repository.Managers().countDocumentsByFilter({});
      const managers = await Repository.Managers().list({ page: params.page, size: params.size });
      const response = managers.map((entity) => {
        return { id: entity.getId().toString(), name: entity.getName() };
      });
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
