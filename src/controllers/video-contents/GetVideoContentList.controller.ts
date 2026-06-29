import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { VideoContentsEntity, Repository, LanguageEnum, Redis } from '@ubaytools/core';
import { CacheTTLUtil } from '../../utils';

class VideoContentListItemResponse {
  id: string;
  videoLink: string;
  title: string;
  description: string;
  constructor(videoContent: VideoContentsEntity, lang: LanguageEnum) {
    this.id = videoContent.getId().toString();
    this.videoLink = videoContent.getVideoLink()
    this.title = videoContent.getTitle().getByLang(lang)
    this.description = videoContent.getDescription()?.getByLang(lang)
  }
}

@prefix('/video-contents')
export default class GetVideoContentListController {
  @request('get', '/list')
  @summary('Video Content list')
  @security([])
  @tags(['Video Contents'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const cacheKey = `${process.env.NODE_ENV}:video-content:list:${params.page}:${params.size}:${context.lang}`;
      const countCacheKey = `${process.env.NODE_ENV}:video-content:count`;
      const redisClient = await Redis.getInstance();

      let count: any = await redisClient.get(countCacheKey);
      if (count) count = parseInt(count);
      if (!count) {
        count = await Repository.VideoContents().countDocumentsByFilter({});
        const cacheCountTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 50);
        await redisClient.set(countCacheKey, count.toString(), cacheCountTTL);
      }

      let response: any = await redisClient.get(cacheKey);
      if (response) response = JSON.parse(response);
      if (!response) {
        const videoContents = await Repository.VideoContents().list({ page: params.page, size: params.size }, {}, { createdAt: -1 });
        response = videoContents.map((videoContent) => new VideoContentListItemResponse(videoContent, context.lang));
        const cacheResponseTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(
          cacheKey,
          JSON.stringify(response),
          cacheResponseTTL,
        );
      }

      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
