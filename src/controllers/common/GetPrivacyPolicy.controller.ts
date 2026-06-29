import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Repository } from '@ubaytools/core';

@prefix('/common')
export default class GetPrivacyPolicyController {
  @request('get', '/privacy-policy')
  @summary('App Privacy Policy')
  @security([])
  @tags(['Common'])
  static async controller(context: Context): Promise<void> {
    try {
      const settings = await Repository.Settings().getSettings();
      if (!settings) {
        throw new NotFoundError('Privacy Policy');
      }
      return context.send.data({ text: settings?.getPrivacyPolicy()?.getByLang(context.lang) || '' });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
