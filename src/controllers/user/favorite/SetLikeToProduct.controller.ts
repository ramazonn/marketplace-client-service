import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LikedProductParams } from '../../../infrastructure';
import { NotFoundError, Redis, Repository, UserLikedProductEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/favorite')
export default class SetLikeToProductController {
  @request('put', '/set-like')
  @summary('Set Favorite to product by user')
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
      let id: string;
      if (!found) {
        const item = new UserLikedProductEntity()
          .buildProduct(new Types.ObjectId(params.productId))
          .buildUser(userId)
          .buildIsLiked(true);
        const created = await Repository.UserLikedProducts().create(item);
        id = created.getId().toString();
      } else {
        found.buildIsLiked(true);
        await Repository.UserLikedProducts().update(found);
        id = found.getId().toString();
      }

      const redisClient = await Redis.getInstance();
      const countCachePattern = `${process.env.NODE_ENV}:user:favorite:count:${userId}`;
      const listCachePattern = `${process.env.NODE_ENV}:user:favorite:list:${userId}:`;
      await redisClient.deleteKeysByPattern(countCachePattern);
      await redisClient.deleteKeysByPattern(listCachePattern);

      const count = await Repository.UserLikedProducts().countDocumentsByFilter({ user: userId, isLiked: true });
      return context.send.data({ created: true, id: id, total: count });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
