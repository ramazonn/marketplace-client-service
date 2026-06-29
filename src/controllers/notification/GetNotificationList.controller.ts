import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LanguageEnum, NotificationEntity, Redis, Repository } from '@ubaytools/core';
import { ListParams } from '../../infrastructure';

class NotificationResponse {
  id: string;
  title: string;
  text: string;
  type: string;
  isRead: boolean;
  imageUrl: string;
  payload: any;
  readAt: Date;
  createdAt: Date;

  constructor(notification: NotificationEntity, lang: LanguageEnum) {
    this.id = notification.getId().toString();
    this.title = notification.getTitle()?.getByLang(lang) ?? null;
    this.text = notification.getText()?.getByLang(lang) ?? null;
    this.type = notification.getType?.() ?? null;
    this.isRead = !!notification.getReadAt?.();
    this.imageUrl = notification.getImageUrl?.() ?? null
    this.payload = notification.getPayload?.() ?? null;
    this.readAt = notification.getReadAt?.() ?? null;
    this.createdAt = notification.getCreatedAt();
  }
}

@prefix('/notifications')
export default class GetNotificationListController {
  @request('get', '/list')
  @summary('Notification inbox')
  @security([])
  @tags(['Notifications'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let pagination: ListParams;

    try {
      pagination = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);

      return context.send.error(joiError);
    }

    try {
      const cacheKey =
        `${process.env.NODE_ENV}:notification:list:` +
        `user:${context.client.getId()}:` +
        `lang:${context.lang}:` +
        `page:${pagination.page}:` +
        `size:${pagination.size}`;

      const clientRedis = await Redis.getInstance();

      const cached = await clientRedis.get(cacheKey);

      let respons: any;
      if (cached) {
        respons = JSON.parse(cached);
      } else {
        const notifications = await Repository.Notification().list(pagination, { user: context.client.getId() }, { createdAt: -1 });

        const count = await Repository.Notification().countDocumentsByFilter({
          user: context.client.getId(),
        });

        const result = notifications.map((item) => new NotificationResponse(item, context.lang));
        respons = {
          total: count,
          items: result,
        };

        await clientRedis.set(cacheKey, JSON.stringify(respons), 5 * 60);
      }

      return context.send.data(respons);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
