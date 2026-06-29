import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Repository } from '@ubaytools/core';

@prefix('/common')
export default class GetAppInfoController {
  @request('get', '/app-info')
  @summary('App info')
  @security([])
  @tags(['Common'])
  static async controller(context: Context): Promise<void> {
    try {
      const settings = await Repository.Settings().getSettings();
      if (!settings) {
        throw new NotFoundError('App Info');
      }
      return context.send.data({ text: settings?.getAppInfo()?.getByLang(context.lang) || '' });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
