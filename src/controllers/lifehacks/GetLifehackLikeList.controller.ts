import { Context } from 'koa';
import { Types } from 'mongoose';
import {
  NotFoundError,
  Repository,
  LifehackLikesEntity,
  UserEntity,
  CloudFlareService,
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

class LifehackLikesListItemResponse {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    avatar?: string | null;
  } | null;

  constructor(like: LifehackLikesEntity) {
    const user = like.getUser();
    const userInfo =
      user instanceof UserEntity ? user.getUserInfo?.() : null;

    this.id = like.getId()?.toString();
    this.createdAt = like.getCreatedAt();
    this.updatedAt = like.getUpdatedAt();

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
export default class GetLifehackLikesListController {
  @request('get', '/likes-list/{lifehackId}')
  @summary('Lifehack likes list')
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
      const lifehackId = new Types.ObjectId(idParams.id);

      const foundLifehack = await Repository.Lifehacks().getById(lifehackId);
      if (!foundLifehack) {
        throw new NotFoundError('Lifehack');
      }

      const likes = await Repository.LifehackLikes().list(
        {
          page: listParams.page,
          size: listParams.size,
        },
        { lifehack: lifehackId },
        { createdAt: -1 },
      );

      const likesCount = await Repository.LifehackLikes().countDocumentsByFilter({
        lifehack: lifehackId,
      });

      return context.send.data({
        likes: likes.map((like) => new LifehackLikesListItemResponse(like)),
        likesCount,
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}