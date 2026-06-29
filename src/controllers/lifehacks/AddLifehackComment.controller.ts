import { Context } from 'koa';
import { Types } from 'mongoose';
import { NotFoundError, Repository, LifehackCommentsEntity, LifehackCommentTypeEnum, Redis } from '@ubaytools/core';
import { body, path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { AddLifehackCommentParams, IdParams } from '../../infrastructure';

@prefix('/lifehacks')
export default class AddLifehackCommentController {
  @request('post', '/comments-create/{lifehackId}')
  @summary('Add lifehack comment')
  @security([])
  @tags(['Lifehacks'])
  @path({ lifehackId: { type: 'string', required: true } })
  @body((AddLifehackCommentParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let idParams: IdParams;
    let params: AddLifehackCommentParams;

    try {
      idParams = await new IdParams({ id: context.params.lifehackId }).validate();
      params = await new AddLifehackCommentParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const redisClient = await Redis.getInstance();

      const lifehackId = new Types.ObjectId(idParams.id);
      const foundLifehack = await Repository.Lifehacks().getById(lifehackId);

      if (!foundLifehack) {
        throw new NotFoundError('Lifehack');
      }

      const comment = new LifehackCommentsEntity()
        .buildLifehack(lifehackId)
        .buildUser(context.client.getId())
        .buildType(LifehackCommentTypeEnum.COMMENT)
        .buildText(params.text);

      const created = await Repository.LifehackComments().create(comment);
      await Repository.Lifehacks().incrementCommentsCount(lifehackId);

      await redisClient.deleteKeysByPattern(`${process.env.NODE_ENV}:lifehack:${lifehackId}:comments:`);
      return context.send.data({
        id: created.getId().toString(),
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
