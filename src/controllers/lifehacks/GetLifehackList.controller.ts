import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, LifehacksEntity, ProductEntity, Redis, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';
import { CacheTTLUtil } from '../../utils';

class LifehackListItemResponse {
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
            images: (product.getAttachments() ?? []).filter(Boolean).map((fileId: string) => CloudFlareService.getImageUrlByFileID(fileId)),
          }
        : null;
  }
}

@prefix('/lifehacks')
export default class GetLifehackListController {
  @request('get', '/list')
  @summary('Lifehack list')
  @security([])
  @tags(['Lifehacks'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;

    try {
      params = await new ListParams(context.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const lang = (context.language || LanguageEnum.EN) as LanguageEnum;

      const redis = await Redis.getInstance();

      const cacheKey = `${process.env.NODE_ENV}:lifehacks:list:${params.page}:${params.size}:${lang}`;

      let total = 0;
      let lifehacks: LifehacksEntity[] = [];

      const cacheData = await redis.get(cacheKey);

      if (cacheData) {
        const parsed = JSON.parse(cacheData);

        total = parsed.total ?? 0;

        lifehacks = (parsed.items ?? []).map((item: any) => new LifehacksEntity().convertToEntity(item));
      } else {
        total = await Repository.Lifehacks().countDocumentsByFilter({});

        lifehacks = await Repository.Lifehacks().list({ page: params.page, size: params.size }, {}, { createdAt: -1 });

        const cacheTTL =  CacheTTLUtil.withRandomTTL(60 * 60);
        await redis.set(
          cacheKey,
          JSON.stringify({
            total,
            items: lifehacks.map((item) => item.convertToSchema()),
          }),
          cacheTTL,
        );
      }

      let likedLifehackIds = new Set<string>();

      const currentUserId = context.client?.getId?.();

      if (currentUserId && lifehacks.length) {
        const lifehackIds = lifehacks
          .map((lifehack) => lifehack.getId())
          .filter(Boolean)
          .map((id) => new Types.ObjectId(id));

        const likedRecords = await Repository.LifehackLikes().list(
          {
            page: 1,
            size: lifehackIds.length || 1,
          },
          {
            user: new Types.ObjectId(currentUserId),
            lifehack: { $in: lifehackIds },
          },
        );

        likedLifehackIds = new Set(likedRecords.map((item) => item.getLifehack()?.toString?.()).filter(Boolean));
      }

      const response = {
        total,
        items: lifehacks.map((lifehack) => {
          const lifehackId = lifehack.getId()?.toString();

          const isLiked = likedLifehackIds.has(lifehackId);

          return new LifehackListItemResponse(lifehack, lang, isLiked);
        }),
      };

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
