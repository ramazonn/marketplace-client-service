import { body, header, prefix, request, security, summary, tags, tagsAll } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CreateSessionParams } from '../../../infrastructure';
import { createSessionCase } from '../../../usecases';
import { LanguageEnum, NotFoundError } from '@ubaytools/core';

@prefix('/auth')
export default class CreateSessionController {
  @request('post', '/session')
  @summary('Create/get Session token')
  @security([{ sessionToken: [] }])
  @tags(['Auth'])
  @body((CreateSessionParams as any).swaggerDocument)
  @header({
    'device-uid': { type: 'string', required: true },
    'user-agent': { type: 'string', required: true },
    'app-version': { type: 'string', required: true },
    'content-language': { type: 'string', example: 'uz' },
    token: { type: 'string', required: true },
  })
  static async controller(context: Context): Promise<void> {
    const appVersion = context.headers['app-version'] as string;
    if (!appVersion) {
      return context.send.error(new NotFoundError('app-version header'));
    }

    const ipAddress = context.request.ip || context.request.socket?.remoteAddress;
    const userAgent = context.headers['user-agent'] as string;
    const deviceUid = context.header['device-uid'] as string;
    const language = (context.headers['content-language'] || LanguageEnum.RU) as LanguageEnum;

    try {
      const params = await new CreateSessionParams(context.request.body).validate();
      const result = await createSessionCase.execute({
        refId: context.refId,
        client: context?.client?.getId(),
        deviceUid: deviceUid,
        processId: context.process?.getId(),
        trustedDevice: params.trustedDevice,
        fcmToken: params.fcmToken,
        appVersion: appVersion,
        language,
        metadata: {
          ipAddress: ipAddress,
          osName: params.metadata?.osName,
          osVersion: params.metadata?.osVersion,
          osSdkVersion: params.metadata?.osSdkVersion,
          model: params.metadata?.model,
          userAgent: userAgent,
          vendor: params.metadata?.vendor,
          architecture: params.metadata?.architecture,
          dpi: params.metadata?.dpi,
        },
      });
      return context.send.data(result);
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
  }
}
