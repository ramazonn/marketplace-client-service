import { Context } from 'koa';
import { Types } from 'mongoose';
import {
  CloudFlareService,
  NotFoundError,
  Repository,
  LifehackCommentsEntity,
  UserEntity,
  Redis,
} from '@ubaytools/core';
import {
  path,
  prefix,
  query,
  request,
  security,
  summary,
  tags,
} from 'koa-swagger-decorator';
import { IdParams, ListParams } from '../../infrastructure';

class LifehackCommentsListItemResponse {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  replyCount: number;
  replied: boolean;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    avatar?: string | null;
  } | null;

  constructor(comment: LifehackCommentsEntity) {
    const user = comment.getUser();
    const userInfo = user instanceof UserEntity ? user.getUserInfo?.() : null;
    this.id = comment.getId()?.toString();
    this.text = comment.getText();
    this.createdAt = comment.getCreatedAt();
    this.updatedAt = comment.getUpdatedAt();
    this.replyCount = comment.getReplyCount();
    this.replied = comment.getReplied();

    this.user =
      user instanceof UserEntity
        ? {
          id: user.getId()?.toString(),
          firstName: userInfo?.getFirstname?.() || '',
          lastName: userInfo?.getLastname?.() || '',
          avatar: userInfo?.getAvatar?.()
            ? CloudFlareService.getImageUrlByFileID(userInfo.getAvatar())
            : null,
        }
        : null;
  }
}

@prefix('/lifehacks')
export default class GetLifehackCommentsListController {
  @request('get', '/comments-list/{lifehackId}')
  @summary('Lifehack comments list')
  @security([])
  @tags(['Lifehacks'])
  @path({ lifehackId: { type: 'string', required: true } })
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let idParams: IdParams;
    let listParams: ListParams;

    try {
      idParams = await new IdParams({
        id: context.params.lifehackId,
      }).validate();

      listParams = await new ListParams(context.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {

      const redisClient = await Redis.getInstance();

      const lifehackId = new Types.ObjectId(idParams.id);

      const cacheKey = `${process.env.NODE_ENV}:lifehack:${lifehackId}:comments:page:${listParams.page}:list:${listParams.size}`;

      const cached = await redisClient.get(cacheKey);

      if (cached) {
        return context.send.data(JSON.parse(cached));
      }

      const foundLifehack = await Repository.Lifehacks().getById(lifehackId);
      if (!foundLifehack) {
        throw new NotFoundError('Lifehack');
      }

      const comments = await Repository.LifehackComments().list(
        {
          page: listParams.page,
          size: listParams.size,
        },
        {
          lifehack: lifehackId,
          type: 'COMMENT',
        },
        { createdAt: -1 },
      );

      const commentsCount = await Repository.LifehackComments().countDocumentsByFilter({
        lifehack: lifehackId,
      });

     const response = {
        comments: comments.map((comment) => new LifehackCommentsListItemResponse(comment)),
        commentsCount,
      };

      await redisClient.set(cacheKey, JSON.stringify(response), 3600); // Cache for 1 hour

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}