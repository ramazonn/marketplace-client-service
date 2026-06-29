import { Context } from 'koa';
import { Repository, LifehacksEntity, SellerLeedsEntity } from '@ubaytools/core';
import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { AddSellerLeedParams } from '../../infrastructure';
import { TelegramMessageSender } from '../../services';
import { OrderNotificationQueueService } from '../../services/queues/OrderNotificationQueue.service';

@prefix('/seller-leeds')
export default class AddSellerLeedController {
  @request('post', '/add')
  @summary('SellerLeed add')
  @security([])
  @tags(['SellerLeeds'])
  @body((AddSellerLeedParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: AddSellerLeedParams;
    try {
      params = await new AddSellerLeedParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const sellerLeed = new SellerLeedsEntity()
        .buildFullName(params.fullName)
        .buildPhoneNumber(params.phoneNumber)
        .buildStoreName(params.storeName)
        .buildSphera(params.sphera)
        .buildAdditionalInfo(params.additionalInfo);
      const createdSellerLeed = await Repository.SellerLeeds().create(sellerLeed);

      // const tgMessageSender = new TelegramMessageSender();
      // const message = AddSellerLeedController.reportMessageFormatter(params);
      // tgMessageSender.sendMessageToTopic(message, Number(process.env.TG_SELLER_LEADS_TOPIC));

      await OrderNotificationQueueService.getInstance().publishOrderTelegramNotification(createdSellerLeed.getId().toString(), 'send-seller-lead-notification');
      
      return context.send.data({ id: createdSellerLeed.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }

  static reportMessageFormatter(params: AddSellerLeedParams) {
    const message = `👨‍🔧 <b>Партнер:</b> ${params.fullName} - ${params.phoneNumber}\n🏢 <b>Название магазин:</b> ${params.storeName}\n🌐 <b>Сфера:</b> ${params.storeName}\n💬 <b>Дополнительные комментарии:</b> ${params.additionalInfo}`;
    return message;
  }
}
