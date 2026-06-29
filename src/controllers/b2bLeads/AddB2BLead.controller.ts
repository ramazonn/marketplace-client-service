import { Context } from 'koa';
import { Repository, B2BLeadEntity } from '@ubaytools/core';
import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { AddB2BLeadParams, AddSellerLeedParams } from '../../infrastructure';
import { OrderNotificationQueueService, TelegramMessageSender } from '../../services';

@prefix('/b2b-leads')
export default class AddB2BLeadController {
  @request('post', '/add')
  @summary('B2B Leads add')
  @security([])
  @tags(['B2B Leads'])
  @body((AddB2BLeadParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: AddB2BLeadParams;
    try {
      params = await new AddB2BLeadParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const b2bLead = new B2BLeadEntity()
        .buildFullName(params.fullName)
        .buildPhoneNumber(params.phoneNumber)
        .buildCompanyName(params.companyName)
        .buildAdditionalInfo(params.additionalInfo);
      const createdB2BLead = await Repository.B2BLeads().create(b2bLead);

      await OrderNotificationQueueService.getInstance().publishOrderTelegramNotification(createdB2BLead.getId().toString(), 'send-b2b-lead-notification');

      // const tgMessageSender = new TelegramMessageSender();
      // const message = AddB2BLeadController.reportMessageFormatter(params);
      // tgMessageSender.sendMessageToTopic(message, Number(process.env.TG_B2B_LEADS_TOPIC));

      return context.send.data({ id: createdB2BLead.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }

  static reportMessageFormatter(params: AddB2BLeadParams) {
    const message = `👨‍🔧 <b>Партнер:</b> ${params.fullName} - ${params.phoneNumber}\n🏢 <b>Название компании:</b> ${params.companyName}\n💬 <b>Дополнительные комментарии:</b> ${params.additionalInfo}`;
    return message;
  }
}
