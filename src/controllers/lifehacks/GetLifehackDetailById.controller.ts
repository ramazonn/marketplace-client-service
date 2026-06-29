import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import {
  CloudFlareService,
  LanguageEnum,
  LifehacksEntity,
  NotFoundError,
  ProductEntity,
  Repository,
} from '@ubaytools/core';
import { Types } from 'mongoose';

class LifehackDetailResponse {
  id: string;
  videoLink: string;
  likesCount: number;
  commentsCount: number;
  viewCount: number;
  isLiked: boolean;
  product: {
    id: string;
    name: string;
    images: string[];
  } | null;

  constructor(lifehack: LifehacksEntity, lang: LanguageEnum, isLiked: boolean) {
    const product = lifehack.getProduct();

    this.id = lifehack.getId()?.toString();
    this.videoLink = lifehack.getVideoLink();
    this.likesCount = lifehack.getLikesCount();
    this.commentsCount = lifehack.getCommentsCount();
    this.viewCount = lifehack.getViewCount();
    this.isLiked = isLiked;
    this.product =
      product instanceof ProductEntity
        ? {
          id: product.getId()?.toString(),
          name: product.getName()?.getByLang(lang) ?? '',
          images: (product.getAttachments() ?? []).map((fileId: string) =>
            CloudFlareService.getImageUrlByFileID(fileId),
          ),
        }
        : null;
  }
}

@prefix('/lifehacks')
export default class GetLifehackDetailByIdController {
  @request('get', '/detail/{lifehackId}')
  @summary('Lifehack detail')
  @security([])
  @tags(['Lifehacks'])
  @path({ lifehackId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;

    try {
      params = await new IdParams({
        id: context.params.lifehackId,
      }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const lifehackId = new Types.ObjectId(params.id);
      const lang = (context.language || LanguageEnum.EN) as LanguageEnum;

      const foundLifehack = await Repository.Lifehacks().getById(lifehackId);
      if (!foundLifehack) {
        throw new NotFoundError('Lifehack');
      }

      let isLiked = false;
      const currentUserId = context.client.getId();

      if (currentUserId) {
        const likesCount = await Repository.LifehackLikes().countDocumentsByFilter({
          lifehack: lifehackId,
          user: new Types.ObjectId(currentUserId),
        });
        isLiked = likesCount > 0;
      }

      await Repository.Lifehacks().incrementViewCount(lifehackId);

      const response = new LifehackDetailResponse(foundLifehack, lang, isLiked);
      response.viewCount += 1;

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}