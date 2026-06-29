import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LikedProductParams } from '../../../infrastructure';
import { NotFoundError, Redis, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/favorite')
export default class RemoveLikeFromProductController {
  @request('put', '/remove-like')
  @summary('Remove Like from Favorite Product')
  @security([])
  @tags(['Favorite'])
  @body((LikedProductParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: LikedProductParams;
    try {
      params = await new LikedProductParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const userId = context.client.getId();
      const found = await Repository.UserLikedProducts().getLikedProductByUser(userId, new Types.ObjectId(params.productId));
      if (!found) {
        throw new NotFoundError('User liked product');
      }
      found.buildIsLiked(false);
      await Repository.UserLikedProducts().update(found);

      const redisClient = await Redis.getInstance();
      const countCachePattern = `${process.env.NODE_ENV}:user:favorite:count:${userId}`;
      const listCachePattern = `${process.env.NODE_ENV}:user:favorite:list:${userId}:`;
      await redisClient.deleteKeysByPattern(countCachePattern);
      await redisClient.deleteKeysByPattern(listCachePattern);

      const count = await Repository.UserLikedProducts().countDocumentsByFilter({ user: userId, isLiked: true });
      return context.send.data({ updated: true, total: count });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
