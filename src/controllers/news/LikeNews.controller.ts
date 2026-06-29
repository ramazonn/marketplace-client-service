import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams, ListParams } from '../../infrastructure';
import { NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/news')
export default class LikeNewsController {
  @request('put', '/like/{newsId}')
  @summary('News set/unset like')
  @security([])
  @tags(['News'])
  @path({ newsId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams; // newsId, clientId, liked = true/false
    try {
      params = await new IdParams({ id: context.params.newsId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const found = await Repository.News().getById(new Types.ObjectId(params.id));
      if (!found) {
        throw new NotFoundError('News');
      }
      found.buildLikeCount(found.getLikeCount() + 1);
      await Repository.News().update(found);
      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
