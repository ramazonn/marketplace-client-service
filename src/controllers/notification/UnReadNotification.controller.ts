import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { Repository } from '@ubaytools/core';
import { ListParams } from '../../infrastructure';
import { LanguageEnum, NotificationEntity, NotificationPayloadSchema, NotificationTypeEnum } from '@ubaytools/core';
import { Types } from 'mongoose';

class NotificationResponse {
  id: string;
  type: NotificationTypeEnum;
  title: string;
  text: string;
  imageUrl: string;
  payload: NotificationPayloadSchema;
  readAt: Date | null;
  createdAt: Date;

  constructor(notification: NotificationEntity, lang: LanguageEnum) {
    this.id = notification.getId().toString();
    this.type = notification.getType();
    this.title = notification.getTitle()?.getByLang(lang) ?? null;
    this.text = notification.getText()?.getByLang(lang) ?? null;
    this.imageUrl = notification.getImageUrl() ?? null;
    this.payload = notification.getPayload() ?? null;
    this.readAt = notification.getReadAt() ?? null;
    this.createdAt = notification.getCreatedAt();
  }
}

@prefix('/notifications')
export default class GetUnReadNotificationListController {
  @request('get', '/unread')
  @summary('Notification inbox')
  @security([])
  @tags(['Notifications'])
  static async controller(context: Context): Promise<void> {
    try {
      const user = context.client.getId();
      const response = await Repository.Notification().getUnreadCounts(new Types.ObjectId(user));

      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
