import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, NewsEntity, NewsStatusEnum, Redis, Repository } from '@ubaytools/core';
import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { CacheTTLUtil } from '../../utils';

class NewsResponse {
  id: string;
  title: string;
  description: string;
  isRead: boolean;
  attachment: string;
  date: Date;
  link: string;
  viewCount: number;
  likes: number;
  constructor(news: NewsEntity, lang: LanguageEnum, isRead = false) {
    this.id = news.getId().toString();
    this.title = news.getTitle()?.getByLang(lang) ?? null;
    this.description = news.getDescription()?.getByLang(lang) ?? null;
    this.isRead = isRead;
    this.attachment = news.getAttachment() ? CloudFlareService.getImageUrlByFileID(news.getAttachment()?.getByLang(lang)) : null;
    this.date = news.getStartDate() ?? null;
    this.link = news.getLink() ?? null;
    this.viewCount = news.getViewCount() ?? null;
    this.likes = news.getLikeCount() ?? null;
  }
}

@prefix('/news')
export default class GetNewsListController {
  @request('get', '/list')
  @summary('News list')
  @security([])
  @tags(['News'])
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
      let cacheKey = `${process.env.NODE_ENV}:news:list:`;
      let countCacheKey = `${process.env.NODE_ENV}:news:count`;

      const userId = context.client?.getId()?.toString();

      if (userId) {
        cacheKey = `${cacheKey}user:${userId}:`;
        countCacheKey = `${countCacheKey}:user:${userId}`;
      }

      cacheKey = `${cacheKey}${params.page}:${params.size}:${context.lang}`;

      const redisClient = await Redis.getInstance();

      let filter: any = {
        status: NewsStatusEnum.ACTIVE,
      };

      let readIds = new Set<string>();
      if (userId) {
        const reads = await Repository.NewsRead().list(
          {},
          {
            user: context.client.getId(),
          },
        );

        readIds = new Set(reads.map((x) => x.getNews().toString()));
      }

      let count: any = await redisClient.get(countCacheKey);

      if (count) {
        count = parseInt(count);
      } else {
        count = await Repository.News().countDocumentsByFilter(filter);
        const cacheTTL1 = CacheTTLUtil.withRandomTTL(24 * 60 * 50);
        await redisClient.set(countCacheKey, count.toString(), cacheTTL1);
      }

      let result: any = await redisClient.get(cacheKey);
      if (result) {
        result = JSON.parse(result);
      } else {
        const newsList = await Repository.News().list({ page: params.page, size: params.size }, filter, { createdAt: -1 });
        result = newsList.map((news) => new NewsResponse(news, context.lang, readIds.has(news.getId().toString())));
        const cacheTTL2 = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(cacheKey, JSON.stringify(result), cacheTTL2);
      }

      return context.send.data({ total: count, items: result });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
