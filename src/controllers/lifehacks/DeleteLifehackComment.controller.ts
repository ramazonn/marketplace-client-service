import { Context } from 'koa';
import { Types } from 'mongoose';
import {
  NotFoundError,
  Redis,
  Repository,
} from '@ubaytools/core';
import {
  path,
  prefix,
  request,
  security,
  summary,
  tags,
} from 'koa-swagger-decorator';
import { CannotDeleteCommentError, IdParams } from '../../infrastructure';

@prefix('/lifehacks')
export default class DeleteLifehackCommentController {
  @request('delete', '/comments-delete/{commentId}')
  @summary('Delete lifehack comment')
  @security([])
  @tags(['Lifehacks'])
  @path({ commentId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let idParams: IdParams;

    try {
      idParams = await new IdParams({ id: context.params.commentId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const comment = await Repository.LifehackComments().getById(
        new Types.ObjectId(idParams.id),
      );

      if (!comment) {
        throw new NotFoundError('Lifehack comment');
      }
      
      
      const redisClient = await Redis.getInstance();
      
      const user = comment.getUser();
      
      if (
        !user || user instanceof Types.ObjectId ||
        user.getId()?.toString() !== context.client.getId().toString()
      ) {
        throw new CannotDeleteCommentError();
      }
      
      const lifehackId = comment?.getLifehack();
      
      await Repository.LifehackComments().deleteManyByFilter({
        parentComment: comment.getId() as Types.ObjectId,
      });

      const deleted = await Repository.LifehackComments().deleteById(
        new Types.ObjectId(idParams.id),
      );

      if (deleted) {
        await Repository.Lifehacks().decrementCommentsCount(
          comment.getLifehack() as Types.ObjectId,
        );
      }

      await redisClient.deleteKeysByPattern(`${process.env.NODE_ENV}:lifehack:${lifehackId}:comments:`);

      return context.send.data({ deleted });
    } catch (error) {
      return context.send.error(error);
    }
  }
}