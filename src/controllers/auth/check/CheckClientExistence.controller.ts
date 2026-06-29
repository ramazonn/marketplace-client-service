import { request, summary, tags, security, prefix, query, body, header } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LanguageEnum, UserStatusEnum } from '@ubaytools/core';
import { CheckClientExistenceParams } from '../../../infrastructure';
import { checkClientExistenceCase } from '../../../usecases';

@prefix('/auth')
export default class CheckClientExistenceController {
  @request('post', '/check')
  @summary('Auth check phone')
  @security([{ sessionToken: [] }])
  @tags(['Auth'])
  @body({
    phoneNumber: { type: 'string', description: 'phone Number' },
    signature: { type: 'string', description: 'SMS signature for auto-fill functionality (optional)' },
  })
  @header({
    'content-language': { type: 'string', example: LanguageEnum.UZ, description: 'values: ' + Object.values(LanguageEnum).join(' | ') },
    'device-uid': { type: 'string', description: 'device uid' },
  })
  static async controller(c: Context): Promise<void> {
    let params: CheckClientExistenceParams;
    try {
      params = await new CheckClientExistenceParams(c.request.body).validate();
    } catch (error) {
      const joiError = await c.joi.handle(error);
      return c.send.error(joiError);
    }
    try {
      c.body = await checkClientExistenceCase().execute({
        refId: c.refId,
        client: c?.client?.getId(),
        deviceUid: c.header['device-uid'] as string,
        phoneNumber: params.phoneNumber,
        signature: params.signature,
        language: c.header['content-language'] as LanguageEnum,
      });
      c.send.data(c.body);
    } catch (e) {
      return c.send.error(e);
    }
  }
}
