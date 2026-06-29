import { prefix, request, security, summary, tags, path } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LanguageEnum, NotFoundError, Redis, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';
import { IdParams } from '../../infrastructure';
import { NotificationEntity, NotificationPayloadSchema, NotificationTypeEnum } from '@ubaytools/core';

class NotificationDetailResponse {
  id: string;
  type: NotificationTypeEnum;
  title: string;
  text: string;
  imageUrl: string;
  payload: NotificationPayloadSchema;
  readAt: Date | null;

  constructor(notification: NotificationEntity, lang: LanguageEnum) {
    this.id = notification.getId().toString();
    this.type = notification.getType();
    this.title = notification.getTitle()?.getByLang(lang) ?? null;
    this.text = notification.getText()?.getByLang(lang) ?? null;
    this.imageUrl = notification.getImageUrl() ?? null;
    this.readAt = notification.getReadAt() ?? null;
  }
}

@prefix('/notifications')
export default class GetNotificationDetailController {
  @request('get', '/detail/{id}')
  @summary('Notification detail')
  @security(['jwt'])
  @tags(['Notifications'])
  @path({
    id: {
      type: 'string',
      required: true,
    },
  })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;

    try {
      params = await new IdParams({
        id: context.params.id,
      }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const cacheKey =
        `${process.env.NODE_ENV}:notification:detail:` + `user:${context.client.getId()}:` + `notification:${params.id}:` + `lang:${context.lang}`;
      const clientRedis = await Redis.getInstance();

      const cached = await clientRedis.get(cacheKey);

      let respons: any;

      if (cached) {
        respons = JSON.parse(cached);
      } else {
        const notification = await Repository.Notification().getById(new Types.ObjectId(params.id));

        if (!notification) {
          throw new NotFoundError('Notification');
        }

        if (!notification.getReadAt()) {
          notification.buildReadAt(new Date());
          await Repository.Notification().update(notification);
          await clientRedis.deleteKeysByPattern(`${process.env.NODE_ENV}:notification:list:` + `user:${context.client.getId()}:`);
        }

        respons = new NotificationDetailResponse(notification, context.lang);

        await clientRedis.set(cacheKey, JSON.stringify(respons), 5 * 60);
      }

      return context.send.data(respons);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
