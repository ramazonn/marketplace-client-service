import { body, header, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ConfirmationTypeEnum, confirmationValidateCase, LanguageEnum } from '@ubaytools/core';
import { ConfirmationValidateParams } from '../../infrastructure';

@prefix('/confirmation')
export default class ConfirmationValidateController {
  @request('post', '/validate')
  @summary('Validate confirmation')
  @security([{ sessionToken: [] }])
  @tags(['Confirmation'])
  @body({
    code: { type: 'string', description: 'otp code' },
  })
  @header({
    'device-uid': { type: 'string', required: true },
    'content-language': { type: 'string', example: 'uz' },
    token: { type: 'string', required: true },
  })
  static async controller(context: Context): Promise<void> {
    let params;
    try {
      params = await new ConfirmationValidateParams(context.request.body).validate();
    } catch (e) {
      const joiError = await context.joi.handle(e);
      return context.send.error(joiError);
    }

    try {
      context.body = await confirmationValidateCase().execute({
        deviceUid: context.header['device-uid'] as string,
        code: params.code,
        type: ConfirmationTypeEnum.SMS_INTERNAL,
        token: context.header['token'] as string,
        language: context.header['content-language'] as LanguageEnum,
      });

      return context.send.data(context.body);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
