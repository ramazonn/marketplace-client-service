import { Context } from 'koa';
import { Types } from 'mongoose';
import {
  NotFoundError,
  Repository,
  LifehackLikesEntity,
} from '@ubaytools/core';
import {
  path,
  prefix,
  request,
  security,
  summary,
  tags,
} from 'koa-swagger-decorator';
import { IdParams } from '../../infrastructure';

@prefix('/lifehacks')
export default class ToggleLifehackLikeController {
  @request('post', '/likes-toggle/{lifehackId}')
  @summary('Toggle lifehack like')
  @security([])
  @tags(['Lifehacks'])
  @path({ lifehackId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let idParams: IdParams;

    try {
      idParams = await new IdParams({
        id: context.params.lifehackId,
      }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const lifehackId = new Types.ObjectId(idParams.id);
      const userId = context.client.getId();

      const foundLifehack = await Repository.Lifehacks().getById(lifehackId);
      if (!foundLifehack) {
        throw new NotFoundError('Lifehack');
      }

      const existingLike = await Repository.LifehackLikes().getByLifehackAndUser(
        lifehackId,
        userId,
      );

      if (existingLike) {
        const deleted = await Repository.LifehackLikes().deleteByLifehackAndUser(
          lifehackId,
          userId,
        );

        if (deleted) {
          await Repository.Lifehacks().decrementLikesCount(lifehackId);
        }

        return context.send.data({
          liked: false,
          action: 'unliked',
        });
      }

      const like = new LifehackLikesEntity()
        .buildLifehack(lifehackId)
        .buildUser(userId);

      const created = await Repository.LifehackLikes().create(like);
      await Repository.Lifehacks().incrementLikesCount(lifehackId);

      return context.send.data({
        id: created.getId()?.toString(),
        liked: true,
        action: 'liked',
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}