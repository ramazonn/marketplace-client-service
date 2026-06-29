import { header, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { confirmationResendCase, ConfirmationTypeEnum, LanguageEnum, OtpChannelType } from '@ubaytools/core';

@prefix('/confirmation')
export default class ConfirmationReSendController {
  @request('post', '/resend')
  @summary('Resend sms confirmation')
  @security([{ sessionToken: [] }])
  @tags(['Confirmation'])
  @header({
    'device-uid': { type: 'string', required: true },
    'content-language': { type: 'string', example: 'uz' },
    token: { type: 'string', required: true },
    signature: { type: 'string', required: false, },
    type: { type: 'string', enum: Object.values(OtpChannelType), required: false }
  })
  static async controller(context: Context): Promise<void> {
    try {
      // Get type as SMS_INTERNAL if type not specified
      let type = null;      
      switch (context.header['type']) {
        case OtpChannelType.SMS:
          type = ConfirmationTypeEnum.SMS_INTERNAL
          break;
        case OtpChannelType.TELEGRAM:
          type = ConfirmationTypeEnum.TELEGRAM
          break;
        default:
          type = ConfirmationTypeEnum.SMS_INTERNAL
          break;
      }

      /**
       * confirmatoinResendCase will return "telegramLink" 
       * if type=TELEGRAM
       */ 
      let response = await confirmationResendCase().execute({
        deviceUid: context.header['device-uid'] as string,
        type: type,
        token: context.header['token'] as string,
        language: context.header['content-language'] as LanguageEnum,
        signature: context.header['signature'] as string,
      });
      context.body = response;
      
      return context.send.data(context.body);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
