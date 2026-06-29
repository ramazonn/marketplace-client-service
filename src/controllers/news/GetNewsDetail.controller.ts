import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, NewsEntity, NewsReadEntity, Redis, Repository } from '@ubaytools/core';
import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Types } from 'mongoose';

class NewsDetailResponse {
  id: string;
  title: string;
  description: string;
  attachment: string;
  date: Date;
  link: string;
  viewCount: number;
  likes: number;
  constructor(news: NewsEntity, lang: LanguageEnum) {
    this.id = news.getId().toString();
    this.title = news.getTitle()?.getByLang(lang) ?? null;
    this.description = news.getDescription()?.getByLang(lang) ?? null;
    this.attachment = news.getAttachment() ? CloudFlareService.getImageUrlByFileID(news.getAttachment()?.getByLang(lang)) : null;
    this.date = news.getStartDate() ?? null;
    this.link = news.getLink() ?? null;
    this.viewCount = news.getViewCount() ?? null;
    this.likes = news.getLikeCount() ?? null;
  }
}

@prefix('/news')
export default class GetNewsDetailController {
  @request('get', '/detail/{newsId}')
  @summary('News detail')
  @security([])
  @tags(['News'])
  @path({ newsId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.newsId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const clientRedis = await Redis.getInstance();
      // TODO sort startDate, filter with status and endDate
      const news = await Repository.News().getById(new Types.ObjectId(params.id));

      const userId = context.client?.getId()?.toString();
      if (userId) {
        const readNewsUser = await Repository.NewsRead().list({}, { user: new Types.ObjectId(userId), news: new Types.ObjectId(params.id) });
        if (readNewsUser.length == 0) {
          const readNews = new NewsReadEntity().buildUser(new Types.ObjectId(userId)).buildNews(new Types.ObjectId(params.id));

          await clientRedis.deleteKeysByPattern(`${process.env.NODE_ENV}:news:list:user:${userId}:`);

          await clientRedis.deleteKeysByPattern(`${process.env.NODE_ENV}:news:count` + `:user:${userId}`);

          await Repository.NewsRead().create(readNews);
        }
      }
      news.buildViewCount(news.getViewCount() + 1);
      const result = new NewsDetailResponse(news, context.lang);
      await Repository.News().update(news);
      return context.send.data(result);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
